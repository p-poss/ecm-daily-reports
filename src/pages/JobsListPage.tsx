import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SyncIndicator } from '@/components/SyncIndicator';
import { ArrowLeft, Briefcase, MapPin, Camera, FileText } from 'lucide-react';
import { generateCombinedReportPDF, type ReportPDFData } from '@/lib/generate-report-pdf';
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

    return allJobs.filter((job) =>
      foreman.assignedJobIds.includes(job.id)
    );
  }, [foreman]);

  // Get report counts for each job
  const reportCounts = useLiveQuery(async () => {
    if (!jobs || !foreman) return {};

    const counts: Record<string, { total: number; pending: number }> = {};

    for (const job of jobs) {
      const reports = await db.dailyReports
        .where('jobId')
        .equals(job.id)
        .filter((r) => r.foremanId === foreman.id)
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
      .filter((r) => r.foremanId === foreman.id)
      .sortBy('date');

    if (reports.length === 0) { pdfWindow?.close(); return; }

    const [employees, equipment, costCodes, subcontractors] = await Promise.all([
      db.employees.toArray(),
      db.equipment.toArray(),
      db.costCodes.toArray(),
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
      .filter((r) => r.foremanId === foreman.id)
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-md p-4 fixed top-0 left-0 right-0 z-10 ring-2 ring-foreground/10 rounded-b-[2rem]">
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
            <h1 className="text-lg font-bold text-primary">Current Jobs</h1>
            <p className="text-sm text-muted-foreground">{foreman?.name}</p>
          </div>
          <div className="flex items-center gap-3 absolute right-0">
            <SyncIndicator />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Jobs List */}
      <main className="max-w-7xl mx-auto p-4 pt-[200px] space-y-[20px]">
        {jobs === undefined ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No jobs assigned to you.</p>
            <p className="text-sm">Contact your supervisor for job assignments.</p>
          </div>
        ) : (
          jobs?.map((job) => {
            const counts = reportCounts?.[job.id];
            return (
              <Card key={job.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{job.jobNumber}</span>
                    <Badge variant="secondary">{job.status}</Badge>
                    <Badge variant={job.sector === 'Public' ? 'default' : 'outline'}>{job.sector}</Badge>
                  </div>
                  <h3 className="font-medium text-foreground truncate">
                    {job.jobName}
                  </h3>
                  {job.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{job.address}</span>
                    </p>
                  )}
                  {counts && (
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-muted-foreground">
                        {counts.total} report{counts.total !== 1 ? 's' : ''}
                      </span>
                      {counts.pending > 0 && (
                        <Badge variant="warning" className="text-xs">
                          {counts.pending} draft{counts.pending !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleViewPDF(job.id)}
                      disabled={!counts?.total}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      View PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleViewPhotos(job.id)}
                      disabled={!counts?.total}
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Photos
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 btn-action"
                      onClick={() => navigateToReports(job.id)}
                    >
                      Manage Reports
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
