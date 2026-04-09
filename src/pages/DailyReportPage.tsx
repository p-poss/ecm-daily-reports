import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, now, calculateDeadlines, isDeadlinePassed } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SyncIndicator } from '@/components/SyncIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WeatherSelector } from '@/components/WeatherSelector';
import { LaborSection } from '@/components/LaborSection';
import { JobDiarySection } from '@/components/JobDiarySection';
import { SubcontractorsDeliveriesSection } from '@/components/SubcontractorsDeliveriesSection';
import { SignatureCapture } from '@/components/SignatureCapture';
import { PhotoAttachments } from '@/components/PhotoAttachments';
import { DeadlineIndicator } from '@/components/DeadlineIndicator';
import { AIAssistant } from '@/components/AIAssistant';
import { ArrowLeft, BookOpen, Calendar as CalendarIcon, ChevronDown, Undo2, Redo2, File, History, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ReportContext } from '@/lib/ai-assistant';
import type { CostCode, DailyReport, LaborEntry, JobDiaryEntry, SubcontractorWork, MaterialDelivered, EditHistory, Tombstone, Weather } from '@/types';
import { captureSnapshot, getPreviousSnapshot, diffSnapshots } from '@/lib/edit-history';
import { generateReportPDF, type ReportPDFData } from '@/lib/generate-report-pdf';
import { useUndoRedo } from '@/hooks/useUndoRedo';

