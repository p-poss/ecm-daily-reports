import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db, generateId, now } from '@/db/database';
import type { SyncQueueItem } from '@/types';

export type SyncStatus = 'online-synced' | 'online-syncing' | 'offline-pending' | 'error';

interface SyncContextType {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
  lastSyncTime: string | null;
  syncError: string | null;
  addToQueue: (tableName: string, recordId: string, operation: SyncQueueItem['operation'], data: Record<string, unknown>) => Promise<void>;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | null>(null);

// Airtable API configuration
const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID || '';

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Calculate status based on state
  const status: SyncStatus = syncError
    ? 'error'
    : !isOnline && pendingCount > 0
    ? 'offline-pending'
    : isSyncing
    ? 'online-syncing'
    : 'online-synced';

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await db.syncQueue.count();
    setPendingCount(count);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count on mount and set up interval
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      triggerSync();
    }
  }, [isOnline, pendingCount, isSyncing]);

  async function addToQueue(
    tableName: string,
    recordId: string,
    operation: SyncQueueItem['operation'],
    data: Record<string, unknown>
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: generateId(),
      tableName,
      recordId,
      operation,
      data,
      attempts: 0,
      createdAt: now(),
    };

    await db.syncQueue.add(item);
    await updatePendingCount();
  }

  async function triggerSync(): Promise<void> {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Get pending items ordered by creation time, skip items that have failed too many times
      const items = await db.syncQueue.orderBy('createdAt').toArray();
      const retryableItems = items.filter(item => item.attempts < 5);

      // Remove items that have exceeded max retries
      const failedItems = items.filter(item => item.attempts >= 5);
      for (const item of failedItems) {
        console.error(`Sync item ${item.id} removed after ${item.attempts} failed attempts: ${item.error}`);
        await db.syncQueue.delete(item.id);
      }

      for (const item of retryableItems) {
        try {
          await syncItem(item);
          // Remove from queue on success
          await db.syncQueue.delete(item.id);
        } catch (error) {
          // Update attempt count and error
          await db.syncQueue.update(item.id, {
            attempts: item.attempts + 1,
            lastAttempt: now(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      setLastSyncTime(now());
      await updatePendingCount();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncItem(item: SyncQueueItem): Promise<void> {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.warn('Airtable not configured, skipping sync');
      return;
    }

    const tableNameMap: Record<string, string> = {
      dailyReports: 'Daily Reports',
      laborEntries: 'Labor Entries',
      equipmentUsage: 'Equipment Usage',
      subcontractorWork: 'Subcontractor Work',
      materialsDelivered: 'Materials Delivered',
      jobDiaryEntries: 'Job Diary Entries',
      photoAttachments: 'Photo Attachments',
      editHistory: 'Edit History',
    };

    const airtableTableName = tableNameMap[item.tableName];
    if (!airtableTableName) {
      throw new Error(`Unknown table: ${item.tableName}`);
    }

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(airtableTableName)}`;

    const headers = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    };

    switch (item.operation) {
      case 'create': {
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fields: item.data }),
        });
        if (!response.ok) {
          throw new Error(`Airtable create failed: ${response.statusText}`);
        }
        const result = await response.json();
        // Update local record with Airtable ID
        const table = db.table(item.tableName);
        await table.update(item.recordId, { airtableId: result.id });
        break;
      }
      case 'update': {
        const record = await db.table(item.tableName).get(item.recordId);
        if (!record?.airtableId) {
          throw new Error('Record not found or missing Airtable ID');
        }
        const response = await fetch(`${baseUrl}/${record.airtableId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields: item.data }),
        });
        if (!response.ok) {
          throw new Error(`Airtable update failed: ${response.statusText}`);
        }
        break;
      }
      case 'delete': {
        const record = await db.table(item.tableName).get(item.recordId);
        if (record?.airtableId) {
          const response = await fetch(`${baseUrl}/${record.airtableId}`, {
            method: 'DELETE',
            headers,
          });
          if (!response.ok) {
            throw new Error(`Airtable delete failed: ${response.statusText}`);
          }
        }
        break;
      }
    }
  }

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount,
        isOnline,
        lastSyncTime,
        syncError,
        addToQueue,
        triggerSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
