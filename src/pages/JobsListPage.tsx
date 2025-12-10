import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SyncIndicator } from '@/components/SyncIndicator';
import { LogOut, Briefcase, MapPin, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function JobsListPage() {
  const { foreman, logout } = useAuth();
  const { navigateToReports } = useNavigation();

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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-800 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              My Jobs
            </h1>
            <p className="text-sm text-slate-300">{foreman?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-white hover:bg-slate-700"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Jobs List */}
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {jobs?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No jobs assigned to you.</p>
              <p className="text-sm">Contact your supervisor for job assignments.</p>
            </CardContent>
          </Card>
        ) : (
          jobs?.map((job) => {
            const counts = reportCounts?.[job.id];
            return (
              <Card
                key={job.id}
                className="cursor-pointer hover:shadow-md transition-shadow active:bg-slate-50"
                onClick={() => navigateToReports(job.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{job.jobNumber}</span>
                        <Badge variant="secondary">{job.status}</Badge>
                      </div>
                      <h3 className="font-medium text-slate-800 truncate">
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
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground ml-2" />
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
