/**
 * Snapshot and diff engine for edit history.
 *
 * A "snapshot" is a JSON-serializable object capturing the full state of a
 * daily report + all its children at a point in time. Snapshots are stored
 * as JSON strings in EditHistory records and used for all-or-nothing reverts.
 *
 * A "diff" compares two snapshots and produces a human-readable list of
 * changes for display in the edit history timeline.
 */

import { db } from '@/db/database';
import type {
  DailyReport,
  LaborEntry,
  JobDiaryEntry,
  SubcontractorWork,
  MaterialDelivered,
  EditHistoryChange,
} from '@/types';

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface ReportSnapshot {
  report: {
    date: string;
    weather?: string;
    comments?: string;
    foremanId: string;
    signatureImage?: string;
  };
  laborEntries: Array<{
    id: string;
    employeeId: string;
    trade: string;
    stHours: number;
    otHours: number;
    equipmentId?: string;
    rentalCompany?: string;
    equipmentDescription?: string;
    idleStHours: number;
    idleOtHours: number;
    downStHours: number;
    downOtHours: number;
    workStHours: number;
    workOtHours: number;
    costCodeHours: Record<string, { st: number; ot: number }>;
  }>;
  diaryEntries: Array<{
    id: string;
    entryText: string;
    costCodeId?: string;
    loads?: number;
    yield?: number;
    total?: number;
    itemNumber: number;
  }>;
  subcontractorEntries: Array<{
    id: string;
    contractorId: string;
    itemsWorked: string;
    production?: string;
    costCodeId?: string;
  }>;
  deliveryEntries: Array<{
    id: string;
    supplier: string;
    material: string;
    quantity: string;
  }>;
}

/**
 * Capture the current state of a report and all its children from Dexie.
 */
export async function captureSnapshot(reportId: string): Promise<ReportSnapshot | null> {
  const report = await db.dailyReports.get(reportId);
  if (!report) return null;

  const [labor, diary, subs, deliveries] = await Promise.all([
    db.laborEntries.where('dailyReportId').equals(reportId).toArray(),
    db.jobDiaryEntries.where('dailyReportId').equals(reportId).toArray(),
    db.subcontractorWork.where('dailyReportId').equals(reportId).toArray(),
    db.materialsDelivered.where('dailyReportId').equals(reportId).toArray(),
  ]);

  return {
    report: {
      date: report.date,
      weather: report.weather,
      comments: report.comments,
      foremanId: report.foremanId,
      signatureImage: report.signatureImage,
    },
    laborEntries: labor.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      trade: e.trade,
      stHours: e.stHours,
      otHours: e.otHours,
      equipmentId: e.equipmentId,
      rentalCompany: e.rentalCompany,
      equipmentDescription: e.equipmentDescription,
      idleStHours: e.idleStHours,
      idleOtHours: e.idleOtHours,
      downStHours: e.downStHours,
      downOtHours: e.downOtHours,
      workStHours: e.workStHours,
      workOtHours: e.workOtHours,
      costCodeHours: e.costCodeHours,
    })),
    diaryEntries: diary.map((e) => ({
      id: e.id,
      entryText: e.entryText,
      costCodeId: e.costCodeId,
      loads: e.loads,
      yield: e.yield,
      total: e.total,
      itemNumber: e.itemNumber,
    })),
    subcontractorEntries: subs.map((e) => ({
      id: e.id,
      contractorId: e.contractorId,
      itemsWorked: e.itemsWorked,
      production: e.production,
      costCodeId: e.costCodeId,
    })),
    deliveryEntries: deliveries.map((e) => ({
      id: e.id,
      supplier: e.supplier,
      material: e.material,
      quantity: e.quantity,
    })),
  };
}

/**
 * Build a snapshot from the current React form state (without hitting Dexie).
 */
