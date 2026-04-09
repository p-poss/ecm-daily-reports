import { useEffect, useState } from 'react';
import { useSync } from '@/contexts/SyncContext';
import { cn } from '@/lib/utils';

/** Format an ISO timestamp as a short relative-time string. */
function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SyncIndicator() {
  const { status, pendingCount, syncError, lastSyncTime, triggerAllSync } = useSync();

  // Re-render every 30s so the relative time stays fresh.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const statusConfig = {
    'online-synced': {
      color: 'bg-green-500',
      label: lastSyncTime ? `Synced ${relativeTime(lastSyncTime)}` : 'Synced',
    },
    'online-syncing': {
      color: 'bg-yellow-500 animate-pulse',
      label: 'Syncing...',
    },
    'offline': {
      color: 'bg-orange-500',
      label: 'Offline',
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
    <button
      type="button"
      onClick={triggerAllSync}
      title={syncError || `Click to sync now${lastSyncTime ? ` (last synced ${relativeTime(lastSyncTime)})` : ''}`}
      className="flex items-center gap-1.5 text-[10px] md:text-xs cursor-pointer hover:opacity-80 transition-opacity"
    >
      <div className={cn('w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0', config.color)} />
      <span className="text-muted-foreground truncate">{config.label}</span>
      {syncError && (
        <span className="text-xs text-destructive truncate max-w-[150px]">
          {syncError}
        </span>
      )}
    </button>
  );
}
