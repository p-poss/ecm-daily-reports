import { useSync } from '@/contexts/SyncContext';
import { cn } from '@/lib/utils';

export function SyncIndicator() {
  const { status, pendingCount, syncError } = useSync();

  const statusConfig = {
    'online-synced': {
      color: 'bg-green-500',
      label: 'Synced',
    },
    'online-syncing': {
      color: 'bg-yellow-500 animate-pulse',
      label: 'Syncing...',
    },
    'offline-pending': {
      color: 'bg-orange-500',
      label: `Offline (${pendingCount} pending)`,
    },
    'error': {
      color: 'bg-destructive',
      label: 'Sync Error',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={cn('w-2.5 h-2.5 rounded-full', config.color)} />
      <span className="text-muted-foreground">{config.label}</span>
      {syncError && (
        <span className="text-xs text-destructive truncate max-w-[150px]" title={syncError}>
          {syncError}
        </span>
      )}
    </div>
  );
}
