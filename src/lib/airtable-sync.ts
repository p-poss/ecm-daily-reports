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
import { db, generateId, now } from '@/db/database';
import type {
  Job, CostCode, Employee, Equipment, Subcontractor, Trade,
  DailyReport, LaborEntry, JobDiaryEntry, SubcontractorWork, MaterialDelivered,
} from '@/types';
import { calculateDeadlines } from '@/db/database';

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

async function fetchAllRecords(tableName: string, filterFormula?: string): Promise<AirtableRecord[]> {
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
    if (filterFormula) url.searchParams.set('filterByFormula', filterFormula);
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

async function syncEquipment(): Promise<{ pulled: number; upserted: number; skipped: boolean }> {
  const records = await fetchAllRecords('Equipment');
  if (records.length === 0) return { pulled: 0, upserted: 0, skipped: true };

  const existing = await db.equipment.toArray();
  const byAirtableId = new Map(existing.filter((e) => e.airtableId).map((e) => [e.airtableId!, e]));
  const incomingAirtableIds = new Set<string>();

  const toUpsert: Equipment[] = [];
  for (const r of records) {
    incomingAirtableIds.add(r.id);
    const prev = byAirtableId.get(r.id);
    toUpsert.push({
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      equipmentNumber: str(r.fields, 'Equipment Number') || '',
      description: str(r.fields, 'Description') || '',
      type: str(r.fields, 'Type') || '',
    });
  }

  const toDelete = existing
    .filter((e) => !e.airtableId || !incomingAirtableIds.has(e.airtableId))
    .map((e) => e.id);

  await db.transaction('rw', db.equipment, async () => {
    if (toDelete.length > 0) await db.equipment.bulkDelete(toDelete);
    await db.equipment.bulkPut(toUpsert);
  });

  return { pulled: records.length, upserted: toUpsert.length, skipped: false };
}

async function syncSubcontractors(): Promise<{ pulled: number; upserted: number; skipped: boolean }> {
  const records = await fetchAllRecords('Subcontractors');
  if (records.length === 0) return { pulled: 0, upserted: 0, skipped: true };

  const existing = await db.subcontractors.toArray();
  const byAirtableId = new Map(existing.filter((s) => s.airtableId).map((s) => [s.airtableId!, s]));
  const incomingAirtableIds = new Set<string>();

  const toUpsert: Subcontractor[] = [];
  for (const r of records) {
    incomingAirtableIds.add(r.id);
    const prev = byAirtableId.get(r.id);
    toUpsert.push({
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      name: str(r.fields, 'Name') || '',
    });
  }

  const toDelete = existing
    .filter((s) => !s.airtableId || !incomingAirtableIds.has(s.airtableId))
    .map((s) => s.id);

  await db.transaction('rw', db.subcontractors, async () => {
    if (toDelete.length > 0) await db.subcontractors.bulkDelete(toDelete);
    await db.subcontractors.bulkPut(toUpsert);
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

// ---------------------------------------------------------------------------
// Transaction-table downloader: pull reports for a specific job
// ---------------------------------------------------------------------------

/** Helper: build a lookup map of airtableId → local UUID for a Dexie table. */
async function buildReverseMap(
  tableName: 'jobs' | 'employees' | 'equipment' | 'costCodes' | 'subcontractors' | 'dailyReports'
): Promise<Map<string, string>> {
  const all = await db.table(tableName).toArray();
  return new Map(
    all
      .filter((r: { airtableId?: string }) => r.airtableId)
      .map((r: { id: string; airtableId?: string }) => [r.airtableId!, r.id])
  );
}

/**
 * Pull all Daily Reports (and their children) for a specific job from
 * Airtable into local Dexie. Uses upsert-by-airtableId so re-pulls
 * don't duplicate. Called when the user navigates to a job's reports
 * page.
 *
 * The FK fields in Airtable contain airtableIds (not local UUIDs),
 * which we translate back to local UUIDs for storage in Dexie.
 */
export async function syncReportsForJob(jobId: string): Promise<{ reports: number; durationMs: number }> {
  const start = performance.now();

  // We need the job's airtableId to filter Daily Reports in Airtable.
  const job = await db.jobs.get(jobId);
  if (!job?.airtableId) {
    return { reports: 0, durationMs: 0 };
  }

  // Build reverse-lookup maps: airtableId → local UUID.
  const [employeeMap, equipmentMap, costCodeMap, subcontractorMap] = await Promise.all([
    buildReverseMap('employees'),
    buildReverseMap('equipment'),
    buildReverseMap('costCodes'),
    buildReverseMap('subcontractors'),
  ]);

  // Resolve an airtableId FK to a local UUID. Returns the raw value as
  // fallback if no match (graceful degradation for unsynced references).
  function resolve(map: Map<string, string>, airtableId: string | undefined): string {
    if (!airtableId) return '';
    return map.get(airtableId) ?? airtableId;
  }

  // 1. Fetch Daily Reports for this job. With Linked Records, the
  // formula {Job} returns the linked record's primary-field display
  // value (Job Number), not the airtableId.
  const reportRecords = await fetchAllRecords(
    'Daily Reports',
    `{Job} = '${job.jobNumber}'`
  );

  if (reportRecords.length === 0) {
    return { reports: 0, durationMs: Math.round(performance.now() - start) };
  }

  // Existing local reports keyed by airtableId for UUID preservation.
  const existingReports = await db.dailyReports.where('jobId').equals(jobId).toArray();
  const reportByAirtableId = new Map(
    existingReports.filter((r) => r.airtableId).map((r) => [r.airtableId!, r])
  );

  // Build a map from Airtable report ID → local report UUID (needed for children).
  const reportAirtableToLocal = new Map<string, string>();

  const reportsToUpsert: DailyReport[] = [];
  for (const r of reportRecords) {
    const prev = reportByAirtableId.get(r.id);
    const localId = prev?.id ?? generateId();
    reportAirtableToLocal.set(r.id, localId);

    const date = str(r.fields, 'Date') || '';
    const deadlines = date ? calculateDeadlines(date) : {
      dailyDueBy: '', payrollWeekEnding: '', payrollDueBy: '',
    };

    reportsToUpsert.push({
      id: localId,
      airtableId: r.id,
      jobId,
      date,
      dayOfWeek: str(r.fields, 'Day of Week') || '',
      foremanId: resolve(employeeMap, linkedId(r.fields, 'Foreman')),
      weather: str(r.fields, 'Weather') as DailyReport['weather'],
      comments: str(r.fields, 'Comments'),
      status: (str(r.fields, 'Status') as DailyReport['status']) || 'Draft',
      submittedAt: str(r.fields, 'Submitted At'),
      signatureImage: str(r.fields, 'Signature'),
      lastEditorId: resolve(employeeMap, linkedId(r.fields, 'Foreman')),
      editCount: prev?.editCount ?? 0,
      dailyDueBy: deadlines.dailyDueBy,
      isDailyLate: r.fields['Is Daily Late'] === true,
      payrollWeekEnding: deadlines.payrollWeekEnding,
      payrollDueBy: deadlines.payrollDueBy,
      isPayrollLate: r.fields['Is Payroll Late'] === true,
      syncStatus: 'synced',
      createdAt: prev?.createdAt ?? now(),
      updatedAt: now(),
    });
  }

  await db.dailyReports.bulkPut(reportsToUpsert);

  // 2. Fetch and upsert children for each report.
  // We filter children by their 'Daily Report' FK which now contains
  // the parent's airtableId (thanks to the upload change in step 1).
  const reportAirtableIds = reportRecords.map((r) => r.id);

  // Fetch ALL children in one pass per table (more efficient than per-report).
  const [laborRecords, diaryRecords, subRecords, deliveryRecords] = await Promise.all([
    fetchAllRecords('Labor Entries'),
    fetchAllRecords('Job Diary Entries'),
    fetchAllRecords('Subcontractor Work'),
    fetchAllRecords('Materials Delivered'),
  ]);

  // Filter to only children of these reports + build local rows.
  const reportIdSet = new Set(reportAirtableIds);

  // --- Labor Entries ---
  const existingLabor = await db.laborEntries.toArray();
  const laborByAirtableId = new Map(
    existingLabor.filter((e) => e.airtableId).map((e) => [e.airtableId!, e])
  );
  const laborToUpsert: LaborEntry[] = [];
  for (const r of laborRecords) {
    const parentAirtableId = linkedId(r.fields, 'Daily Report');
    if (!parentAirtableId || !reportIdSet.has(parentAirtableId)) continue;
    const prev = laborByAirtableId.get(r.id);
    laborToUpsert.push({
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      dailyReportId: reportAirtableToLocal.get(parentAirtableId) || '',
      employeeId: resolve(employeeMap, linkedId(r.fields, 'Employee')),
      trade: (str(r.fields, 'Trade') || 'LB') as Trade,
      stHours: num(r.fields, 'ST Hours') ?? 0,
      otHours: num(r.fields, 'OT Hours') ?? 0,
      equipmentId: resolve(equipmentMap, linkedId(r.fields, 'Equipment')) || undefined,
      rentalCompany: str(r.fields, 'Rental Company'),
      equipmentDescription: undefined,
      idleStHours: num(r.fields, 'Idle ST Hours') ?? 0,
      idleOtHours: num(r.fields, 'Idle OT Hours') ?? 0,
      downStHours: num(r.fields, 'Down ST Hours') ?? 0,
      downOtHours: num(r.fields, 'Down OT Hours') ?? 0,
      workStHours: num(r.fields, 'Work ST Hours') ?? 0,
      workOtHours: num(r.fields, 'Work OT Hours') ?? 0,
      costCodeHours: prev?.costCodeHours ?? {},
    });
  }
  if (laborToUpsert.length > 0) await db.laborEntries.bulkPut(laborToUpsert);

  // --- Job Diary Entries ---
  const existingDiary = await db.jobDiaryEntries.toArray();
  const diaryByAirtableId = new Map(
    existingDiary.filter((e) => e.airtableId).map((e) => [e.airtableId!, e])
  );
  const diaryToUpsert: JobDiaryEntry[] = [];
  for (const r of diaryRecords) {
    const parentAirtableId = linkedId(r.fields, 'Daily Report');
    if (!parentAirtableId || !reportIdSet.has(parentAirtableId)) continue;
    const prev = diaryByAirtableId.get(r.id);
    diaryToUpsert.push({
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      dailyReportId: reportAirtableToLocal.get(parentAirtableId) || '',
      entryText: str(r.fields, 'Entry Text') || '',
      costCodeId: resolve(costCodeMap, linkedId(r.fields, 'Cost Code')) || undefined,
      itemNumber: num(r.fields, 'Item Number') ?? 0,
    });
  }
  if (diaryToUpsert.length > 0) await db.jobDiaryEntries.bulkPut(diaryToUpsert);

  // --- Subcontractor Work ---
  const existingSubs = await db.subcontractorWork.toArray();
  const subsByAirtableId = new Map(
    existingSubs.filter((e) => e.airtableId).map((e) => [e.airtableId!, e])
  );
  const subsToUpsert: SubcontractorWork[] = [];
  for (const r of subRecords) {
    const parentAirtableId = linkedId(r.fields, 'Daily Report');
    if (!parentAirtableId || !reportIdSet.has(parentAirtableId)) continue;
    const prev = subsByAirtableId.get(r.id);
    subsToUpsert.push({
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      dailyReportId: reportAirtableToLocal.get(parentAirtableId) || '',
      contractorId: resolve(subcontractorMap, linkedId(r.fields, 'Contractor')),
      itemsWorked: str(r.fields, 'Items Worked') || '',
      production: str(r.fields, 'Production'),
    });
  }
  if (subsToUpsert.length > 0) await db.subcontractorWork.bulkPut(subsToUpsert);

  // --- Materials Delivered ---
  const existingDeliveries = await db.materialsDelivered.toArray();
  const deliveriesByAirtableId = new Map(
    existingDeliveries.filter((e) => e.airtableId).map((e) => [e.airtableId!, e])
  );
  const deliveriesToUpsert: MaterialDelivered[] = [];
  for (const r of deliveryRecords) {
    const parentAirtableId = linkedId(r.fields, 'Daily Report');
    if (!parentAirtableId || !reportIdSet.has(parentAirtableId)) continue;
    const prev = deliveriesByAirtableId.get(r.id);
    deliveriesToUpsert.push({
      id: prev?.id ?? generateId(),
      airtableId: r.id,
      dailyReportId: reportAirtableToLocal.get(parentAirtableId) || '',
      supplier: str(r.fields, 'Supplier') || '',
      material: str(r.fields, 'Material') || '',
      quantity: str(r.fields, 'Quantity') || '',
    });
  }
  if (deliveriesToUpsert.length > 0) await db.materialsDelivered.bulkPut(deliveriesToUpsert);

  return {
    reports: reportsToUpsert.length,
    durationMs: Math.round(performance.now() - start),
  };
}

// ---------------------------------------------------------------------------
// Master-table sync
// ---------------------------------------------------------------------------

type TableSyncResult = { pulled: number; upserted: number; skipped: boolean };

export interface MasterSyncResult {
  jobs: TableSyncResult;
  employees: TableSyncResult;
  equipment: TableSyncResult;
  subcontractors: TableSyncResult;
  costCodes: TableSyncResult;
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
  const equipment = await syncEquipment();
  const subcontractors = await syncSubcontractors();
  const costCodes = await syncCostCodes();
  return {
    jobs,
    employees,
    equipment,
    subcontractors,
    costCodes,
    durationMs: Math.round(performance.now() - start),
  };
}
