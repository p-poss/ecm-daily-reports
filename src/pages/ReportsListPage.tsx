import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { generateReportPDF, type ReportPDFData } from '@/lib/generate-report-pdf';
import { PhotoGalleryModal, type GalleryPhoto } from '@/components/PhotoGalleryModal';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SelectionCard } from '@/components/ui/selection-card';
import { SyncIndicator } from '@/components/SyncIndicator';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Copy,
  X,
  File,
  Images,
  PenLine,
} from 'lucide-react';

export function ReportsListPage() {
  const { foreman } = useAuth();
  const { selectedJobId, navigateToJobs, navigateToReportForm } = useNavigation();
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[] | null>(null);
  const [galleryTitle, setGalleryTitle] = useState('');

  // Get job details
  const job = useLiveQuery(async () => {
    if (!selectedJobId) return null;
    return db.jobs.get(selectedJobId);
  }, [selectedJobId]);

  // Get all reports for this job
  const reports = useLiveQuery(async () => {
    if (!selectedJobId || !foreman) return [];

    const allReports = await db.dailyReports
      .where('jobId')
      .equals(selectedJobId)
      .filter((r) => r.foremanId === foreman.id)
      .toArray();

    // Sort by date descending (newest first)
    return allReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedJobId, foreman]);

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${weekday}, ${month} ${day}, ${hour12}:${minute} ${ampm}`;
  }

  function getTimePastDue(deadline: string): string | null {
    const now = new Date();
    const deadlineDate = new Date(deadline);

    if (now <= deadlineDate) return null;

    const diff = now.getTime() - deadlineDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h overdue`;
    }
    if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m overdue`;
    }
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m overdue`;
  }

  function getTimeRemaining(deadline: string): string | null {
    const now = new Date();
    const deadlineDate = new Date(deadline);

    if (now >= deadlineDate) return null;

    const diff = deadlineDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h left`;
    }
    if (hours > 0) {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m left`;
    }
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m left`;
  }

  async function handleViewPDF(reportId: string) {
    // Open window synchronously (before any awaits) to avoid popup blocker
    const pdfWindow = window.open('', '_blank');
    const report = await db.dailyReports.get(reportId);
    if (!report || !job) {
      pdfWindow?.close();
      return;
    }

    const [laborEntries, diaryEntries, subEntries, deliveryEntries, employees, equipment, costCodes, subcontractors] = await Promise.all([
      db.laborEntries.where('dailyReportId').equals(reportId).toArray(),
      db.jobDiaryEntries.where('dailyReportId').equals(reportId).toArray(),
      db.subcontractorWork.where('dailyReportId').equals(reportId).toArray(),
      db.materialsDelivered.where('dailyReportId').equals(reportId).toArray(),
      db.employees.toArray(),
      db.equipment.toArray(),
      db.costCodes.toArray(),
      db.subcontractors.toArray(),
    ]);

    const usedCostCodeIds = new Set<string>();
    for (const entry of laborEntries) {
      for (const ccId of Object.keys(entry.costCodeHours)) {
        const h = entry.costCodeHours[ccId];
        if (h.st || h.ot) usedCostCodeIds.add(ccId);
      }
    }

    const pdfData: ReportPDFData = {
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      date: report.date,
      dayOfWeek: report.dayOfWeek,
      foremanName: foreman?.name || '',
      weather: report.weather,
      comments: report.comments,
      laborEntries: laborEntries.map((e) => {
        const emp = employees.find((emp) => emp.id === e.employeeId);
        const equip = e.equipmentId ? equipment.find((eq) => eq.id === e.equipmentId) : null;
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
      costCodes: costCodes.filter((c) => usedCostCodeIds.has(c.id)),
      subcontractors: subEntries.map((e) => ({
        contractorName: subcontractors.find((s) => s.id === e.contractorId)?.name || '',
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
          ? costCodes.find((c) => c.id === e.costCodeId)?.description
          : undefined,
      })),
    };

    const blobUrl = generateReportPDF(pdfData);
    if (pdfWindow) {
      pdfWindow.location.href = blobUrl;
    }
  }

  async function handleViewPhotos(reportId: string) {
    const report = await db.dailyReports.get(reportId);
    const photos = await db.photoAttachments.where('dailyReportId').equals(reportId).toArray();
    const dateStr = report
      ? new Date(report.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        })
      : '';
    setGalleryTitle(dateStr ? `Photos — ${dateStr}` : 'Photos');
    setGalleryPhotos(photos.map((p) => ({
      id: p.id,
      imageData: p.imageData,
      caption: p.caption,
      date: dateStr,
    })));
  }

  async function handleDeleteReport(reportId: string) {
    if (!confirm('Are you sure you want to delete this report? This cannot be undone.')) {
      return;
    }

    try {
      // Delete related records first
      await db.laborEntries.where('dailyReportId').equals(reportId).delete();
      await db.jobDiaryEntries.where('dailyReportId').equals(reportId).delete();
      await db.photoAttachments.where('dailyReportId').equals(reportId).delete();
      await db.editHistory.where('dailyReportId').equals(reportId).delete();

      // Delete the report itself
      await db.dailyReports.delete(reportId);
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/60 backdrop-blur-md p-4 fixed top-0 left-0 right-0 z-10 ring-2 ring-foreground/10 rounded-b-[16px]">
        <div className="flex items-start max-w-7xl mx-auto relative">
          <Button
            variant="outline"
            onClick={navigateToJobs}
            className="flex items-center gap-2 absolute left-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Jobs</span>
          </Button>
          <div className="flex-1 text-center">
            {job ? (
              <>
                <h1 className="text-lg font-bold text-foreground">{job.jobNumber}</h1>
                <p className="text-sm text-muted-foreground">{job.jobName}</p>
              </>
            ) : (
              <>
                <div className="h-7 w-24 bg-muted rounded animate-pulse mx-auto" />
                <div className="h-5 w-40 bg-muted rounded animate-pulse mt-1 mx-auto" />
              </>
            )}
          </div>
          <div className="flex items-center gap-3 absolute right-0">
            <SyncIndicator />
            <div className="hidden md:block w-px h-4 bg-border" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Reports List */}
      <main className="max-w-7xl mx-auto p-4 pt-[200px] space-y-[20px]">
        {reports === undefined ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>No reports yet for this job.</p>
          </div>
        ) : (
          reports?.map((report) => {
            const timePastDue = report.status === 'Draft' ? getTimePastDue(report.payrollDueBy) : null;
            const timeRemaining = report.status === 'Draft' ? getTimeRemaining(report.payrollDueBy) : null;

            return (
              <Card key={report.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Report Header */}
                  <div className="px-4 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-bold">{formatDate(report.date)}</span>
                        <Badge
                          variant={
                            report.status === 'Submitted'
                              ? 'success'
                              : report.status === 'Approved'
                              ? 'default'
                              : timePastDue
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {report.status}
                        </Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => handleDeleteReport(report.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Report Details */}
                  <div className="px-4 divide-y">
                    {/* Submitted Date */}
                    {report.submittedAt && (
                      <div className="flex items-center justify-between text-sm py-3">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle className="w-4 h-4" />
                          Submitted:
                        </span>
                        <span>{formatDateTime(report.submittedAt)}</span>
                      </div>
                    )}

                    {/* Revised Date — only if updated after submission */}
                    {report.submittedAt && report.updatedAt && new Date(report.updatedAt) > new Date(report.submittedAt) && (
                      <div className="flex items-center justify-between text-sm py-3">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <PenLine className="w-4 h-4" />
                          Revised:
                        </span>
                        <span>{formatDateTime(report.updatedAt)}</span>
                      </div>
                    )}

                    {report.status === 'Draft' && (
                      <>
                        {/* Daily Target (Desired Date) */}
                        <div className="flex items-center justify-between text-sm py-3">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            Daily Target:
                          </span>
                          <span className={report.isDailyLate ? 'text-orange-600' : ''}>
                            {formatDateTime(report.dailyDueBy)}
                          </span>
                        </div>

                        {/* Hard Deadline (Payroll) */}
                        <div className="flex items-center justify-between text-sm py-3">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <AlertTriangle className={`w-4 h-4 ${timePastDue ? 'text-destructive' : ''}`} />
                            Payroll Deadline:
                          </span>
                          <span className={timePastDue ? 'text-destructive font-medium' : ''}>
                            {formatDateTime(report.payrollDueBy)}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Time Past Due or Remaining */}
                    {report.status === 'Draft' ? (
                      <div className="py-1">
                        {timePastDue ? (
                          <p className="text-sm text-destructive font-medium text-right">
                            {timePastDue}
                          </p>
                        ) : timeRemaining ? (
                          <p className="text-xs text-muted-foreground text-right">
                            {timeRemaining}
                          </p>
                        ) : null}
                      </div>
                    ) : (() => {
                      if (!report.submittedAt) return <div />;
                      const submitted = new Date(report.submittedAt).getTime();
                      const deadline = new Date(report.payrollDueBy).getTime();
                      if (submitted <= deadline) return (
                        <div className="py-1">
                          <p className="text-xs text-green-600 text-right">On time</p>
                        </div>
                      );
                      const diff = submitted - deadline;
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const days = Math.floor(hours / 24);
                      const label = days > 0
                        ? `${days}d ${hours % 24}h late`
                        : `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m late`;
                      return (
                        <div className="py-1">
                          <p className="text-xs text-destructive font-medium text-right">{label}</p>
                        </div>
                      );
                    })()}

                  </div>
                  {/* Action Buttons */}
                  <div className="flex gap-2 px-4 pt-4">
                    {report.status === 'Draft' ? (
                        <>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleViewPDF(report.id)}
                          >
                            <File className="w-4 h-4 mr-1" />
                            View PDF
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleViewPhotos(report.id)}
                          >
                            <Images className="w-4 h-4 mr-1" />
                            Photos
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 btn-action"
                            onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                          >
                            Submit
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleViewPDF(report.id)}
                          >
                            <File className="w-4 h-4 mr-1" />
                            View PDF
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleViewPhotos(report.id)}
                          >
                            <Images className="w-4 h-4 mr-1" />
                            Photos
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 btn-action"
                            onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                          >
                            Edit
                          </Button>
                          <div className="flex-1" />
                        </>
                      )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
        {/* Create New Report Button */}
        <Button
          variant="outline"
          className="w-full btn-action"
          onClick={() => setShowNewReportModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Report
        </Button>
      </main>

      {/* New Report Modal */}
      {showNewReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[80dvh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">New Report</h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNewReportModal(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              {/* Start Blank Option */}
              <SelectionCard
                icon={<Plus className="w-4 h-4 text-muted-foreground" />}
                iconClassName="bg-muted"
                title="Start Blank"
                description="Create a new empty report"
                onClick={() => {
                  setShowNewReportModal(false);
                  selectedJobId && navigateToReportForm(selectedJobId);
                }}
              />

              {/* Copy from Previous Section */}
              {reports && reports.length > 0 && (
                <>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-2 text-sm text-muted-foreground">
                        or copy from previous
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {reports.slice(0, 5).map((report) => (
                      <SelectionCard
                        key={report.id}
                        icon={<Copy className="w-4 h-4 text-muted-foreground" />}
                        iconClassName="bg-muted"
                        title={
                          <span className="flex items-center gap-2">
                            {formatDate(report.date)}
                            <Badge variant="success">
                              {report.status}
                            </Badge>
                          </span>
                        }
                        description={`${report.dayOfWeek} • Copy labor entries`}
                        onClick={() => {
                          setShowNewReportModal(false);
                          selectedJobId && navigateToReportForm(selectedJobId, undefined, report.id);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {galleryPhotos && (
        <PhotoGalleryModal
          title={galleryTitle}
          photos={galleryPhotos}
          onClose={() => setGalleryPhotos(null)}
        />
      )}
    </div>
  );
}
