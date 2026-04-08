// Master table types (synced from Airtable)
export interface Job {
  id: string;
  jobNumber: string;
  jobName: string;
  status: 'Active' | 'Completed' | 'On Hold';
  sector: 'Public' | 'Private';
  address?: string;
  airtableId?: string;
}

export interface Employee {
  id: string;
  name: string;
  trade: Trade;
  isForeman: boolean;
  assignedJobIds: string[];
  loginEmail?: string;
  passwordHash?: string;
  airtableId?: string;
}

export interface Equipment {
  id: string;
  equipmentNumber: string;
  description: string;
  type: string;
  airtableId?: string;
}

export interface CostCode {
  id: string;
  jobId: string;
  code: string;
  description: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  budgetAmount?: number;
  airtableId?: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  airtableId?: string;
}

// Trade codes from paper forms
export type Trade = 'S' | 'OE' | 'LB' | 'O' | 'F' | 'GC' | 'L' | 'Grd' | 'Supt' | string;

// Weather options
export type Weather = 'Sunny' | 'Clear' | 'Cloudy' | 'Partly Cloudy' | 'Rain' | 'Snow' | 'Windy' | 'Hot' | 'Cold';

// Report status
export type ReportStatus = 'Draft' | 'Submitted' | 'Approved';

// Daily Report transaction tables
export interface DailyReport {
  id: string;
  jobId: string;
  date: string; // ISO date string
  dayOfWeek: string;
  foremanId: string;
  weather?: Weather;
  comments?: string; // Optional additional comments
  status: ReportStatus;
  submittedAt?: string;
  signatureImage?: string; // Base64 encoded
  lastEditorId?: string;
  editCount: number;
  // Deadline tracking
  dailyDueBy: string; // ISO datetime - 5pm next day
  isDailyLate: boolean;
  payrollWeekEnding: string; // ISO date string - Saturday
  payrollDueBy: string; // ISO datetime - Monday noon
  isPayrollLate: boolean;
  // Sync status
  syncStatus: 'pending' | 'synced' | 'error';
  syncError?: string;
  airtableId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LaborEntry {
  id: string;
  dailyReportId: string;
  employeeId: string;
  trade: Trade;
  stHours: number;
  otHours: number;
  equipmentId?: string;
  equipmentDescription?: string;
  rentalCompany?: string;
  // Equipment status hours (each split into ST/OT)
  idleStHours: number;
  idleOtHours: number;
  downStHours: number;
  downOtHours: number;
  workStHours: number;
  workOtHours: number;
  // Cost code hours: maps cost code ID to { st, ot } hours
  costCodeHours: Record<string, { st: number; ot: number }>;
  comments?: string;
  airtableId?: string;
}

export interface EquipmentUsage {
  id: string;
  dailyReportId: string;
  rentalCompany?: string;
  equipmentDescription: string;
  idleHours: number;
  downHours: number;
  workHours: number;
  airtableId?: string;
}

export interface SubcontractorWork {
  id: string;
  dailyReportId: string;
  contractorId: string;
  itemsWorked: string;
  production?: string;
  costCodeId?: string;
  airtableId?: string;
}

export interface MaterialDelivered {
  id: string;
  dailyReportId: string;
  supplier: string;
  material: string;
  quantity: string;
  airtableId?: string;
}

export interface JobDiaryEntry {
  id: string;
  dailyReportId: string;
  entryText: string;
  costCodeId?: string;
  loads?: number;
  yield?: number;
  total?: number;
  itemNumber: number;
  airtableId?: string;
}

export interface PhotoAttachment {
  id: string;
  dailyReportId: string;
  diaryEntryId?: string;
  imageData: string; // Base64 encoded
  caption?: string;
  createdAt: string;
  airtableId?: string;
}

export interface EditHistory {
  id: string;
  dailyReportId: string;
  timestamp: string;
  editorId: string;
  fieldChanged: string;
  oldValue?: string;
  newValue?: string;
  airtableId?: string;
}

// Sync queue item
export interface SyncQueueItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  attempts: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}

// Auth session
export interface AuthSession {
  id: string;
  foremanId: string;
  foremanName: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}
