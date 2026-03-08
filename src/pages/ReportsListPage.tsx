import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
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
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  Edit,
  Send,
  CheckCircle,
  Copy,
  X,
} from 'lucide-react';

export function ReportsListPage() {
  const { foreman } = useAuth();
  const { selectedJobId, navigateToJobs, navigateToReportForm } = useNavigation();
  const [showNewReportModal, setShowNewReportModal] = useState(false);

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
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    // Format manually to prevent iOS date detection
    return `${month} ${day}, ${hour12}:${minute} ${ampm}`;
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
      <header className="bg-background border-b p-4 sticky top-0 z-10">
        <div className="flex items-start max-w-7xl mx-auto relative">
          <Button
            variant="outline"
            onClick={navigateToJobs}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground absolute left-0"
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
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Create New Report Button */}
      <div className="max-w-7xl mx-auto p-4 pb-0">
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          onClick={() => setShowNewReportModal(true)}
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Report
        </Button>
      </div>

      {/* Reports List */}
      <main className="max-w-7xl mx-auto p-4 space-y-3">
        {reports === undefined ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
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
                  <div className="p-4 border-b bg-muted">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-bold">{formatDate(report.date)}</span>
                        <span className="text-muted-foreground">{report.dayOfWeek}</span>
                      </div>
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
                  </div>

                  {/* Report Details */}
                  <div className="p-4 space-y-3">
                    {/* Submitted Date */}
                    {report.submittedAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          Submitted
                        </span>
                        <span>{formatDateTime(report.submittedAt)}</span>
                      </div>
                    )}

                    {/* Daily Target (Desired Date) */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        Daily Target
                      </span>
                      <span className={report.isDailyLate && report.status === 'Draft' ? 'text-orange-600' : ''}>
                        {formatDateTime(report.dailyDueBy)}
                      </span>
                    </div>

                    {/* Hard Deadline (Payroll) */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <AlertTriangle className={`w-4 h-4 ${timePastDue ? 'text-destructive' : ''}`} />
                        Payroll Deadline
                      </span>
                      <span className={timePastDue ? 'text-destructive font-medium' : ''}>
                        {formatDateTime(report.payrollDueBy)}
                      </span>
                    </div>

                    {/* Time Past Due or Remaining */}
                    {report.status === 'Draft' && (
                      <div className="pt-2 border-t">
                        {timePastDue ? (
                          <div className="flex items-center justify-center gap-2 text-destructive font-medium">
                            <AlertTriangle className="w-4 h-4" />
                            {timePastDue}
                          </div>
                        ) : timeRemaining ? (
                          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                            <Clock className="w-4 h-4" />
                            {timeRemaining}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {report.status === 'Draft' ? (
                        <>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Submit
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteReport(report.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View / Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteReport(report.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      {/* New Report Modal */}
      {showNewReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
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
                icon={<Plus className="w-4 h-4 text-primary" />}
                iconClassName="bg-primary/10"
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
                            <Badge variant="secondary" className="text-xs">
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
    </div>
  );
}
