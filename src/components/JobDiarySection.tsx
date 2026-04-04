import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, X, List } from 'lucide-react';
import type { JobDiaryEntry } from '@/types';

interface JobDiarySectionProps {
  entries: JobDiaryEntry[];
  onChange: (entries: JobDiaryEntry[]) => void;
  dailyReportId: string;
}

export function JobDiarySection({ entries, onChange, dailyReportId }: JobDiarySectionProps) {
  const costCodes = useLiveQuery(() => db.costCodes.toArray());

  function addEntry() {
    const newEntry: JobDiaryEntry = {
      id: generateId(),
      dailyReportId,
      entryText: '',
      costCodeId: undefined,
      itemNumber: entries.length + 1,
    };
    onChange([...entries, newEntry]);
  }

  function updateEntry(index: number, updates: Partial<JobDiaryEntry>) {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    onChange(newEntries);
  }

  function removeEntry(index: number) {
    const newEntries = entries
      .filter((_, i) => i !== index)
      .map((entry, i) => ({ ...entry, itemNumber: i + 1 }));
    onChange(newEntries);
  }

  return (
    <div className="space-y-[20px]">
      <h2 className="text-lg font-semibold flex items-center gap-3 px-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><List className="w-3 h-3" /></span>
        Production + Notes
      </h2>
      <Card>
        <CardContent className="space-y-4 pt-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No journal entries.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div key={entry.id}>
              {index > 0 && <Separator className="my-4" />}
              <DiaryEntryForm
                entry={entry}
                costCodes={costCodes || []}
                onUpdate={(updates) => updateEntry(index, updates)}
                onRemove={() => removeEntry(index)}
              />
            </div>
          ))
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full btn-action"
          onClick={addEntry}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Entry
        </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface DiaryEntryFormProps {
  entry: JobDiaryEntry;
  costCodes: { id: string; code: string; description: string }[];
  onUpdate: (updates: Partial<JobDiaryEntry>) => void;
  onRemove: () => void;
}

function DiaryEntryForm({
  entry,
  costCodes,
  onUpdate,
  onRemove,
}: DiaryEntryFormProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {entry.itemNumber}
          </span>
          <Label className="text-sm font-medium">Entry</Label>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="h-8 w-8"
          onClick={onRemove}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Entry Text */}
      <Textarea
        value={entry.entryText}
        onChange={(e) => onUpdate({ entryText: e.target.value })}
        placeholder="Describe work performed, conditions, or notes..."
        rows={3}
        className="text-base resize-none"
      />

      {/* Cost Code */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Cost Code (optional)</Label>
        <Select
          value={entry.costCodeId || 'none'}
          onValueChange={(value) => onUpdate({ costCodeId: value === 'none' ? undefined : value })}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Select cost code" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No cost code</SelectItem>
            {costCodes.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.code} - {cc.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loads, Yield, Total */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Loads</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={entry.loads ?? ''}
            onChange={(e) => {
              const loads = e.target.value ? Number(e.target.value) : undefined;
              const total = loads != null && entry.yield != null ? loads * entry.yield : undefined;
              onUpdate({ loads, total });
            }}
            placeholder="0"
            className="text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Yield</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={entry.yield ?? ''}
            onChange={(e) => {
              const yieldVal = e.target.value ? Number(e.target.value) : undefined;
              const total = entry.loads != null && yieldVal != null ? entry.loads * yieldVal : undefined;
              onUpdate({ yield: yieldVal, total });
            }}
            placeholder="0"
            className="text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Total</Label>
          <Input
            type="number"
            value={entry.total ?? ''}
            readOnly
            tabIndex={-1}
            placeholder="0"
            className="text-base bg-muted"
          />
        </div>
      </div>
    </div>
  );
}
