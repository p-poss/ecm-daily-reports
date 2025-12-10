import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Users, User, Clock, Wrench, LayoutGrid, Table, MessageSquare } from 'lucide-react';
import type { LaborEntry, Trade } from '@/types';

const TRADE_CODES: { value: Trade; label: string }[] = [
  { value: 'S', label: 'S - Skilled' },
  { value: 'OE', label: 'OE - Operator' },
  { value: 'LB', label: 'LB - Laborer' },
  { value: 'O', label: 'O - Other' },
  { value: 'F', label: 'F - Foreman' },
  { value: 'GC', label: 'GC - General Contractor' },
  { value: 'L', label: 'L - Labor' },
  { value: 'Grd', label: 'Grd - Grade' },
  { value: 'Supt', label: 'Supt - Superintendent' },
];

interface LaborSectionProps {
  entries: LaborEntry[];
  onChange: (entries: LaborEntry[]) => void;
  dailyReportId: string;
}

type ViewMode = 'card' | 'table';

export function LaborSection({ entries, onChange, dailyReportId }: LaborSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const employees = useLiveQuery(() => db.employees.toArray());
  const equipment = useLiveQuery(() => db.equipment.toArray());
  const costCodes = useLiveQuery(() => db.costCodes.toArray());

  function addEntry() {
    const newEntry: LaborEntry = {
      id: generateId(),
      dailyReportId,
      employeeId: '',
      trade: 'LB',
      stHours: 8,
      otHours: 0,
      equipmentId: undefined,
      costCodeIds: [],
    };
    onChange([...entries, newEntry]);
  }

  function updateEntry(index: number, updates: Partial<LaborEntry>) {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], ...updates };
    onChange(newEntries);
  }

  function removeEntry(index: number) {
    const newEntries = entries.filter((_, i) => i !== index);
    onChange(newEntries);
  }

  // Calculate totals
  const totalST = entries.reduce((sum, e) => sum + e.stHours, 0);
  const totalOT = entries.reduce((sum, e) => sum + e.otHours, 0);

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Labor
          {entries.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({entries.length} worker{entries.length !== 1 ? 's' : ''})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <div className="text-sm text-muted-foreground mr-2">
              <span className="font-medium">{totalST}</span> ST / <span className="font-medium">{totalOT}</span> OT
            </div>
          )}
          {/* View Toggle */}
          {entries.length > 0 && (
            <div className="flex border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`p-1.5 ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                title="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                title="Table view"
              >
                <Table className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No workers added yet.</p>
            <p className="text-sm">Tap "Add Worker" to begin.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* Card View */
        entries.map((entry, index) => (
          <WorkerCard
            key={entry.id}
            entry={entry}
            index={index}
            employees={employees || []}
            equipment={equipment || []}
            costCodes={costCodes || []}
            onUpdate={(updates) => updateEntry(index, updates)}
            onRemove={() => removeEntry(index)}
          />
        ))
      ) : (
        /* Table View */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left p-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Employee</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Trade</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">ST</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">OT</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Equipment</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Cost Code</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Comments</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <TableRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    employees={employees || []}
                    equipment={equipment || []}
                    costCodes={costCodes || []}
                    onUpdate={(updates) => updateEntry(index, updates)}
                    onRemove={() => removeEntry(index)}
                  />
                ))}
                {/* Totals Row */}
                <tr className="border-t bg-slate-50 font-medium">
                  <td className="p-3"></td>
                  <td className="p-3">Totals</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-center">{totalST}</td>
                  <td className="p-3 text-center">{totalOT}</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Worker Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addEntry}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Worker
      </Button>
    </div>
  );
}

interface WorkerCardProps {
  entry: LaborEntry;
  index: number;
  employees: { id: string; name: string; trade: Trade }[];
  equipment: { id: string; equipmentNumber: string; description: string }[];
  costCodes: { id: string; code: string; description: string }[];
  onUpdate: (updates: Partial<LaborEntry>) => void;
  onRemove: () => void;
}

