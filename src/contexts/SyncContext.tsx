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

  // Maps a local table name to its Airtable table name.
  const tableNameMap: Record<string, string> = {
    costCodes: 'Cost Codes',
    dailyReports: 'Daily Reports',
    laborEntries: 'Labor Entries',
    equipmentUsage: 'Equipment Usage',
    subcontractorWork: 'Subcontractor Work',
    materialsDelivered: 'Materials Delivered',
    jobDiaryEntries: 'Job Diary Entries',
    photoAttachments: 'Photo Attachments',
    editHistory: 'Edit History',
  };

  // Describes how to translate a local foreign-key field (UUID) into the
  // Airtable Linked Record format (an array of Airtable record IDs).
  // localField  = the field name in the local data payload
  // localTable  = the Dexie table to look up the foreign record in
  // airtableField = the destination field name in Airtable (the Linked Record column)
  type LinkedFieldSpec = { localField: string; localTable: string; airtableField: string };

  const linkedFieldsByTable: Record<string, LinkedFieldSpec[]> = {
    costCodes: [
      { localField: 'jobId', localTable: 'jobs', airtableField: 'Job' },
    ],
  };

  // Translate a payload's foreign-key UUIDs into Airtable Linked Record arrays.
  // Returns a new object — never mutates the input. Throws if a referenced
  // record is missing its airtableId (meaning it hasn't been synced yet).
  async function resolveLinkedFields(
    localTableName: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const specs = linkedFieldsByTable[localTableName];
    if (!specs) return data;
    const out = { ...data };
    for (const spec of specs) {
      const localId = data[spec.localField];
      // Drop the original local-id field — Airtable doesn't know about it.
      delete out[spec.localField];
      if (typeof localId !== 'string' || !localId) continue;
      const linked = await db.table(spec.localTable).get(localId);
      if (!linked?.airtableId) {
        throw new Error(
          `Cannot link ${localTableName}.${spec.localField}: ` +
          `${spec.localTable} record ${localId} has no airtableId yet`
        );
      }
      out[spec.airtableField] = [linked.airtableId];
    }
    return out;
  }

  async function syncItem(item: SyncQueueItem): Promise<void> {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.warn('Airtable not configured, skipping sync');
      return;
    }

    const airtableTableName = tableNameMap[item.tableName];
    if (!airtableTableName) {
      throw new Error(`Unknown table: ${item.tableName}`);
    }

    const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(airtableTableName)}`;

    const headers = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    };

    // Helper: read the response body to surface Airtable's actual error
    // detail. statusText is empty on HTTP/2 so we have to read the body.
    async function describeError(resp: Response, op: string): Promise<string> {
      let detail = '';
      try {
        const body = await resp.text();
        detail = body.slice(0, 500); // cap so we don't blow up the log
      } catch {
        detail = '(no body)';
      }
      return `Airtable ${op} failed [${resp.status}] on ${item.tableName}: ${detail}`;
    }

    switch (item.operation) {
      case 'create': {
        const fields = await resolveLinkedFields(item.tableName, item.data);
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fields }),
        });
        if (!response.ok) {
          throw new Error(await describeError(response, 'create'));
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
        const fields = await resolveLinkedFields(item.tableName, item.data);
        const response = await fetch(`${baseUrl}/${record.airtableId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields }),
        });
        if (!response.ok) {
          throw new Error(await describeError(response, 'update'));
        }
        break;
      }
      case 'delete': {
        // The local record may already be gone (tombstone-tracked
        // deletes), so accept airtableId from item.data as a fallback.
        let airtableId: string | undefined;
        const record = await db.table(item.tableName).get(item.recordId);
        if (record?.airtableId) {
          airtableId = record.airtableId;
        } else if (typeof item.data.airtableId === 'string') {
          airtableId = item.data.airtableId;
        }
        if (airtableId) {
          const response = await fetch(`${baseUrl}/${airtableId}`, {
            method: 'DELETE',
            headers,
          });
          if (!response.ok) {
            throw new Error(await describeError(response, 'delete'));
          }
        }
        // If no airtableId is available, the record was never synced —
        // silently succeed so the queue item gets removed.
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
