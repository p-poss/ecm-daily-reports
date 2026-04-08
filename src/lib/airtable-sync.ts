/**
 * Airtable → local Dexie downloader for master tables.
 *
 * Pulls Jobs, Cost Codes (and any future master tables) from Airtable and
 * upserts them into Dexie. Local UUIDs are preserved across reloads by
 * keying off `airtableId`. Linked record fields are translated into the
 * matching local foreign-key UUID before being stored.
 *
 * If an Airtable table is empty, the corresponding local table is left
 * untouched — this lets the dev seed for employees/equipment/subcontractors
 * remain in place until those tables get populated upstream.
 */
import { db, generateId } from '@/db/database';
import type { Job, CostCode, Employee, Trade } from '@/types';

const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID || '';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

async function fetchAllRecords(tableName: string): Promise<AirtableRecord[]> {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable not configured');
  }
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
    );
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!response.ok) {
      throw new Error(`Airtable fetch failed for ${tableName}: ${response.status} ${response.statusText}`);
    }
    const data: AirtableListResponse = await response.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

/** Helpers to read fields with type safety. */
function str(fields: Record<string, unknown>, key: string): string | undefined {
  const v = fields[key];
  return typeof v === 'string' ? v : undefined;
}
function num(fields: Record<string, unknown>, key: string): number | undefined {
  const v = fields[key];
  return typeof v === 'number' ? v : undefined;
}
function linkedId(fields: Record<string, unknown>, key: string): string | undefined {
  const v = fields[key];
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  return undefined;
}
function linkedIds(fields: Record<string, unknown>, key: string): string[] {
  const v = fields[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  return [];
}

async function syncJobs(): Promise<{ pulled: number; upserted: number; skipped: boolean }> {
  const records = await fetchAllRecords('Jobs');
  if (records.length === 0) return { pulled: 0, upserted: 0, skipped: true };

  // Map existing local jobs by airtableId so we can preserve their local UUIDs.
  const existing = await db.jobs.toArray();
  const byAirtableId = new Map(existing.filter((j) => j.airtableId).map((j) => [j.airtableId!, j]));
  const incomingAirtableIds = new Set<string>();

  const toUpsert: Job[] = [];
  for (const r of records) {
    incomingAirtableIds.add(r.id);
    const prev = byAirtableId.get(r.id);
    const sectorRaw = str(r.fields, 'Sector');
    const statusRaw = str(r.fields, 'Status');
    const job: Job = {
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      jobNumber: str(r.fields, 'Job Number') || '',
      jobName: str(r.fields, 'Job Name') || '',
      status: (statusRaw === 'Active' || statusRaw === 'Completed' || statusRaw === 'On Hold')
        ? statusRaw
        : 'Active',
      sector: sectorRaw === 'Public' ? 'Public' : 'Private',
      address: str(r.fields, 'Address'),
      owner: str(r.fields, 'Owner'),
      totalContract: num(r.fields, 'Total Contract'),
    };
    toUpsert.push(job);
  }

  // Replace strategy: Airtable is the source of truth. Anything local that
  // isn't in this Airtable response gets deleted — including stale seed
  // rows that never had an airtableId at all.
  const toDelete = existing
    .filter((j) => !j.airtableId || !incomingAirtableIds.has(j.airtableId))
    .map((j) => j.id);

  await db.transaction('rw', db.jobs, async () => {
    if (toDelete.length > 0) await db.jobs.bulkDelete(toDelete);
    await db.jobs.bulkPut(toUpsert);
  });

  return { pulled: records.length, upserted: toUpsert.length, skipped: false };
}

async function syncEmployees(): Promise<{ pulled: number; upserted: number; skipped: boolean }> {
  const records = await fetchAllRecords('Employees');
  if (records.length === 0) return { pulled: 0, upserted: 0, skipped: true };

  // Build the airtableId → local jobId map for translating Assigned Jobs.
  const jobs = await db.jobs.toArray();
  const jobIdByAirtableId = new Map(jobs.filter((j) => j.airtableId).map((j) => [j.airtableId!, j.id]));

  const existing = await db.employees.toArray();
  const byAirtableId = new Map(existing.filter((e) => e.airtableId).map((e) => [e.airtableId!, e]));
  const incomingAirtableIds = new Set<string>();

  const toUpsert: Employee[] = [];
  for (const r of records) {
    incomingAirtableIds.add(r.id);
    const prev = byAirtableId.get(r.id);
    // Translate the linked Job airtableIds into local jobIds; silently drop
    // any that don't resolve (e.g. assigned to a job that's been deleted).
    const assignedJobIds = linkedIds(r.fields, 'Assigned Jobs')
      .map((id) => jobIdByAirtableId.get(id))
      .filter((id): id is string => !!id);
    const employee: Employee = {
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      name: str(r.fields, 'Name') || '',
      trade: (str(r.fields, 'Trade') || 'O') as Trade,
      isForeman: str(r.fields, 'Is Foreman') === 'Yes',
      loginEmail: str(r.fields, 'Login Email'),
      passwordHash: str(r.fields, 'Password Hash'),
      assignedJobIds,
    };
    toUpsert.push(employee);
  }

  // Replace strategy: Airtable is the source of truth.
  const toDelete = existing
    .filter((e) => !e.airtableId || !incomingAirtableIds.has(e.airtableId))
    .map((e) => e.id);

  await db.transaction('rw', db.employees, async () => {
    if (toDelete.length > 0) await db.employees.bulkDelete(toDelete);
    await db.employees.bulkPut(toUpsert);
  });

  return { pulled: records.length, upserted: toUpsert.length, skipped: false };
}

async function syncCostCodes(): Promise<{ pulled: number; upserted: number; skipped: boolean }> {
  const records = await fetchAllRecords('Cost Codes');
  if (records.length === 0) return { pulled: 0, upserted: 0, skipped: true };

  // Need a local jobId for each Airtable Job link. Build the lookup map.
  const jobs = await db.jobs.toArray();
  const jobIdByAirtableId = new Map(jobs.filter((j) => j.airtableId).map((j) => [j.airtableId!, j.id]));

  const existing = await db.costCodes.toArray();
  const byAirtableId = new Map(existing.filter((c) => c.airtableId).map((c) => [c.airtableId!, c]));
  const incomingAirtableIds = new Set<string>();

  const toUpsert: CostCode[] = [];
  const orphaned: string[] = []; // cost codes whose Job link doesn't resolve
  for (const r of records) {
    incomingAirtableIds.add(r.id);
    const linkedJobAirtableId = linkedId(r.fields, 'Job');
    const localJobId = linkedJobAirtableId ? jobIdByAirtableId.get(linkedJobAirtableId) : undefined;
    if (!localJobId) {
      orphaned.push(str(r.fields, 'Code') || r.id);
      continue;
    }
    const prev = byAirtableId.get(r.id);
    const cc: CostCode = {
      id: prev?.id ?? generateId(),
      jobId: localJobId,
      airtableId: r.id,
      code: str(r.fields, 'Code') || '',
      description: str(r.fields, 'Description') || '',
      uom: str(r.fields, 'UOM'),
      quantity: num(r.fields, 'Quantity'),
      unitPrice: num(r.fields, 'Unit Price'),
      budgetAmount: num(r.fields, 'Budget Amount'),
    };
    toUpsert.push(cc);
  }

  if (orphaned.length > 0) {
    console.warn(`[airtable-sync] Skipped ${orphaned.length} cost codes with unresolvable Job link:`, orphaned);
  }

  // Same replace strategy as jobs — wipe any local cost code that isn't
  // present in the current Airtable response, including seed leftovers
  // without an airtableId.
  const toDelete = existing
    .filter((c) => !c.airtableId || !incomingAirtableIds.has(c.airtableId))
    .map((c) => c.id);

  await db.transaction('rw', db.costCodes, async () => {
    if (toDelete.length > 0) await db.costCodes.bulkDelete(toDelete);
    await db.costCodes.bulkPut(toUpsert);
  });

  return { pulled: records.length, upserted: toUpsert.length, skipped: false };
}

export interface MasterSyncResult {
  jobs: { pulled: number; upserted: number; skipped: boolean };
  employees: { pulled: number; upserted: number; skipped: boolean };
  costCodes: { pulled: number; upserted: number; skipped: boolean };
  durationMs: number;
}

/**
 * Pull all master tables from Airtable into local Dexie.
 * Order matters: Jobs must be synced before Employees and Cost Codes so the
 * Linked Record translations can resolve to local jobIds.
 */
export async function syncMasterTables(): Promise<MasterSyncResult> {
  const start = performance.now();
  const jobs = await syncJobs();
  const employees = await syncEmployees();
  const costCodes = await syncCostCodes();
  return {
    jobs,
    employees,
    costCodes,
    durationMs: Math.round(performance.now() - start),
  };
}