function WorkerCard({
  entry,
  index,
  employees,
  equipment,
  costCodes,
  onUpdate,
  onRemove,
}: WorkerCardProps) {
  const selectedEmployee = employees.find((e) => e.id === entry.employeeId);

  return (
    <Card className="overflow-hidden">
      {/* Card Header with Employee Name and Delete */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {index + 1}
          </div>
          <div>
            {selectedEmployee ? (
              <span className="font-medium">{selectedEmployee.name}</span>
            ) : (
              <span className="text-muted-foreground italic">Select employee</span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Employee Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="w-3 h-3" />
            Employee
          </Label>
          <Select
            value={entry.employeeId}
            onValueChange={(value) => {
              const emp = employees.find((e) => e.id === value);
              onUpdate({
                employeeId: value,
                trade: emp?.trade || entry.trade,
              });
            }}
          >
            <SelectTrigger className="text-base">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Trade and Hours Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trade</Label>
            <Select
              value={entry.trade}
              onValueChange={(value) => onUpdate({ trade: value as Trade })}
            >
              <SelectTrigger className="text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADE_CODES.map((trade) => (
                  <SelectItem key={trade.value} value={trade.value}>
                    {trade.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ST Hrs
            </Label>
            <Input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={entry.stHours}
              onChange={(e) => onUpdate({ stHours: parseFloat(e.target.value) || 0 })}
              className="text-base text-center"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              OT Hrs
            </Label>
            <Input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={entry.otHours}
              onChange={(e) => onUpdate({ otHours: parseFloat(e.target.value) || 0 })}
              className="text-base text-center"
            />
          </div>
        </div>

        {/* Equipment Selection */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            Equipment (optional)
          </Label>
          <Select
            value={entry.equipmentId || 'none'}
            onValueChange={(value) => onUpdate({ equipmentId: value === 'none' ? undefined : value })}
          >
            <SelectTrigger className="text-base">
              <SelectValue placeholder="No equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No equipment</SelectItem>
              {equipment.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  #{eq.equipmentNumber} - {eq.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cost Code */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cost Code</Label>
          <Select
            value={entry.costCodeIds[0] || 'none'}
            onValueChange={(value) => onUpdate({ costCodeIds: value === 'none' ? [] : [value] })}
          >
            <SelectTrigger className="text-base">
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

        {/* Comments */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Comments (optional)
          </Label>
          <Textarea
            value={entry.comments || ''}
            onChange={(e) => onUpdate({ comments: e.target.value || undefined })}
            placeholder="Add notes about this worker..."
            rows={2}
            className="text-sm resize-none"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface TableRowProps {
  entry: LaborEntry;
  index: number;
  employees: { id: string; name: string; trade: Trade }[];
  equipment: { id: string; equipmentNumber: string; description: string }[];
  costCodes: { id: string; code: string; description: string }[];
  onUpdate: (updates: Partial<LaborEntry>) => void;
  onRemove: () => void;
}

function TableRow({
  entry,
  index,
  employees,
  equipment,
  costCodes,
  onUpdate,
  onRemove,
}: TableRowProps) {
  return (
    <tr className="border-b hover:bg-slate-50/50">
      <td className="p-2 text-center text-muted-foreground">{index + 1}</td>
      <td className="p-2">
        <Select
          value={entry.employeeId || 'none'}
          onValueChange={(value) => {
            if (value === 'none') return;
            const emp = employees.find((e) => e.id === value);
            onUpdate({
              employeeId: value,
              trade: emp?.trade || entry.trade,
            });
          }}
        >
          <SelectTrigger className="h-8 text-sm min-w-[140px]">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Select
          value={entry.trade}
          onValueChange={(value) => onUpdate({ trade: value as Trade })}
        >
          <SelectTrigger className="h-8 text-sm w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRADE_CODES.map((trade) => (
              <SelectItem key={trade.value} value={trade.value}>
                {trade.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={entry.stHours}
          onChange={(e) => onUpdate({ stHours: parseFloat(e.target.value) || 0 })}
          className="h-8 text-sm text-center w-[60px]"
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={entry.otHours}
          onChange={(e) => onUpdate({ otHours: parseFloat(e.target.value) || 0 })}
          className="h-8 text-sm text-center w-[60px]"
        />
      </td>
      <td className="p-2">
        <Select
          value={entry.equipmentId || 'none'}
          onValueChange={(value) => onUpdate({ equipmentId: value === 'none' ? undefined : value })}
        >
          <SelectTrigger className="h-8 text-sm min-w-[120px]">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {equipment.map((eq) => (
              <SelectItem key={eq.id} value={eq.id}>
                #{eq.equipmentNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Select
          value={entry.costCodeIds[0] || 'none'}
          onValueChange={(value) => onUpdate({ costCodeIds: value === 'none' ? [] : [value] })}
        >
          <SelectTrigger className="h-8 text-sm min-w-[100px]">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {costCodes.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <Input
          type="text"
          value={entry.comments || ''}
          onChange={(e) => onUpdate({ comments: e.target.value || undefined })}
          placeholder="Notes..."
          className="h-8 text-sm min-w-[120px]"
        />
      </td>
      <td className="p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
}
