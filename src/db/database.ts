import Dexie, { type EntityTable } from 'dexie';
import type {
  Job,
  Employee,
  Equipment,
  CostCode,
  Subcontractor,
  DailyReport,
  LaborEntry,
  EquipmentUsage,
  SubcontractorWork,
  MaterialDelivered,
  JobDiaryEntry,
  PhotoAttachment,
  EditHistory,
  SyncQueueItem,
  Tombstone,
  AuthSession,
} from '@/types';

class ECMDatabase extends Dexie {
  // Master tables (synced from Airtable)
  jobs!: EntityTable<Job, 'id'>;
  employees!: EntityTable<Employee, 'id'>;
  equipment!: EntityTable<Equipment, 'id'>;
  costCodes!: EntityTable<CostCode, 'id'>;
  subcontractors!: EntityTable<Subcontractor, 'id'>;

  // Transaction tables (created in app, synced to Airtable)
  dailyReports!: EntityTable<DailyReport, 'id'>;
  laborEntries!: EntityTable<LaborEntry, 'id'>;
  equipmentUsage!: EntityTable<EquipmentUsage, 'id'>;
  subcontractorWork!: EntityTable<SubcontractorWork, 'id'>;
  materialsDelivered!: EntityTable<MaterialDelivered, 'id'>;
  jobDiaryEntries!: EntityTable<JobDiaryEntry, 'id'>;
  photoAttachments!: EntityTable<PhotoAttachment, 'id'>;
  editHistory!: EntityTable<EditHistory, 'id'>;

  // App management tables
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  tombstones!: EntityTable<Tombstone, 'id'>;
  authSession!: EntityTable<AuthSession, 'id'>;

  constructor() {
    super('ECMDatabase');

    this.version(1).stores({
      // Master tables
      jobs: 'id, jobNumber, status, airtableId',
      employees: 'id, name, loginEmail, isForeman, airtableId, *assignedJobIds',
      equipment: 'id, equipmentNumber, airtableId',
      costCodes: 'id, code, airtableId',
      subcontractors: 'id, name, airtableId',

      // Transaction tables
      dailyReports: 'id, jobId, date, foremanId, status, syncStatus, airtableId, [jobId+date]',
      laborEntries: 'id, dailyReportId, employeeId, airtableId',
      equipmentUsage: 'id, dailyReportId, airtableId',
      subcontractorWork: 'id, dailyReportId, contractorId, airtableId',
      materialsDelivered: 'id, dailyReportId, airtableId',
      jobDiaryEntries: 'id, dailyReportId, itemNumber, airtableId',
      photoAttachments: 'id, dailyReportId, diaryEntryId, airtableId',
      editHistory: 'id, dailyReportId, timestamp, airtableId',

      // App management
      syncQueue: 'id, tableName, recordId, createdAt',
      authSession: 'id, foremanId',
    });

    // v2: cost codes belong to a job. Re-index with jobId and clear any
    // pre-existing global cost codes (test data) so they get re-seeded
    // per-job on next load.
    this.version(2)
      .stores({
        costCodes: 'id, jobId, code, airtableId, [jobId+code]',
      })
      .upgrade(async (tx) => {
        await tx.table('costCodes').clear();
      });

    // v3: clean slate for jobs + all transactional/derived data so the
    // Airtable downloader can repopulate them. We deliberately keep
    // employees, equipment, and subcontractors so the dev seed for those
    // sticks around as a fallback.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await Promise.all([
          tx.table('jobs').clear(),
          tx.table('dailyReports').clear(),
          tx.table('laborEntries').clear(),
          tx.table('jobDiaryEntries').clear(),
          tx.table('subcontractorWork').clear(),
          tx.table('materialsDelivered').clear(),
          tx.table('equipmentUsage').clear(),
          tx.table('photoAttachments').clear(),
          tx.table('editHistory').clear(),
        ]);
      });

    // v4: employees now come from Airtable. Wipe the seeded employees and
    // any existing auth session so foremen log in fresh with their Airtable
    // credentials (john/mike/carlos@ecm.com / password123).
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await Promise.all([
          tx.table('employees').clear(),
          tx.table('authSession').clear(),
        ]);
      });

    // v5: tombstones table for tracking child rows that were deleted
    // locally but still exist in Airtable. Drained on submit.
    this.version(5).stores({
      tombstones: 'id, dailyReportId, [dailyReportId+tableName]',
    });

    // v6: equipment and subcontractors now come from Airtable. Wipe the
    // local seed copies so the downloader rehydrates them with airtableIds.
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        await Promise.all([
          tx.table('equipment').clear(),
          tx.table('subcontractors').clear(),
        ]);
      });

    // v7: clean slate — wipe all transaction data so Airtable and local
    // are in sync. Also clears stale sync queue items and tombstones.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        await Promise.all([
          tx.table('dailyReports').clear(),
          tx.table('laborEntries').clear(),
          tx.table('jobDiaryEntries').clear(),
          tx.table('subcontractorWork').clear(),
          tx.table('materialsDelivered').clear(),
          tx.table('equipmentUsage').clear(),
          tx.table('photoAttachments').clear(),
          tx.table('editHistory').clear(),
          tx.table('syncQueue').clear(),
          tx.table('tombstones').clear(),
        ]);
      });
  }
}

export const db = new ECMDatabase();

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper to get current ISO datetime
export function now(): string {
  return new Date().toISOString();
}

// Helper to calculate deadline dates
export function calculateDeadlines(reportDate: string): {
  dailyDueBy: string;
  payrollWeekEnding: string;
  payrollDueBy: string;
} {
  const date = new Date(reportDate);

  // Daily due by: 5pm next day
  const dailyDue = new Date(date);
  dailyDue.setDate(dailyDue.getDate() + 1);
  dailyDue.setHours(17, 0, 0, 0);

  // Find the Saturday of this week (week ending)
  const dayOfWeek = date.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const weekEnding = new Date(date);
  weekEnding.setDate(weekEnding.getDate() + daysUntilSaturday);
  weekEnding.setHours(0, 0, 0, 0);

  // Payroll due by: Monday noon after week ending
  const payrollDue = new Date(weekEnding);
  payrollDue.setDate(payrollDue.getDate() + 2); // Monday
  payrollDue.setHours(12, 0, 0, 0);

  return {
    dailyDueBy: dailyDue.toISOString(),
    payrollWeekEnding: weekEnding.toISOString().split('T')[0],
    payrollDueBy: payrollDue.toISOString(),
  };
}

// Check if a deadline has passed
export function isDeadlinePassed(deadline: string): boolean {
  return new Date() > new Date(deadline);
}
