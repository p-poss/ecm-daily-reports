import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SyncIndicator } from '@/components/SyncIndicator';
import { ArrowLeft, MapPin, Images, FileStack, DollarSign } from 'lucide-react';
import { generateCombinedReportPDF, type ReportPDFData } from '@/lib/generate-report-pdf';
import { generateBudgetPDF } from '@/lib/generate-budget-pdf';
import { PhotoGalleryModal, type GalleryPhoto } from '@/components/PhotoGalleryModal';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

export function JobsListPage() {
  const { foreman, logout } = useAuth();
  const { navigateToReports } = useNavigation();
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[] | null>(null);
  const [galleryTitle, setGalleryTitle] = useState('');

  // Get jobs assigned to this foreman
  const jobs = useLiveQuery(async () => {
    if (!foreman) return [];

    const allJobs = await db.jobs
      .where('status')
      .equals('Active')
      .toArray();
    return allJobs.filter((job) => foreman.assignedJobIds.includes(job.id));
  }, [foreman]);

  // Get report counts for each job
  const reportCounts = useLiveQuery(async () => {
    if (!jobs || !foreman) return {};

    const counts: Record<string, { total: number; pending: number }> = {};

    for (const job of jobs) {
      const reports = await db.dailyReports
        .where('jobId')
        .equals(job.id)
                .toArray();

      counts[job.id] = {
        total: reports.length,
        pending: reports.filter((r) => r.status === 'Draft').length,
      };
    }

    return counts;
  }, [jobs, foreman]);

  async function handleViewPDF(jobId: string) {
    const pdfWindow = window.open('', '_blank');
    const job = jobs?.find((j) => j.id === jobId);
    if (!job || !foreman) { pdfWindow?.close(); return; }

    const reports = await db.dailyReports
      .where('jobId').equals(jobId)
            .sortBy('date');

    if (reports.length === 0) { pdfWindow?.close(); return; }

    const [employees, equipment, costCodes, subcontractors] = await Promise.all([
      db.employees.toArray(),
      db.equipment.toArray(),
      db.costCodes.where('jobId').equals(jobId).toArray(),
      db.subcontractors.toArray(),
    ]);

    const pdfPages: ReportPDFData[] = [];
    for (const report of reports) {
      const [laborEntries, diaryEntries, subEntries, deliveryEntries] = await Promise.all([
        db.laborEntries.where('dailyReportId').equals(report.id).toArray(),
        db.jobDiaryEntries.where('dailyReportId').equals(report.id).toArray(),
        db.subcontractorWork.where('dailyReportId').equals(report.id).toArray(),
        db.materialsDelivered.where('dailyReportId').equals(report.id).toArray(),
      ]);

      const usedCostCodeIds = new Set<string>();
      for (const entry of laborEntries) {
        for (const ccId of Object.keys(entry.costCodeHours)) {
          const h = entry.costCodeHours[ccId];
          if (h.st || h.ot) usedCostCodeIds.add(ccId);
        }
      }

      pdfPages.push({
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        date: report.date,
        dayOfWeek: report.dayOfWeek,
        foremanName: foreman.name,
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
      });
    }

    const blobUrl = generateCombinedReportPDF(pdfPages);
    if (pdfWindow) { pdfWindow.location.href = blobUrl; }
  }

  async function handleViewPhotos(jobId: string) {
    const job = jobs?.find((j) => j.id === jobId);
    if (!job || !foreman) return;

    const reports = await db.dailyReports
      .where('jobId').equals(jobId)
            .sortBy('date');

    const photos: GalleryPhoto[] = [];
    for (const report of reports) {
      const reportPhotos = await db.photoAttachments.where('dailyReportId').equals(report.id).toArray();
      const dateStr = new Date(report.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      });
      for (const p of reportPhotos) {
        photos.push({
          id: p.id,
          imageData: p.imageData,
          caption: p.caption,
          date: dateStr,
        });
      }
    }

    setGalleryTitle(`${job.jobNumber} — Photos`);
    setGalleryPhotos(photos);
  }

  async function handleViewBudget(jobId: string) {
    // Open the window synchronously so it isn't blocked as a popup, then
    // navigate to the generated blob URL once the PDF is ready.
    const pdfWindow = window.open('', '_blank');
    const job = jobs?.find((j) => j.id === jobId);
    if (!job) { pdfWindow?.close(); return; }

    const costCodes = await db.costCodes
      .where('jobId').equals(jobId)
      .sortBy('code');

    const blobUrl = generateBudgetPDF({
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      address: job.address,
      owner: job.owner,
      totalContract: job.totalContract,
      costCodes: costCodes.map((c) => ({
        code: c.code,
        description: c.description,
        quantity: c.quantity,
        uom: c.uom,
        unitPrice: c.unitPrice,
        budgetAmount: c.budgetAmount,
      })),
    });

    if (pdfWindow) pdfWindow.location.href = blobUrl;
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="bg-card/60 backdrop-blur-md p-4 fixed top-0 left-0 right-0 z-10 ring-2 ring-foreground/10 rounded-b-[16px]">
        <div className="flex items-start max-w-7xl mx-auto relative">
          <Button
            variant="outline"
            onClick={logout}
            className="flex items-center gap-2 absolute left-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Logout</span>
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-sm md:text-lg font-bold text-primary">Current Jobs</h1>
            <p className="text-sm text-muted-foreground">{foreman?.name}</p>
          </div>
          <div className="flex items-center gap-3 absolute right-0">
            <SyncIndicator />
            <div className="hidden md:block w-px h-4 bg-border" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Jobs List */}
      <main className="max-w-[82rem] mx-auto p-4 pt-[200px] space-y-[20px]">
        {jobs === undefined ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center text-muted-foreground">
            <p>No jobs assigned to you.</p>
          </div>
        ) : (
          jobs?.map((job) => {
            const counts = reportCounts?.[job.id];
            return (
              <Card key={job.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Job Header */}
                  <div className="px-4 pb-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{job.jobNumber}</span>
                        <Badge variant="secondary">{job.status}</Badge>
                        <Badge variant={job.sector === 'Public' ? 'default' : 'outline'}>{job.sector}</Badge>
                      </div>
                      {counts && counts.pending > 0 && (
                        <Badge variant="warning" className="text-[10px]">
                          {counts.pending} draft{counts.pending !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Job Details */}
                  <div className="px-4 py-3">
                    <h3 className="font-medium text-foreground truncate text-[14px]">
                      {job.jobName}
                    </h3>
                    {job.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{job.address}</span>
                      </p>
                    )}
                    {counts && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {counts.total} report{counts.total !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 px-4 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 overflow-hidden"
                      onClick={() => handleViewPDF(job.id)}
                      disabled={!counts?.total}
                    >
                      <FileStack className="w-4 h-4 shrink-0" />
                      <span className="truncate">PDF</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 overflow-hidden"
                      onClick={() => handleViewPhotos(job.id)}
                      disabled={!counts?.total}
                    >
                      <Images className="w-4 h-4 shrink-0" />
                      <span className="truncate">Photos</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 overflow-hidden"
                      onClick={() => handleViewBudget(job.id)}
                    >
                      <DollarSign className="w-4 h-4 shrink-0" />
                      <span className="truncate">Budget</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 min-w-0 overflow-hidden btn-action"
                      onClick={() => navigateToReports(job.id)}
                    >
                      <span className="truncate">Reports</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

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
