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
import { SignatureCapture } from '@/components/SignatureCapture';
import { PhotoAttachments } from '@/components/PhotoAttachments';
import { DeadlineIndicator } from '@/components/DeadlineIndicator';
import { ArrowLeft, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { DailyReport, LaborEntry, JobDiaryEntry, PhotoAttachment, Weather } from '@/types';

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
    const [labor, diary, attachments] = await Promise.all([
      db.laborEntries.where('dailyReportId').equals(id).toArray(),
      db.jobDiaryEntries.where('dailyReportId').equals(id).toArray(),
      db.photoAttachments.where('dailyReportId').equals(id).toArray(),
    ]);
    setLaborEntries(labor);
    setDiaryEntries(diary);
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

    await db.photoAttachments.where('dailyReportId').equals(report.id).delete();
    if (photos.length > 0) {
      await db.photoAttachments.bulkPut(
        photos.map((p) => ({ ...p, dailyReportId: report.id }))
      );
    }
  }

  const isEditing = !!selectedReportId;
  const currentReportId = existingReport?.id || reportId;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b p-4 sticky top-0 z-10">
        <div className="flex items-start max-w-7xl mx-auto relative">
          <Button
            variant="outline"
            onClick={goBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground absolute left-0"
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="w-5 h-5" />
              Report Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-between text-left font-normal shadow-none",
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
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-inset-bottom">
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
            className="flex-1"
            onClick={submitReport}
            disabled={!signature || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
