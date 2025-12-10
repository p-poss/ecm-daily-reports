import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SyncIndicator } from '@/components/SyncIndicator';
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
} from 'lucide-react';

export function ReportsListPage() {
  const { foreman } = useAuth();
  const { selectedJobId, navigateToJobs, navigateToReportForm } = useNavigation();

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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={navigateToJobs}
              className="flex items-center gap-2 text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Jobs</span>
            </button>
            <SyncIndicator />
          </div>
          {job && (
            <div className="mt-2">
              <h1 className="text-lg font-bold">{job.jobNumber}</h1>
              <p className="text-sm text-slate-300">{job.jobName}</p>
            </div>
          )}
        </div>
      </header>

      {/* Create New Report Button */}
      <div className="max-w-2xl mx-auto p-4 pb-0">
        <Button
          className="w-full"
          size="lg"
          onClick={() => selectedJobId && navigateToReportForm(selectedJobId)}
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Report
        </Button>
      </div>

      {/* Reports List */}
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {reports?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No reports yet for this job.</p>
              <p className="text-sm">Tap "Create New Report" to get started.</p>
            </CardContent>
          </Card>
        ) : (
          reports?.map((report) => {
            const timePastDue = report.status === 'Draft' ? getTimePastDue(report.payrollDueBy) : null;
            const timeRemaining = report.status === 'Draft' ? getTimeRemaining(report.payrollDueBy) : null;

            return (
              <Card key={report.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Report Header */}
                  <div className="p-4 border-b bg-slate-50">
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
                        <AlertTriangle className={`w-4 h-4 ${timePastDue ? 'text-red-600' : ''}`} />
                        Payroll Deadline
                      </span>
                      <span className={timePastDue ? 'text-red-600 font-medium' : ''}>
                        {formatDateTime(report.payrollDueBy)}
                      </span>
                    </div>

                    {/* Time Past Due or Remaining */}
                    {report.status === 'Draft' && (
                      <div className="pt-2 border-t">
                        {timePastDue ? (
                          <div className="flex items-center justify-center gap-2 text-red-600 font-medium">
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
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => selectedJobId && navigateToReportForm(selectedJobId, report.id)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View / Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