export function DailyReportPage() {
  const { foreman } = useAuth();
  const { addToQueue } = useSync();
  const { selectedJobId, selectedJobLabel, selectedReportId, copyFromReportId, goBack } = useNavigation();

  // Form state
  const [reportId] = useState(() => selectedReportId || generateId());
  const isNewReport = !selectedReportId && !copyFromReportId;

  const initialLaborEntries: LaborEntry[] = isNewReport ? [{
    id: generateId(),
    dailyReportId: reportId,
    employeeId: '',
    trade: 'N/A' as const,
    stHours: 8,
    otHours: 0,
    equipmentId: undefined,
    rentalCompany: undefined,
    idleStHours: 0,
    idleOtHours: 0,
    downStHours: 0,
    downOtHours: 0,
    workStHours: 0,
    workOtHours: 0,
    costCodeHours: {},
  }] : [];

  const {
    state: formState,
    set,
    setQuiet,
    takeSnapshot,
    reset: _resetForm,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo({
    date: new Date().toISOString().split('T')[0],
    weather: undefined,
    comments: '',
    laborEntries: initialLaborEntries,
    diaryEntries: [],
    subcontractorEntries: [],
    deliveryEntries: [],
    photos: [],
    signature: '',
  });

  const { date, weather, comments, laborEntries, diaryEntries, subcontractorEntries, deliveryEntries, photos, signature } = formState;

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // AI change highlighting
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function addHighlight(id: string) {
    setHighlightedIds((prev) => new Set([...prev, id]));
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedIds(new Set()), 60000);
  }

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);

  // Get job details
  const job = useLiveQuery(async () => {
    if (!selectedJobId) return null;
    return db.jobs.get(selectedJobId);
  }, [selectedJobId]);

  // Get existing report if editing
  const existingReport = useLiveQuery(async () => {
    if (!selectedReportId) return null;
    return db.dailyReports.get(selectedReportId);
  }, [selectedReportId]);

  // Reference data for AI assistant
  const employees = useLiveQuery(() => db.employees.toArray());
  const equipment = useLiveQuery(() => db.equipment.toArray());
  const costCodes = useLiveQuery<CostCode[]>(
    () => (selectedJobId ? db.costCodes.where('jobId').equals(selectedJobId).toArray() : Promise.resolve([])),
    [selectedJobId]
  );
  const subcontractors = useLiveQuery(() => db.subcontractors.toArray());

  // Edit history for the current report
  const editHistory = useLiveQuery(async () => {
    const id = existingReport?.id || reportId;
    const entries = await db.editHistory.where('dailyReportId').equals(id).toArray();
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [existingReport, reportId]);

  const [showHistory, setShowHistory] = useState(true);

  async function handleRevert(snapshotJson: string) {
    if (!confirm('Revert this report to the selected version? Your current changes will be replaced.')) return;
    try {
      const snapshot = JSON.parse(snapshotJson) as import('@/lib/edit-history').ReportSnapshot;
      setQuiet('date', snapshot.report.date);
      setQuiet('weather', snapshot.report.weather as Weather | undefined);
      setQuiet('comments', snapshot.report.comments || '');
      setQuiet('signature', snapshot.report.signatureImage || '');
      setQuiet('laborEntries', snapshot.laborEntries.map((e) => ({
        ...e,
        dailyReportId: existingReport?.id || reportId,
        airtableId: undefined,
      })) as LaborEntry[]);
      setQuiet('diaryEntries', snapshot.diaryEntries.map((e) => ({
        ...e,
        dailyReportId: existingReport?.id || reportId,
        airtableId: undefined,
      })) as JobDiaryEntry[]);
      setQuiet('subcontractorEntries', snapshot.subcontractorEntries.map((e) => ({
        ...e,
        dailyReportId: existingReport?.id || reportId,
        airtableId: undefined,
      })) as SubcontractorWork[]);
      setQuiet('deliveryEntries', snapshot.deliveryEntries.map((e) => ({
        ...e,
        dailyReportId: existingReport?.id || reportId,
        airtableId: undefined,
      })) as MaterialDelivered[]);
      alert('Report reverted. Review the changes and submit when ready.');
    } catch (error) {
      console.error('Revert failed:', error);
      alert('Failed to revert. The snapshot may be corrupted.');
    }
  }

  // Load existing report data
  useEffect(() => {
    if (existingReport && !isLoaded) {
      setQuiet('date', existingReport.date);
      setQuiet('weather', existingReport.weather);
      setQuiet('comments', existingReport.comments || '');
      setQuiet('signature', existingReport.signatureImage || '');
      loadReportData(existingReport.id).then(() => setIsLoaded(true));
    }
  }, [existingReport, isLoaded]);

  // Copy from previous report
  useEffect(() => {
    if (copyFromReportId && !isLoaded && !selectedReportId) {
      copyFromPreviousReport(copyFromReportId).then(() => setIsLoaded(true));
    }
  }, [copyFromReportId, isLoaded, selectedReportId]);

  async function copyFromPreviousReport(sourceReportId: string) {
    try {
      const sourceReport = await db.dailyReports.get(sourceReportId);
      if (!sourceReport) return;

      // Copy weather
      setQuiet('weather', sourceReport.weather);

      // Copy labor entries with new IDs
      const sourceLaborEntries = await db.laborEntries
        .where('dailyReportId')
        .equals(sourceReportId)
        .toArray();

      const copiedLaborEntries: LaborEntry[] = sourceLaborEntries.map((entry) => ({
        ...entry,
        id: generateId(),
        dailyReportId: reportId,
        airtableId: undefined,
      }));

      setQuiet('laborEntries', copiedLaborEntries);

      // Set copied from date for display
      setCopiedFrom(sourceReport.date);
    } catch (error) {
      console.error('Error copying from previous report:', error);
    }
  }

  async function loadReportData(id: string) {
    const [labor, diary, subs, deliveries, attachments] = await Promise.all([
      db.laborEntries.where('dailyReportId').equals(id).toArray(),
      db.jobDiaryEntries.where('dailyReportId').equals(id).toArray(),
      db.subcontractorWork.where('dailyReportId').equals(id).toArray(),
      db.materialsDelivered.where('dailyReportId').equals(id).toArray(),
      db.photoAttachments.where('dailyReportId').equals(id).toArray(),
    ]);
    setQuiet('laborEntries', labor);
    setQuiet('diaryEntries', diary);
    setQuiet('subcontractorEntries', subs);
    setQuiet('deliveryEntries', deliveries);
    setQuiet('photos', attachments);
  }

  // Calculate deadlines
  const deadlines = calculateDeadlines(date);

  // Get day of week
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

  async function saveDraft() {
    if (!foreman || !selectedJobId) return;
    setIsSaving(true);
    try {
      await saveDraftWithoutAlert();
      alert('Draft saved!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Error saving draft. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function submitReport() {
    if (!foreman || !selectedJobId || !signature) {
      alert('Please sign the report before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      // Save first
      await saveDraftWithoutAlert();

      const reportIdToSubmit = existingReport?.id || reportId;

      // Update status to submitted
      // Preserve original submittedAt if re-submitting after edit
      const submittedAt = existingReport?.submittedAt || now();
      const updatedAt = now();
      await db.dailyReports.update(reportIdToSubmit, {
        status: 'Submitted',
        submittedAt,
        updatedAt,
        isDailyLate: isDeadlinePassed(deadlines.dailyDueBy),
        isPayrollLate: isDeadlinePassed(deadlines.payrollDueBy),
        syncStatus: 'pending',
      });

      // Add to sync queue. If the report or child entry already has an
      // airtableId from a previous submission, queue 'update'; otherwise
      // queue 'create'. Tombstones (children removed during this edit
      // session) get drained into 'delete' ops first.
      const report = await db.dailyReports.get(reportIdToSubmit);
      if (report) {
        // Re-fetch children from Dexie so we get the merged airtableIds
        // saveDraftWithoutAlert just wrote (the React state objects also
        // carry them, but Dexie is the canonical source post-save).
        const [childLabor, childDiary, childSubs, childDeliveries] = await Promise.all([
          db.laborEntries.where('dailyReportId').equals(reportIdToSubmit).toArray(),
          db.jobDiaryEntries.where('dailyReportId').equals(reportIdToSubmit).toArray(),
          db.subcontractorWork.where('dailyReportId').equals(reportIdToSubmit).toArray(),
          db.materialsDelivered.where('dailyReportId').equals(reportIdToSubmit).toArray(),
        ]);

        // Drain tombstones first — these are children that were removed
        // during this edit session and had previously synced to Airtable.
        // Queue a delete op for each, then clear the tombstones.
        const tombstones = await db.tombstones
          .where('dailyReportId').equals(reportIdToSubmit).toArray();
        for (const t of tombstones) {
          await addToQueue(t.tableName, t.id, 'delete', { airtableId: t.airtableId });
        }
        if (tombstones.length > 0) {
          await db.tombstones.bulkDelete(tombstones.map((t) => t.id));
        }

        // Parent report. FK fields use camelCase keys (jobId, foremanId)
        // so resolveLinkedFields can find them, translate to airtableIds,
        // and rename to the Airtable display name ('Job', 'Foreman').
        // Non-FK fields use Title Case directly (passed through as-is).
        const reportOp = report.airtableId ? 'update' : 'create';
        await addToQueue('dailyReports', reportIdToSubmit, reportOp, {
          jobId: report.jobId,
          foremanId: report.foremanId,
          'Date': report.date,
          'Day of Week': report.dayOfWeek,
          'Weather': report.weather,
          'Comments': report.comments,
          'Status': 'Submitted',
          'Submitted At': submittedAt,
          'Signature': report.signatureImage,
          'Is Daily Late': report.isDailyLate,
          'Is Payroll Late': report.isPayrollLate,
        });

        // Child rows — FK fields as camelCase, non-FK as Title Case.
        // The resolver translates dailyReportId → 'Daily Report',
        // employeeId → 'Employee', etc. at sync time (lazy resolution).
        // If the parent hasn't been synced yet, the resolver throws and
        // the queue item gets retried once the parent has its airtableId.
        for (const entry of childLabor) {
          const op = entry.airtableId ? 'update' : 'create';
          await addToQueue('laborEntries', entry.id, op, {
            dailyReportId: reportIdToSubmit,
            employeeId: entry.employeeId,
            equipmentId: entry.equipmentId,
            'Trade': entry.trade,
            'ST Hours': entry.stHours,
            'OT Hours': entry.otHours,
            'Rental Company': entry.rentalCompany,
            'Idle ST Hours': entry.idleStHours,
            'Idle OT Hours': entry.idleOtHours,
            'Down ST Hours': entry.downStHours,
            'Down OT Hours': entry.downOtHours,
            'Work ST Hours': entry.workStHours,
            'Work OT Hours': entry.workOtHours,
          });
        }

        for (const entry of childDiary) {
          const op = entry.airtableId ? 'update' : 'create';
          await addToQueue('jobDiaryEntries', entry.id, op, {
            dailyReportId: reportIdToSubmit,
            costCodeId: entry.costCodeId,
            'Entry Text': entry.entryText,
            'Item Number': entry.itemNumber,
          });
        }

        for (const entry of childSubs) {
          const op = entry.airtableId ? 'update' : 'create';
          await addToQueue('subcontractorWork', entry.id, op, {
            dailyReportId: reportIdToSubmit,
            contractorId: entry.contractorId,
            'Items Worked': entry.itemsWorked,
            'Production': entry.production,
          });
        }

        for (const entry of childDeliveries) {
          const op = entry.airtableId ? 'update' : 'create';
          await addToQueue('materialsDelivered', entry.id, op, {
            dailyReportId: reportIdToSubmit,
            'Supplier': entry.supplier,
            'Material': entry.material,
            'Quantity': entry.quantity,
          });
        }

        // TODO(tier-2): Photo sync needs an external storage host
        // (S3/Cloudinary) so we can pass URLs to Airtable's Attachment
        // field. Base64 in IndexedDB is too large to store in a text
        // field, and Airtable attachments can't accept base64 directly.
        // Photos remain local-only until that infrastructure is built.

        // Record edit history — capture a snapshot of the current state
        // and diff it against the previous snapshot (if any).
        const currentSnapshot = await captureSnapshot(reportIdToSubmit);
        if (currentSnapshot) {
          const prevSnapshot = await getPreviousSnapshot(reportIdToSubmit);
          const changes = await diffSnapshots(prevSnapshot, currentSnapshot);
          const historyEntry: EditHistory = {
            id: generateId(),
            dailyReportId: reportIdToSubmit,
            timestamp: now(),
            editorId: foreman.id,
            changes: JSON.stringify(changes),
            snapshot: JSON.stringify(currentSnapshot),
          };
          await db.editHistory.add(historyEntry);
          await addToQueue('editHistory', historyEntry.id, 'create', {
            dailyReportId: reportIdToSubmit,
            editorId: foreman.id,
            'Timestamp': historyEntry.timestamp,
            'Changes': changes.map((c) =>
              c.oldValue != null && c.newValue != null
                ? `${c.field}: ${c.oldValue} → ${c.newValue}`
                : c.oldValue != null
                ? `${c.field}: removed ${c.oldValue}`
                : `${c.field}: ${c.newValue || ''}`
            ).join('\n'),
            'Snapshot': historyEntry.snapshot,
          });
        }
      }

      alert('Report submitted successfully!');
      goBack();
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveDraftWithoutAlert() {
    if (!foreman || !selectedJobId) return;

    const report: DailyReport = {
      id: existingReport?.id || reportId,
      // Preserve fields that aren't part of the form so put() doesn't
      // wipe them. airtableId is the load-bearing one — without it,
      // submitReport can't tell that a previously-synced report exists
      // and ends up creating a duplicate in Airtable on re-submission.
      airtableId: existingReport?.airtableId,
      submittedAt: existingReport?.submittedAt,
      jobId: selectedJobId,
      date,
      dayOfWeek,
      foremanId: foreman.id,
      weather,
      comments: comments || undefined,
      status: 'Draft',
      signatureImage: signature,
      lastEditorId: foreman.id,
      editCount: (existingReport?.editCount || 0) + 1,
      dailyDueBy: deadlines.dailyDueBy,
      isDailyLate: isDeadlinePassed(deadlines.dailyDueBy),
      payrollWeekEnding: deadlines.payrollWeekEnding,
      payrollDueBy: deadlines.payrollDueBy,
      isPayrollLate: isDeadlinePassed(deadlines.payrollDueBy),
      syncStatus: 'pending',
      createdAt: existingReport?.createdAt || now(),
      updatedAt: now(),
    };

    await db.dailyReports.put(report);

    // Helper: capture tombstones for any rows that exist in Dexie but
    // aren't in the new state and have an airtableId. The next submit
    // will drain these into 'delete' sync ops so the orphaned Airtable
    // rows get cleaned up.
    async function captureTombstones<T extends { id: string; airtableId?: string }>(
      tableName: string,
      existingFromDexie: T[],
      newFromState: T[]
    ): Promise<void> {
      const newIds = new Set(newFromState.map((e) => e.id));
      const removedWithAirtableId = existingFromDexie.filter(
        (e) => !newIds.has(e.id) && e.airtableId
      );
      if (removedWithAirtableId.length === 0) return;
      const tombstones: Tombstone[] = removedWithAirtableId.map((e) => ({
        id: generateId(),
        dailyReportId: report.id,
        tableName,
        airtableId: e.airtableId!,
        createdAt: now(),
      }));
      await db.tombstones.bulkAdd(tombstones);
    }

    // Snapshot existing children BEFORE the destructive delete so we can
    // diff against the new state and create tombstones for the removals.
    const [
      existingLabor,
      existingDiary,
      existingSubs,
      existingDeliveries,
    ] = await Promise.all([
      db.laborEntries.where('dailyReportId').equals(report.id).toArray(),
      db.jobDiaryEntries.where('dailyReportId').equals(report.id).toArray(),
      db.subcontractorWork.where('dailyReportId').equals(report.id).toArray(),
      db.materialsDelivered.where('dailyReportId').equals(report.id).toArray(),
    ]);

    await Promise.all([
      captureTombstones('laborEntries', existingLabor, laborEntries),
      captureTombstones('jobDiaryEntries', existingDiary, diaryEntries),
      captureTombstones('subcontractorWork', existingSubs, subcontractorEntries),
      captureTombstones('materialsDelivered', existingDeliveries, deliveryEntries),
    ]);

    await db.laborEntries.where('dailyReportId').equals(report.id).delete();
    if (laborEntries.length > 0) {
      await db.laborEntries.bulkPut(
        laborEntries.map((e) => ({ ...e, dailyReportId: report.id }))
      );
    }

    await db.jobDiaryEntries.where('dailyReportId').equals(report.id).delete();
    if (diaryEntries.length > 0) {
      await db.jobDiaryEntries.bulkPut(
        diaryEntries.map((e) => ({ ...e, dailyReportId: report.id }))
      );
    }

    await db.subcontractorWork.where('dailyReportId').equals(report.id).delete();
    if (subcontractorEntries.length > 0) {
      await db.subcontractorWork.bulkPut(
        subcontractorEntries.map((e) => ({ ...e, dailyReportId: report.id }))
      );
    }

    await db.materialsDelivered.where('dailyReportId').equals(report.id).delete();
    if (deliveryEntries.length > 0) {
      await db.materialsDelivered.bulkPut(
        deliveryEntries.map((e) => ({ ...e, dailyReportId: report.id }))
      );
    }

    await db.photoAttachments.where('dailyReportId').equals(report.id).delete();
    if (photos.length > 0) {
      await db.photoAttachments.bulkPut(
        photos.map((p) => ({ ...p, dailyReportId: report.id }))
      );
    }
  }

  function handleViewPDF() {
    // Collect active cost codes from labor entries
    const usedCostCodeIds = new Set<string>();
    for (const entry of laborEntries) {
      for (const ccId of Object.keys(entry.costCodeHours)) {
        const h = entry.costCodeHours[ccId];
        if (h.st || h.ot) usedCostCodeIds.add(ccId);
      }
    }
    const activeCostCodes = (costCodes || []).filter((c) => usedCostCodeIds.has(c.id));

    const pdfData: ReportPDFData = {
      jobNumber: job?.jobNumber || '',
      jobName: job?.jobName || '',
      date,
      dayOfWeek,
      foremanName: foreman?.name || '',
      weather,
      comments,
      laborEntries: laborEntries.map((e) => {
        const emp = (employees || []).find((emp) => emp.id === e.employeeId);
        const equip = e.equipmentId ? (equipment || []).find((eq) => eq.id === e.equipmentId) : null;
        return {
          employeeName: emp?.name || '',
          trade: e.trade,
          stHours: e.stHours,
          otHours: e.otHours,
          equipmentNumber: equip?.equipmentNumber,
          rentalCompany: e.rentalCompany,
          equipmentDescription: e.equipmentDescription,
          idleStHours: e.idleStHours,
          idleOtHours: e.idleOtHours,
          downStHours: e.downStHours,
          downOtHours: e.downOtHours,
          workStHours: e.workStHours,
          workOtHours: e.workOtHours,
          costCodeHours: e.costCodeHours,
        };
      }),
      costCodes: activeCostCodes,
      subcontractors: subcontractorEntries.map((e) => ({
        contractorName: (subcontractors || []).find((s) => s.id === e.contractorId)?.name || '',
        itemsWorked: e.itemsWorked,
        production: e.production,
      })),
      deliveries: deliveryEntries.map((e) => ({
        supplier: e.supplier,
        material: e.material,
        quantity: e.quantity,
      })),
      diaryEntries: diaryEntries.map((e) => ({
        itemNumber: e.itemNumber,
        entryText: e.entryText,
        costCodeId: e.costCodeId,
        costCodeDescription: e.costCodeId
          ? (costCodes || []).find((c) => c.id === e.costCodeId)?.description
          : undefined,
      })),
    };

    const blobUrl = generateReportPDF(pdfData);
    window.open(blobUrl, '_blank');
  }

  const isEditing = !!selectedReportId;
  const currentReportId = existingReport?.id || reportId;

  // AI Assistant context
  const aiContext: ReportContext = {
    jobNumber: job?.jobNumber || '',
    jobName: job?.jobName || '',
    date,
    weather,
    comments,
    laborEntries: laborEntries.map((e, i) => ({
      index: i,
      employeeName: (employees || []).find((emp) => emp.id === e.employeeId)?.name || 'Unknown',
      employeeId: e.employeeId,
      trade: e.trade,
      stHours: e.stHours,
      otHours: e.otHours,
      equipmentId: e.equipmentId,
      equipmentNumber: (equipment || []).find((eq) => eq.id === e.equipmentId)?.equipmentNumber,
      rentalCompany: e.rentalCompany,
      equipmentDescription: e.equipmentDescription,
    })),
    diaryEntries: diaryEntries.map((e, i) => ({
      index: i,
      entryText: e.entryText,
      costCode: e.costCodeId ? (costCodes || []).find((c) => c.id === e.costCodeId)?.code : undefined,
      loads: e.loads,
      yield: e.yield,
      total: e.total,
    })),
    subcontractorEntries: subcontractorEntries.map((e, i) => ({
      index: i,
      contractorName: (subcontractors || []).find((s) => s.id === e.contractorId)?.name || 'Unknown',
      contractorId: e.contractorId,
      itemsWorked: e.itemsWorked,
      production: e.production,
      costCode: e.costCodeId ? (costCodes || []).find((c) => c.id === e.costCodeId)?.code : undefined,
    })),
    deliveryEntries: deliveryEntries.map((e, i) => ({
      index: i,
      supplier: e.supplier,
      material: e.material,
      quantity: e.quantity,
    })),
    photos: photos.map((p, i) => ({
      index: i,
      caption: p.caption,
    })),
    availableEmployees: (employees || []).map((e) => ({ id: e.id, name: e.name, trade: e.trade })),
    availableEquipment: (equipment || []).map((e) => ({ id: e.id, equipmentNumber: e.equipmentNumber, description: e.description })),
    availableCostCodes: (costCodes || []).map((c) => ({ id: c.id, code: c.code, description: c.description })),
    availableSubcontractors: (subcontractors || []).map((s) => ({ id: s.id, name: s.name })),
  };

  const handleAIToolCall = useCallback((name: string, input: Record<string, unknown>) => {
    // Defensive: the AI sometimes passes the cost code's numeric `code`
    // (e.g. "1100") instead of the canonical UUID `id`. Resolve either
    // form to the UUID by looking it up in the loaded cost codes. Returns
    // undefined for null/undefined input. Pass-through if no match —
    // better to write a stale value than silently drop the field.
    function resolveCostCodeId(raw: unknown): string | undefined {
      if (raw == null || raw === '') return undefined;
      if (typeof raw !== 'string') return undefined;
      const list = costCodes || [];
      // Direct ID hit
      if (list.some((c) => c.id === raw)) return raw;
      // Code number fallback
      const byCode = list.find((c) => c.code === raw);
      if (byCode) return byCode.id;
      return raw;
    }

    switch (name) {
      case 'set_date':
        setQuiet('date', input.date as string);
        addHighlight('__date__');
        break;
      case 'set_weather':
        setQuiet('weather', input.weather as Weather);
        addHighlight('__weather__');
        break;
      case 'set_comments':
        setQuiet('comments', input.comments as string);
        addHighlight('__comments__');
        break;
      case 'add_labor_entry': {
        const emp = (employees || []).find((e) => e.id === input.employeeId);
        const newEntry: LaborEntry = {
          id: generateId(),
          dailyReportId: currentReportId,
          employeeId: (input.employeeId as string) || '',
          trade: (input.trade as string) || emp?.trade || 'LB',
          stHours: (input.stHours as number) ?? 8,
          otHours: (input.otHours as number) ?? 0,
          equipmentId: input.equipmentId as string | undefined,
          rentalCompany: input.rentalCompany as string | undefined,
          equipmentDescription: input.equipmentDescription as string | undefined,
          idleStHours: 0,
          idleOtHours: 0,
          downStHours: 0,
          downOtHours: 0,
          workStHours: 0,
          workOtHours: 0,
          costCodeHours: {},
        };
        setQuiet('laborEntries', [...laborEntries, newEntry]);
        addHighlight(newEntry.id);
        break;
      }
      case 'update_labor_entry': {
        const idx = input.index as number;
        if (laborEntries[idx]) addHighlight(laborEntries[idx].id);
        const updated = [...laborEntries];
        if (updated[idx]) {
          const updates: Partial<LaborEntry> = {};
          if (input.employeeId !== undefined) updates.employeeId = input.employeeId as string;
          if (input.trade !== undefined) updates.trade = input.trade as string;
          if (input.stHours !== undefined) updates.stHours = input.stHours as number;
          if (input.otHours !== undefined) updates.otHours = input.otHours as number;
          if (input.equipmentId !== undefined) updates.equipmentId = input.equipmentId as string;
          if (input.rentalCompany !== undefined) updates.rentalCompany = input.rentalCompany as string;
          if (input.equipmentDescription !== undefined) updates.equipmentDescription = input.equipmentDescription as string;
          updated[idx] = { ...updated[idx], ...updates };
        }
        setQuiet('laborEntries', updated);
        break;
      }
      case 'remove_labor_entry': {
        const idx = input.index as number;
        setQuiet('laborEntries', laborEntries.filter((_, i) => i !== idx));
        break;
      }
      case 'add_diary_entry': {
        const newEntry: JobDiaryEntry = {
          id: generateId(),
          dailyReportId: currentReportId,
          entryText: (input.entryText as string) || '',
          costCodeId: resolveCostCodeId(input.costCodeId),
          loads: input.loads as number | undefined,
          yield: input.yield as number | undefined,
          total: input.loads && input.yield ? (input.loads as number) * (input.yield as number) : undefined,
          itemNumber: diaryEntries.length + 1,
        };
        setQuiet('diaryEntries', [...diaryEntries, newEntry]);
        // Highlight every field that has a non-empty value on the new entry.
        if (newEntry.entryText) addHighlight(`${newEntry.id}.entryText`);
        if (newEntry.costCodeId) addHighlight(`${newEntry.id}.costCodeId`);
        if (newEntry.loads !== undefined) addHighlight(`${newEntry.id}.loads`);
        if (newEntry.yield !== undefined) addHighlight(`${newEntry.id}.yield`);
        break;
      }
      case 'update_diary_entry': {
        const idx = input.index as number;
        const updated = [...diaryEntries];
        if (updated[idx]) {
          const updates: Partial<JobDiaryEntry> = {};
          if (input.entryText !== undefined) {
            updates.entryText = input.entryText as string;
            addHighlight(`${updated[idx].id}.entryText`);
          }
          if (input.costCodeId !== undefined) {
            updates.costCodeId = resolveCostCodeId(input.costCodeId);
            addHighlight(`${updated[idx].id}.costCodeId`);
          }
          if (input.loads !== undefined) {
            updates.loads = input.loads as number;
            addHighlight(`${updated[idx].id}.loads`);
          }
          if (input.yield !== undefined) {
            updates.yield = input.yield as number;
            addHighlight(`${updated[idx].id}.yield`);
          }
          updated[idx] = { ...updated[idx], ...updates };
        }
        setQuiet('diaryEntries', updated);
        break;
      }
      case 'remove_diary_entry': {
        const idx = input.index as number;
        setQuiet('diaryEntries', diaryEntries.filter((_, i) => i !== idx));
        break;
      }
      case 'add_subcontractor_entry': {
        const newEntry: SubcontractorWork = {
          id: generateId(),
          dailyReportId: currentReportId,
          contractorId: (input.contractorId as string) || '',
          itemsWorked: (input.itemsWorked as string) || '',
          production: input.production as string | undefined,
          costCodeId: resolveCostCodeId(input.costCodeId),
        };
        setQuiet('subcontractorEntries', [...subcontractorEntries, newEntry]);
        if (newEntry.contractorId) addHighlight(`${newEntry.id}.contractorId`);
        if (newEntry.itemsWorked) addHighlight(`${newEntry.id}.itemsWorked`);
        if (newEntry.production) addHighlight(`${newEntry.id}.production`);
        if (newEntry.costCodeId) addHighlight(`${newEntry.id}.costCodeId`);
        break;
      }
      case 'update_subcontractor_entry': {
        const idx = input.index as number;
        const updated = [...subcontractorEntries];
        if (updated[idx]) {
          const updates: Partial<SubcontractorWork> = {};
          if (input.contractorId !== undefined) {
            updates.contractorId = input.contractorId as string;
            addHighlight(`${updated[idx].id}.contractorId`);
          }
          if (input.itemsWorked !== undefined) {
            updates.itemsWorked = input.itemsWorked as string;
            addHighlight(`${updated[idx].id}.itemsWorked`);
          }
          if (input.production !== undefined) {
            updates.production = input.production as string;
            addHighlight(`${updated[idx].id}.production`);
          }
          if (input.costCodeId !== undefined) {
            updates.costCodeId = resolveCostCodeId(input.costCodeId);
            addHighlight(`${updated[idx].id}.costCodeId`);
          }
          updated[idx] = { ...updated[idx], ...updates };
        }
        setQuiet('subcontractorEntries', updated);
        break;
      }
      case 'remove_subcontractor_entry': {
        const idx = input.index as number;
        setQuiet('subcontractorEntries', subcontractorEntries.filter((_, i) => i !== idx));
        break;
      }
      case 'add_delivery_entry': {
        const newEntry: MaterialDelivered = {
          id: generateId(),
          dailyReportId: currentReportId,
          supplier: (input.supplier as string) || '',
          material: (input.material as string) || '',
          quantity: (input.quantity as string) || '',
        };
        setQuiet('deliveryEntries', [...deliveryEntries, newEntry]);
        if (newEntry.supplier) addHighlight(`${newEntry.id}.supplier`);
        if (newEntry.material) addHighlight(`${newEntry.id}.material`);
        if (newEntry.quantity) addHighlight(`${newEntry.id}.quantity`);
        break;
      }
      case 'update_delivery_entry': {
        const idx = input.index as number;
        const updated = [...deliveryEntries];
        if (updated[idx]) {
          const updates: Partial<MaterialDelivered> = {};
          if (input.supplier !== undefined) {
            updates.supplier = input.supplier as string;
            addHighlight(`${updated[idx].id}.supplier`);
          }
          if (input.material !== undefined) {
            updates.material = input.material as string;
            addHighlight(`${updated[idx].id}.material`);
          }
          if (input.quantity !== undefined) {
            updates.quantity = input.quantity as string;
            addHighlight(`${updated[idx].id}.quantity`);
          }
          updated[idx] = { ...updated[idx], ...updates };
        }
        setQuiet('deliveryEntries', updated);
        break;
      }
      case 'remove_delivery_entry': {
        const idx = input.index as number;
        setQuiet('deliveryEntries', deliveryEntries.filter((_, i) => i !== idx));
        break;
      }
      case 'set_photo_caption': {
        const idx = input.index as number;
        const caption = input.caption as string;
        if (photos[idx]) {
          addHighlight(photos[idx].id);
          const updated = [...photos];
          updated[idx] = { ...updated[idx], caption };
          setQuiet('photos', updated);
        }
        break;
      }
    }
  }, [formState, setQuiet, employees, reportId]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="bg-card/60 backdrop-blur-md p-4 fixed top-0 left-0 right-0 z-10 ring-2 ring-foreground/10 rounded-b-[16px]">
        <div className="flex items-start max-w-7xl mx-auto relative">
          <Button
            variant="outline"
            onClick={goBack}
            className="flex items-center gap-2 absolute left-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="md:hidden">Back</span><span className="hidden md:inline">Reports</span>
          </Button>
          <div className="flex-1 text-center min-w-0 px-[100px] pt-2 md:pt-0">
            <h1 className="text-sm md:text-lg font-bold text-foreground">
              {isEditing ? 'Edit Report' : 'New Report'}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {job ? `${job.jobNumber} · ${job.jobName}` : selectedJobLabel || '\u00A0'}
            </p>
            {copiedFrom && (
              <p className="text-sm text-primary mt-1">
                Copied from {new Date(copiedFrom).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 absolute right-0">
            <SyncIndicator />
            <div className="hidden md:block w-px h-4 bg-border" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content — wait for existing report data to load before
          rendering so the form fields don't shift as they fill in.
          New reports (no selectedReportId) render immediately. */}
      {(selectedReportId && !isLoaded) ? (
        <main className="max-w-[82rem] mx-auto p-4 pb-24 pt-[200px]" />
      ) : (
      <main className="max-w-[82rem] mx-auto p-4 pb-24 pt-[200px] animate-in fade-in duration-300">
        <Separator className="h-[2px] bg-primary" />

        {/* Date and Weather */}
        <div className="space-y-[20px] mt-[20px]">
          <h2 className="text-lg font-semibold flex items-center gap-2 px-4 text-primary"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><BookOpen className="w-3 h-3" /></span>General</h2>
          <Card>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-between text-left font-normal text-base md:text-xs/relaxed bg-input/20 border-input hover:bg-input/20 hover:text-current overflow-hidden",
                        !date && "text-muted-foreground",
                        highlightedIds.has('__date__') && "ai-highlight"
                      )}
                      disabled={isEditing && existingReport?.status === 'Submitted'}
                    >
                      <span className="flex items-center min-w-0 truncate">
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {date ? (
                          <>
                            {format(new Date(date + 'T00:00:00'), "MM/dd/yyyy")} - {dayOfWeek}
                          </>
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date ? new Date(date + 'T00:00:00') : undefined}
                      onSelect={(selectedDate) => {
                        if (selectedDate) {
                          set('date', format(selectedDate, 'yyyy-MM-dd'));
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <WeatherSelector value={weather} onChange={(w) => set('weather', w)} highlighted={highlightedIds.has('__weather__')} />
            </div>

            {/* Comments */}
            <div className="space-y-2 pb-4">
              <Label>Comments (optional)</Label>
              <Textarea
                value={comments}
                onChange={(e) => setQuiet('comments', e.target.value)}
                onBlur={() => takeSnapshot()}
                placeholder="Additional notes or comments..."
                rows={3}
                className={cn("text-base resize-none", highlightedIds.has('__comments__') && "ai-highlight")}
              />
            </div>

            <div>
              <DeadlineIndicator
                dailyDueBy={deadlines.dailyDueBy}
                payrollDueBy={deadlines.payrollDueBy}
                status={existingReport?.status || 'Draft'}
                submittedAt={existingReport?.submittedAt}
              />
            </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="h-[2px] bg-primary mt-[90px]" />

        {/* Labor Section */}
        <div className="mt-[20px]">
        <LaborSection
          entries={laborEntries}
          onChange={(entries) => set('laborEntries', entries)}
          dailyReportId={currentReportId}
          jobId={selectedJobId || ''}
          highlightedIds={highlightedIds}
        />
        </div>

        <Separator className="h-[2px] bg-primary mt-[90px]" />

        {/* Job Diary Section */}
        <div className="mt-[20px]">
        <JobDiarySection
          entries={diaryEntries}
          onChange={(entries) => set('diaryEntries', entries)}
          dailyReportId={currentReportId}
          jobId={selectedJobId || ''}
          highlightedIds={highlightedIds}
        />
        </div>

        <Separator className="h-[2px] bg-primary mt-[90px]" />

        {/* Subcontractors + Deliveries */}
        <div className="mt-[20px]">
        <SubcontractorsDeliveriesSection
          subcontractorEntries={subcontractorEntries}
          deliveryEntries={deliveryEntries}
          onSubcontractorsChange={(entries) => set('subcontractorEntries', entries)}
          onDeliveriesChange={(entries) => set('deliveryEntries', entries)}
          dailyReportId={currentReportId}
          jobId={selectedJobId || ''}
          highlightedIds={highlightedIds}
        />
        </div>

        <Separator className="h-[2px] bg-primary mt-[90px]" />

        {/* Photo Attachments */}
        <div className="mt-[20px]">
        <PhotoAttachments
          photos={photos}
          onChange={(p) => set('photos', p)}
          dailyReportId={currentReportId}
        />
        </div>

        {/* Edit History */}
        {editHistory && editHistory.length > 0 && (
          <>
            <Separator className="h-[2px] bg-primary mt-[90px]" />
            <div className="mt-[20px] space-y-[20px]">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-lg font-semibold flex items-center gap-2 px-4 text-primary cursor-pointer hover:opacity-80 w-full text-left"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                  <History className="w-3 h-3" />
                </span>
                Edit History ({editHistory.length})
                <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform', showHistory && 'rotate-180')} />
              </button>
              {showHistory && (
                <Card>
                  <CardContent className="space-y-0 divide-y">
                    {editHistory.map((entry, idx) => {
                      const changes: import('@/types').EditHistoryChange[] = (() => {
                        try { return JSON.parse(entry.changes); } catch { return []; }
                      })();
                      const editor = (employees || []).find((e) => e.id === entry.editorId);
                      const isLatest = idx === 0;
                      return (
                        <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs">
                              <span className="font-medium">{editor?.name || 'Unknown'}</span>
                              <span className="text-muted-foreground ml-2">
                                {new Date(entry.timestamp).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                })}
                              </span>
                              {isLatest && <span className="text-muted-foreground ml-2">(current)</span>}
                            </div>
                            {!isLatest && (
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => handleRevert(entry.snapshot)}
                                className="text-[10px] gap-1"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                Revert
                              </Button>
                            )}
                          </div>
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {changes.map((c, i) => (
                              <li key={i}>
                                {c.oldValue != null && c.newValue != null ? (
                                  <>{c.field}: <span className="line-through opacity-60">{c.oldValue}</span> → <span className="text-foreground">{c.newValue}</span></>
                                ) : c.oldValue != null ? (
                                  <>{c.field}: <span className="line-through opacity-60">{c.oldValue}</span></>
                                ) : (
                                  <>{c.field}{c.newValue ? `: ${c.newValue}` : ''}</>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        <Separator className="h-[2px] bg-primary mt-[90px]" />

        {/* Signature */}
        <div className="mt-[20px]">
        <SignatureCapture
          value={signature}
          onChange={(sig) => set('signature', sig)}
        />
        </div>
      </main>
      )}

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-card/60 backdrop-blur-md p-4 pb-6 md:pb-4 safe-area-inset-bottom ring-2 ring-foreground/10 rounded-t-[16px]">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-3 items-center">
          {/* Undo/Redo */}
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="flex-1 flex items-center justify-center h-9 md:h-8 hover:bg-input/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer border-r border-border"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="flex-1 flex items-center justify-center h-9 md:h-8 hover:bg-input/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <Button
            variant="outline"
            className="min-w-0 overflow-hidden"
            onClick={handleViewPDF}
          >
            <File className="w-4 h-4 shrink-0" />
            <span className="truncate">PDF</span>
          </Button>
          <Button
            variant="outline"
            className="min-w-0 overflow-hidden btn-action"
            onClick={saveDraft}
            disabled={isSaving}
          >
            <span className="truncate">{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </Button>
          <Button
            className="min-w-0 overflow-hidden"
            onClick={submitReport}
            disabled={!signature || isSubmitting}
          >
            <span className="truncate">{isSubmitting ? 'Submitting...' : 'Submit'}</span>
          </Button>
        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant context={aiContext} onToolCall={handleAIToolCall} onBeforeToolCalls={takeSnapshot} />
    </div>
  );
}
