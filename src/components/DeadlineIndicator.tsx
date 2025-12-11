import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle } from 'lucide-react';
import { isDeadlinePassed } from '@/db/database';

interface DeadlineIndicatorProps {
  dailyDueBy: string;
  payrollDueBy: string;
  status: 'Draft' | 'Submitted' | 'Approved';
  submittedAt?: string;
}

export function DeadlineIndicator({
  dailyDueBy,
  payrollDueBy,
  status,
  submittedAt,
}: DeadlineIndicatorProps) {
  const now = new Date();
  const dailyDeadline = new Date(dailyDueBy);
  const payrollDeadline = new Date(payrollDueBy);

  const isDailyLate = status === 'Draft' && isDeadlinePassed(dailyDueBy);
  const isPayrollLate = status === 'Draft' && isDeadlinePassed(payrollDueBy);

  // If submitted, check if it was submitted late
  const wasSubmittedLate =
    submittedAt && new Date(submittedAt) > payrollDeadline;

  function formatDeadline(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  }

  function getTimeRemaining(deadline: Date): string {
    const diff = deadline.getTime() - now.getTime();
    if (diff < 0) return 'Overdue';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes}m remaining`;
  }

  if (status !== 'Draft') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Badge variant={wasSubmittedLate ? 'warning' : 'success'}>
          {status}
          {wasSubmittedLate && ' (Late)'}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Daily Target */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Daily Target:</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={isDailyLate ? 'text-orange-600' : ''}>
            {formatDeadline(dailyDeadline)}
          </span>
          {isDailyLate && (
            <Badge variant="warning" className="text-xs">
              Late
            </Badge>
          )}
        </div>
      </div>

      {/* Payroll Deadline */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${isPayrollLate ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={isPayrollLate ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            Payroll Deadline:
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={isPayrollLate ? 'text-destructive font-medium' : ''}>
            {formatDeadline(payrollDeadline)}
          </span>
          {isPayrollLate && (
            <Badge variant="destructive" className="text-xs">
              OVERDUE
            </Badge>
          )}
        </div>
      </div>

      {/* Time remaining indicator */}
      {!isPayrollLate && (
        <p className="text-xs text-muted-foreground text-right">
          {getTimeRemaining(payrollDeadline)}
        </p>
      )}
    </div>
  );
}
