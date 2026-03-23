import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId, now, calculateDeadlines, isDeadlinePassed } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, BookOpen, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ReportContext } from '@/lib/ai-assistant';
import type { DailyReport, LaborEntry, JobDiaryEntry, SubcontractorWork, MaterialDelivered, PhotoAttachment, Weather } from '@/types';
import { generateReportPDF, type ReportPDFData } from '@/lib/generate-report-pdf';

export function DailyReportPage() {
  const { foreman } = useAuth();
  const { addToQueue } = useSync();
  const { selectedJobId, selectedReportId, copyFromReportId, goBack } = useNavigation();

  // Form state
  const [reportId] = useState(() => selectedReportId || generateId());
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState<Weather | undefined>();
  const [comments, setComments] = useState('');
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<JobDiaryEntry[]>([]);
  const [subcontractorEntries, setSubcontractorEntries] = useState<SubcontractorWork[]>([]);
  const [deliveryEntries, setDeliveryEntries] = useState<MaterialDelivered[]>([]);
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [signature, setSignature] = useState('');
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
  const costCodes = useLiveQuery(() => db.costCodes.toArray());
  const subcontractors = useLiveQuery(() => db.subcontractors.toArray());

  // Load existing report data
  useEffect(() => {
    if (existingReport && !isLoaded) {
      setDate(existingReport.date);
      setWeather(existingReport.weather);
      setComments(existingReport.comments || '');
      setSignature(existingReport.signatureImage || '');
      loadReportData(existingReport.id);
      setIsLoaded(true);
    }
  }, [existingReport, isLoaded]);

  // Copy from previous report
  useEffect(() => {
    if (copyFromReportId && !isLoaded && !selectedReportId) {
      copyFromPreviousReport(copyFromReportId);
      setIsLoaded(true);
    }
  }, [copyFromReportId, isLoaded, selectedReportId]);

  async function copyFromPreviousReport(sourceReportId: string) {
    try {
      const sourceReport = await db.dailyReports.get(sourceReportId);
      if (!sourceReport) return;

      // Copy weather
      setWeather(sourceReport.weather);

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

      setLaborEntries(copiedLaborEntries);

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
    setLaborEntries(labor);
    setDiaryEntries(diary);
    setSubcontractorEntries(subs);
    setDeliveryEntries(deliveries);
    setPhotos(attachments);
  }

  // Calculate deadlines
  const deadlines = calculateDeadlines(date);

  // Get day of week
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

  async function saveDraft() {
    if (!foreman || !selectedJobId) return;

    setIsSaving(true);

    try {
      const report: DailyReport = {
        id: existingReport?.id || reportId,
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

      // Save report
      await db.dailyReports.put(report);

      // Save labor entries
      await db.laborEntries.where('dailyReportId').equals(report.id).delete();
      if (laborEntries.length > 0) {
        await db.laborEntries.bulkPut(
          laborEntries.map((e) => ({ ...e, dailyReportId: report.id }))
        );
      }

      // Save diary entries
      await db.jobDiaryEntries.where('dailyReportId').equals(report.id).delete();
      if (diaryEntries.length > 0) {
        await db.jobDiaryEntries.bulkPut(
          diaryEntries.map((e) => ({ ...e, dailyReportId: report.id }))
        );
      }

      // Save subcontractor entries
      await db.subcontractorWork.where('dailyReportId').equals(report.id).delete();
      if (subcontractorEntries.length > 0) {
        await db.subcontractorWork.bulkPut(
          subcontractorEntries.map((e) => ({ ...e, dailyReportId: report.id }))
        );
      }

      // Save delivery entries
      await db.materialsDelivered.where('dailyReportId').equals(report.id).delete();
      if (deliveryEntries.length > 0) {
        await db.materialsDelivered.bulkPut(
          deliveryEntries.map((e) => ({ ...e, dailyReportId: report.id }))
        );
      }

      // Save photos
      await db.photoAttachments.where('dailyReportId').equals(report.id).delete();
      if (photos.length > 0) {
        await db.photoAttachments.bulkPut(
          photos.map((p) => ({ ...p, dailyReportId: report.id }))
        );
      }

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
      const submittedAt = now();
      await db.dailyReports.update(reportIdToSubmit, {
        status: 'Submitted',
        submittedAt,
        isDailyLate: isDeadlinePassed(deadlines.dailyDueBy),
        isPayrollLate: isDeadlinePassed(deadlines.payrollDueBy),
        syncStatus: 'pending',
      });

      // Add to sync queue
      const report = await db.dailyReports.get(reportIdToSubmit);
      if (report) {
        await addToQueue('dailyReports', reportIdToSubmit, 'create', {
          'Job': report.jobId,
          'Date': report.date,
          'Day of Week': report.dayOfWeek,
          'Foreman': report.foremanId,
          'Weather': report.weather,
          'Comments': report.comments,
          'Status': 'Submitted',
          'Submitted At': submittedAt,
          'Signature': report.signatureImage,
          'Is Daily Late': report.isDailyLate,
          'Is Payroll Late': report.isPayrollLate,
        });

        // Add labor entries to queue
        for (const entry of laborEntries) {
          await addToQueue('laborEntries', entry.id, 'create', {
            'Daily Report': reportIdToSubmit,
            'Employee': entry.employeeId,
            'Trade': entry.trade,
            'ST Hours': entry.stHours,
            'OT Hours': entry.otHours,
            'Equipment': entry.equipmentId,
            'Rental Company': entry.rentalCompany,
            'Idle ST Hours': entry.idleStHours,
            'Idle OT Hours': entry.idleOtHours,
            'Down ST Hours': entry.downStHours,
            'Down OT Hours': entry.downOtHours,
            'Work ST Hours': entry.workStHours,
            'Work OT Hours': entry.workOtHours,
            'Cost Code Hours': entry.costCodeHours,
          });
        }

        // Add diary entries to queue
        for (const entry of diaryEntries) {
          await addToQueue('jobDiaryEntries', entry.id, 'create', {
            'Daily Report': reportIdToSubmit,
            'Entry Text': entry.entryText,
            'Cost Code': entry.costCodeId,
            'Item Number': entry.itemNumber,
          });
        }

        // Add subcontractor work to queue
        for (const entry of subcontractorEntries) {
          await addToQueue('subcontractorWork', entry.id, 'create', {
            'Daily Report': reportIdToSubmit,
            'Contractor': entry.contractorId,
            'Items Worked': entry.itemsWorked,
            'Production': entry.production,
          });
        }

        // Add material deliveries to queue
        for (const entry of deliveryEntries) {
          await addToQueue('materialsDelivered', entry.id, 'create', {
            'Daily Report': reportIdToSubmit,
            'Supplier': entry.supplier,
            'Material': entry.material,
            'Quantity': entry.quantity,
          });
        }

        // Add photos to queue
        for (const photo of photos) {
          await addToQueue('photoAttachments', photo.id, 'create', {
            'Daily Report': reportIdToSubmit,
            'Image Data': photo.imageData,
            'Caption': photo.caption,
            'Created At': photo.createdAt,
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
    availableEmployees: (employees || []).map((e) => ({ id: e.id, name: e.name, trade: e.trade })),
    availableEquipment: (equipment || []).map((e) => ({ id: e.id, equipmentNumber: e.equipmentNumber, description: e.description })),
    availableCostCodes: (costCodes || []).map((c) => ({ id: c.id, code: c.code, description: c.description })),
    availableSubcontractors: (subcontractors || []).map((s) => ({ id: s.id, name: s.name })),
  };

  function handleAIToolCall(name: string, input: Record<string, unknown>) {
    switch (name) {
      case 'set_date':
        setDate(input.date as string);
        break;
      case 'set_weather':
        setWeather(input.weather as Weather);
        break;
      case 'set_comments':
        setComments(input.comments as string);
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
        setLaborEntries((prev) => [...prev, newEntry]);
        break;
      }
      case 'update_labor_entry': {
        const idx = input.index as number;
        setLaborEntries((prev) => {
          const updated = [...prev];
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
          return updated;
        });
        break;
      }
      case 'remove_labor_entry': {
        const idx = input.index as number;
        setLaborEntries((prev) => prev.filter((_, i) => i !== idx));
        break;
      }
      case 'add_diary_entry': {
        const newEntry: JobDiaryEntry = {
          id: generateId(),
          dailyReportId: currentReportId,
          entryText: (input.entryText as string) || '',
          costCodeId: input.costCodeId as string | undefined,
          loads: input.loads as number | undefined,
          yield: input.yield as number | undefined,
          total: input.loads && input.yield ? (input.loads as number) * (input.yield as number) : undefined,
          itemNumber: diaryEntries.length + 1,
        };
        setDiaryEntries((prev) => [...prev, newEntry]);
        break;
      }
      case 'update_diary_entry': {
        const idx = input.index as number;
        setDiaryEntries((prev) => {
          const updated = [...prev];
          if (updated[idx]) {
            const updates: Partial<JobDiaryEntry> = {};
            if (input.entryText !== undefined) updates.entryText = input.entryText as string;
            if (input.costCodeId !== undefined) updates.costCodeId = input.costCodeId as string;
            if (input.loads !== undefined) updates.loads = input.loads as number;
            if (input.yield !== undefined) updates.yield = input.yield as number;
            updated[idx] = { ...updated[idx], ...updates };
          }
          return updated;
        });
        break;
      }
      case 'remove_diary_entry': {
        const idx = input.index as number;
        setDiaryEntries((prev) => prev.filter((_, i) => i !== idx));
        break;
      }
      case 'add_subcontractor_entry': {
        const newEntry: SubcontractorWork = {
          id: generateId(),
          dailyReportId: currentReportId,
          contractorId: (input.contractorId as string) || '',
          itemsWorked: (input.itemsWorked as string) || '',
          production: input.production as string | undefined,
          costCodeId: input.costCodeId as string | undefined,
        };
        setSubcontractorEntries((prev) => [...prev, newEntry]);
        break;
      }
      case 'remove_subcontractor_entry': {
        const idx = input.index as number;
        setSubcontractorEntries((prev) => prev.filter((_, i) => i !== idx));
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
        setDeliveryEntries((prev) => [...prev, newEntry]);
        break;
      }
      case 'remove_delivery_entry': {
        const idx = input.index as number;
        setDeliveryEntries((prev) => prev.filter((_, i) => i !== idx));
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b p-4 sticky top-0 z-10">
        <div className="flex items-start max-w-7xl mx-auto relative">
          <Button
            variant="outline"
            onClick={goBack}
            className="flex items-center gap-2 absolute left-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Reports</span>
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-foreground">
              {isEditing ? 'Edit Report' : 'New Report'}
            </h1>
            {job ? (
              <p className="text-sm text-muted-foreground">
                {job.jobNumber} - {job.jobName}
              </p>
            ) : (
              <div className="h-5 w-48 bg-muted rounded animate-pulse mx-auto" />
            )}
            {copiedFrom && (
              <p className="text-sm text-primary mt-1">
                Copied from {new Date(copiedFrom).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 absolute right-0">
            <SyncIndicator />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 space-y-8 pb-24">
        {/* Date and Weather */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg"><BookOpen className="w-5 h-5" />General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-between text-left font-normal text-sm md:text-xs/relaxed bg-input/20 border-input hover:bg-input/20 hover:text-current",
                        !date && "text-muted-foreground"
                      )}
                      disabled={isEditing && existingReport?.status === 'Submitted'}
                    >
                      <span className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4" />
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
                          setDate(format(selectedDate, 'yyyy-MM-dd'));
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <WeatherSelector value={weather} onChange={setWeather} />
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <Label>Comments (optional)</Label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Additional notes or comments..."
                rows={3}
                className="text-base resize-none"
              />
            </div>

            <Separator />

            <DeadlineIndicator
              dailyDueBy={deadlines.dailyDueBy}
              payrollDueBy={deadlines.payrollDueBy}
              status={existingReport?.status || 'Draft'}
              submittedAt={existingReport?.submittedAt}
            />
          </CardContent>
        </Card>

        <Separator />

        {/* Labor Section */}
        <LaborSection
          entries={laborEntries}
          onChange={setLaborEntries}
          dailyReportId={currentReportId}
        />

        <Separator />

        {/* Job Diary Section */}
        <JobDiarySection
          entries={diaryEntries}
          onChange={setDiaryEntries}
          dailyReportId={currentReportId}
        />

        <Separator />

        {/* Subcontractors + Deliveries */}
        <SubcontractorsDeliveriesSection
          subcontractorEntries={subcontractorEntries}
          deliveryEntries={deliveryEntries}
          onSubcontractorsChange={setSubcontractorEntries}
          onDeliveriesChange={setDeliveryEntries}
          dailyReportId={currentReportId}
        />

        <Separator />

        {/* Photo Attachments */}
        <PhotoAttachments
          photos={photos}
          onChange={setPhotos}
          dailyReportId={currentReportId}
        />

        <Separator />

        {/* Signature */}
        <SignatureCapture
          value={signature}
          onChange={setSignature}
        />
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t p-4 safe-area-inset-bottom">
        <div className="max-w-7xl mx-auto flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={saveDraft}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleViewPDF}
          >
            View PDF
          </Button>
          <Button
            className="flex-1"
            onClick={submitReport}
            disabled={!signature || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant context={aiContext} onToolCall={handleAIToolCall} />
    </div>
  );
}