export function captureSnapshotFromState(
  report: DailyReport,
  laborEntries: LaborEntry[],
  diaryEntries: JobDiaryEntry[],
  subcontractorEntries: SubcontractorWork[],
  deliveryEntries: MaterialDelivered[]
): ReportSnapshot {
  return {
    report: {
      date: report.date,
      weather: report.weather,
      comments: report.comments,
      foremanId: report.foremanId,
      signatureImage: report.signatureImage,
    },
    laborEntries: laborEntries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      trade: e.trade,
      stHours: e.stHours,
      otHours: e.otHours,
      equipmentId: e.equipmentId,
      rentalCompany: e.rentalCompany,
      equipmentDescription: e.equipmentDescription,
      idleStHours: e.idleStHours,
      idleOtHours: e.idleOtHours,
      downStHours: e.downStHours,
      downOtHours: e.downOtHours,
      workStHours: e.workStHours,
      workOtHours: e.workOtHours,
      costCodeHours: e.costCodeHours,
    })),
    diaryEntries: diaryEntries.map((e) => ({
      id: e.id,
      entryText: e.entryText,
      costCodeId: e.costCodeId,
      loads: e.loads,
      yield: e.yield,
      total: e.total,
      itemNumber: e.itemNumber,
    })),
    subcontractorEntries: subcontractorEntries.map((e) => ({
      id: e.id,
      contractorId: e.contractorId,
      itemsWorked: e.itemsWorked,
      production: e.production,
      costCodeId: e.costCodeId,
    })),
    deliveryEntries: deliveryEntries.map((e) => ({
      id: e.id,
      supplier: e.supplier,
      material: e.material,
      quantity: e.quantity,
    })),
  };
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

/** Look up a human-readable name for an employee/equipment/etc. by local ID. */
async function employeeName(id: string): Promise<string> {
  const emp = await db.employees.get(id);
  return emp?.name || 'Unknown';
}

async function costCodeLabel(id: string): Promise<string> {
  const cc = await db.costCodes.get(id);
  return cc ? `${cc.code} ${cc.description}` : 'Unknown';
}

async function subcontractorName(id: string): Promise<string> {
  const sub = await db.subcontractors.get(id);
  return sub?.name || 'Unknown';
}

/**
 * Diff two snapshots and produce a human-readable change summary.
 * If `prev` is null, this is the initial submission (returns an empty array).
 */
