import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface JobSelectorProps {
  value: string;
  onChange: (jobId: string) => void;
}

export function JobSelector({ value, onChange }: JobSelectorProps) {
  const { foreman } = useAuth();

  // Get jobs assigned to this foreman
  const jobs = useLiveQuery(async () => {
    if (!foreman) return [];

    // Filter to only the jobs assigned to this foreman in Airtable.
    const allJobs = await db.jobs
      .where('status')
      .equals('Active')
      .toArray();
    return allJobs.filter((job) => foreman.assignedJobIds.includes(job.id));
  }, [foreman]);

  const selectedJob = jobs?.find((j) => j.id === value);

  return (
    <div className="space-y-2">
      <Label>Job</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-sm">
          <SelectValue placeholder="Select a job">
            {selectedJob ? (
              <span>
                {selectedJob.jobNumber} - {selectedJob.jobName}
              </span>
            ) : (
              'Select a job'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {jobs?.map((job) => (
            <SelectItem key={job.id} value={job.id}>
              <div className="flex flex-col">
                <span className="font-medium">{job.jobNumber}</span>
                <span className="text-sm text-muted-foreground">{job.jobName}</span>
              </div>
            </SelectItem>
          ))}
          {jobs?.length === 0 && (
            <div className="p-2 text-sm text-muted-foreground text-center">
              No jobs assigned
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