export async function diffSnapshots(
  prev: ReportSnapshot | null,
  curr: ReportSnapshot
): Promise<EditHistoryChange[]> {
  if (!prev) return [{ field: 'Initial submission', newValue: '' }];

  const changes: EditHistoryChange[] = [];

  // Report-level fields
  if (prev.report.date !== curr.report.date) {
    changes.push({ field: 'Date', oldValue: prev.report.date, newValue: curr.report.date });
  }
  if (prev.report.weather !== curr.report.weather) {
    changes.push({ field: 'Weather', oldValue: prev.report.weather || '', newValue: curr.report.weather || '' });
  }
  if (prev.report.comments !== curr.report.comments) {
    changes.push({ field: 'Comments', oldValue: prev.report.comments || '', newValue: curr.report.comments || '' });
  }

  // Labor entries
  const prevLaborIds = new Set(prev.laborEntries.map((e) => e.id));
  const currLaborIds = new Set(curr.laborEntries.map((e) => e.id));

  for (const entry of curr.laborEntries) {
    if (!prevLaborIds.has(entry.id)) {
      const name = entry.employeeId ? await employeeName(entry.employeeId) : 'N/A';
      changes.push({ field: `Added labor entry`, newValue: `${name} (${entry.trade}) ${entry.stHours}ST/${entry.otHours}OT` });
    }
  }
  for (const entry of prev.laborEntries) {
    if (!currLaborIds.has(entry.id)) {
      const name = entry.employeeId ? await employeeName(entry.employeeId) : 'N/A';
      changes.push({ field: `Removed labor entry`, oldValue: `${name} (${entry.trade})` });
    }
  }
  // Modified labor entries
  for (const curr_e of curr.laborEntries) {
    const prev_e = prev.laborEntries.find((e) => e.id === curr_e.id);
    if (!prev_e) continue;
    const name = curr_e.employeeId ? await employeeName(curr_e.employeeId) : 'N/A';
    if (prev_e.stHours !== curr_e.stHours) {
      changes.push({ field: `ST Hours (${name})`, oldValue: String(prev_e.stHours), newValue: String(curr_e.stHours) });
    }
    if (prev_e.otHours !== curr_e.otHours) {
      changes.push({ field: `OT Hours (${name})`, oldValue: String(prev_e.otHours), newValue: String(curr_e.otHours) });
    }
    if (prev_e.trade !== curr_e.trade) {
      changes.push({ field: `Trade (${name})`, oldValue: prev_e.trade, newValue: curr_e.trade });
    }
    if (prev_e.employeeId !== curr_e.employeeId) {
      const oldName = prev_e.employeeId ? await employeeName(prev_e.employeeId) : 'N/A';
      const newName = curr_e.employeeId ? await employeeName(curr_e.employeeId) : 'N/A';
      changes.push({ field: 'Employee', oldValue: oldName, newValue: newName });
    }
  }

  // Diary entries
  const prevDiaryIds = new Set(prev.diaryEntries.map((e) => e.id));
  const currDiaryIds = new Set(curr.diaryEntries.map((e) => e.id));
  for (const entry of curr.diaryEntries) {
    if (!prevDiaryIds.has(entry.id)) {
      changes.push({ field: 'Added diary entry', newValue: entry.entryText.slice(0, 60) });
    }
  }
  for (const entry of prev.diaryEntries) {
    if (!currDiaryIds.has(entry.id)) {
      changes.push({ field: 'Removed diary entry', oldValue: entry.entryText.slice(0, 60) });
    }
  }
  for (const curr_e of curr.diaryEntries) {
    const prev_e = prev.diaryEntries.find((e) => e.id === curr_e.id);
    if (!prev_e) continue;
    if (prev_e.entryText !== curr_e.entryText) {
      changes.push({ field: `Diary entry #${curr_e.itemNumber}`, oldValue: prev_e.entryText.slice(0, 40), newValue: curr_e.entryText.slice(0, 40) });
    }
    if (prev_e.costCodeId !== curr_e.costCodeId) {
      const oldCC = prev_e.costCodeId ? await costCodeLabel(prev_e.costCodeId) : 'None';
      const newCC = curr_e.costCodeId ? await costCodeLabel(curr_e.costCodeId) : 'None';
      changes.push({ field: `Cost Code (diary #${curr_e.itemNumber})`, oldValue: oldCC, newValue: newCC });
    }
  }

  // Subcontractor entries
  const prevSubIds = new Set(prev.subcontractorEntries.map((e) => e.id));
  const currSubIds = new Set(curr.subcontractorEntries.map((e) => e.id));
  for (const entry of curr.subcontractorEntries) {
    if (!prevSubIds.has(entry.id)) {
      const name = await subcontractorName(entry.contractorId);
      changes.push({ field: 'Added subcontractor', newValue: name });
    }
  }
  for (const entry of prev.subcontractorEntries) {
    if (!currSubIds.has(entry.id)) {
      const name = await subcontractorName(entry.contractorId);
      changes.push({ field: 'Removed subcontractor', oldValue: name });
    }
  }

  // Delivery entries
  const prevDelIds = new Set(prev.deliveryEntries.map((e) => e.id));
  const currDelIds = new Set(curr.deliveryEntries.map((e) => e.id));
  for (const entry of curr.deliveryEntries) {
    if (!prevDelIds.has(entry.id)) {
      changes.push({ field: 'Added delivery', newValue: `${entry.supplier}: ${entry.material}` });
    }
  }
  for (const entry of prev.deliveryEntries) {
    if (!currDelIds.has(entry.id)) {
      changes.push({ field: 'Removed delivery', oldValue: `${entry.supplier}: ${entry.material}` });
    }
  }

  return changes.length > 0 ? changes : [{ field: 'No changes detected' }];
}

/**
 * Get the most recent snapshot for a report from the edit history.
 * Returns null if no history exists (first submission).
 */
export async function getPreviousSnapshot(reportId: string): Promise<ReportSnapshot | null> {
  const history = await db.editHistory
    .where('dailyReportId')
    .equals(reportId)
    .sortBy('timestamp');
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  try {
    return JSON.parse(latest.snapshot) as ReportSnapshot;
  } catch {
    return null;
  }
}
