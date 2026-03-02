import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Users, User, X } from 'lucide-react';
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

/** Reusable split cell with ST (left) and OT (right) inputs */
function SplitHoursCell({
  stValue,
  otValue,
  onStChange,
  onOtChange,
}: {
  stValue: number;
  otValue: number;
  onStChange: (v: number) => void;
  onOtChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center border rounded-md overflow-hidden h-8 min-w-[90px]">
      <Input
        type="number"
        min="0"
        max="24"
        step="0.5"
        value={stValue || ''}
        onChange={(e) => onStChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm text-center w-[45px] border-0 rounded-none focus-visible:ring-0 px-1"
        placeholder="ST"
      />
      <div className="w-px h-full bg-border shrink-0" />
      <Input
        type="number"
        min="0"
        max="24"
        step="0.5"
        value={otValue || ''}
        onChange={(e) => onOtChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-sm text-center w-[45px] border-0 rounded-none focus-visible:ring-0 px-1"
        placeholder="OT"
      />
    </div>
  );
}

/** Split header cell showing "ST | OT" with a divider */
function SplitHeaderLabel() {
  return (
    <div className="flex items-center justify-center text-[10px] text-muted-foreground gap-0">
      <span className="w-[45px] text-center">ST</span>
      <span className="text-border">|</span>
      <span className="w-[45px] text-center">OT</span>
    </div>
  );
}

export function LaborSection({ entries, onChange, dailyReportId }: LaborSectionProps) {
  const [activeCostCodeIds, setActiveCostCodeIds] = useState<string[]>([]);
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
      rentalCompany: undefined,
      idleStHours: 0,
      idleOtHours: 0,
      downStHours: 0,
      downOtHours: 0,
      workStHours: 0,
      workOtHours: 0,
      costCodeHours: {},
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

  function addCostCodeColumn(costCodeId: string) {
    if (!activeCostCodeIds.includes(costCodeId)) {
      setActiveCostCodeIds([...activeCostCodeIds, costCodeId]);
    }
  }

  function removeCostCodeColumn(costCodeId: string) {
    setActiveCostCodeIds(activeCostCodeIds.filter((id) => id !== costCodeId));
    // Clear hours from all entries for this cost code
    const newEntries = entries.map((entry) => {
      const newHours = { ...entry.costCodeHours };
      delete newHours[costCodeId];
      return { ...entry, costCodeHours: newHours };
    });
    onChange(newEntries);
  }

  // Derive active cost codes from entries on mount (for existing data)
  const derivedCostCodeIds = new Set<string>();
  entries.forEach((entry) => {
    Object.keys(entry.costCodeHours || {}).forEach((id) => derivedCostCodeIds.add(id));
  });
  const allActiveCostCodeIds = [...new Set([...activeCostCodeIds, ...derivedCostCodeIds])];

  // Calculate totals
  const totalST = entries.reduce((sum, e) => sum + e.stHours, 0);
  const totalOT = entries.reduce((sum, e) => sum + e.otHours, 0);

  // Available cost codes (not yet added as columns)
  const availableCostCodes = (costCodes || []).filter(
    (cc) => !allActiveCostCodeIds.includes(cc.id)
  );

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
      ) : (
        /* Table View - PDF-matching layout */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Description row above cost code headers */}
              <thead>
                {/* Top row: section labels + cost code descriptions */}
                <tr className="bg-muted border-b">
                  {/* LABOR section header */}
                  <th colSpan={3} className="text-left p-2 font-bold text-xs uppercase tracking-wider border-r">
                    Labor
                  </th>
                  {/* EQUIPMENT section header */}
                  <th colSpan={5} className="text-left p-2 font-bold text-xs uppercase tracking-wider border-r">
                    Equipment
                  </th>
                  {/* Cost code description labels */}
                  {allActiveCostCodeIds.map((ccId) => {
                    const cc = (costCodes || []).find((c) => c.id === ccId);
                    return (
                      <th key={ccId} className="p-1 text-center border-r min-w-[90px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[70px]" title={cc?.description}>
                            {cc?.description || ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCostCodeColumn(ccId)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  {/* Add cost code column button */}
                  <th rowSpan={3} className="p-1 align-middle w-[120px]">
                    <Select
                      value=""
                      onValueChange={(value) => addCostCodeColumn(value)}
                    >
                      <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="+ Cost Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCostCodes.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} - {cc.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </th>
                  {/* Delete column */}
                  <th rowSpan={3} className="p-1 w-8"></th>
                </tr>

                {/* Column headers row */}
                <tr className="bg-muted/70 border-b">
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Employee</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Trade</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs border-r min-w-[90px]">
                    ST / OT
                  </th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Equip. # / Rental Co.</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Equip.</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[90px]">Idle</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[90px]">Down</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs border-r min-w-[90px]">Work</th>
                  {/* Cost code column headers */}
                  {allActiveCostCodeIds.map((ccId) => {
                    const cc = (costCodes || []).find((c) => c.id === ccId);
                    return (
                      <th key={ccId} className="text-center p-2 font-medium text-muted-foreground text-xs border-r min-w-[90px]">
                        {cc?.code || ccId}
                      </th>
                    );
                  })}
                </tr>

                {/* ST|OT sub-header row */}
                <tr className="bg-muted/40 border-b">
                  <th className="p-0"></th>
                  <th className="p-0"></th>
                  <th className="p-0 border-r"><SplitHeaderLabel /></th>
                  <th className="p-0"></th>
                  <th className="p-0"></th>
                  <th className="p-0"><SplitHeaderLabel /></th>
                  <th className="p-0"><SplitHeaderLabel /></th>
                  <th className="p-0 border-r"><SplitHeaderLabel /></th>
                  {allActiveCostCodeIds.map((ccId) => (
                    <th key={ccId} className="p-0 border-r"><SplitHeaderLabel /></th>
                  ))}
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
                    activeCostCodeIds={allActiveCostCodeIds}
                    onUpdate={(updates) => updateEntry(index, updates)}
                    onRemove={() => removeEntry(index)}
                  />
                ))}
                {/* Totals Row */}
                <tr className="border-t-2 bg-muted font-medium">
                  <td className="p-2">Totals</td>
                  <td className="p-2"></td>
                  <td className="p-2 border-r">
                    <div className="flex items-center justify-center gap-0 text-xs">
                      <span className="w-[45px] text-center font-bold">{totalST}</span>
                      <span className="text-border">|</span>
                      <span className="w-[45px] text-center font-bold">{totalOT}</span>
                    </div>
                  </td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-0 text-xs">
                      <span className="w-[45px] text-center">{entries.reduce((s, e) => s + e.idleStHours, 0) || ''}</span>
                      <span className="text-border">|</span>
                      <span className="w-[45px] text-center">{entries.reduce((s, e) => s + e.idleOtHours, 0) || ''}</span>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-0 text-xs">
                      <span className="w-[45px] text-center">{entries.reduce((s, e) => s + e.downStHours, 0) || ''}</span>
                      <span className="text-border">|</span>
                      <span className="w-[45px] text-center">{entries.reduce((s, e) => s + e.downOtHours, 0) || ''}</span>
                    </div>
                  </td>
                  <td className="p-2 border-r">
                    <div className="flex items-center justify-center gap-0 text-xs">
                      <span className="w-[45px] text-center">{entries.reduce((s, e) => s + e.workStHours, 0) || ''}</span>
                      <span className="text-border">|</span>
                      <span className="w-[45px] text-center">{entries.reduce((s, e) => s + e.workOtHours, 0) || ''}</span>
                    </div>
                  </td>
                  {allActiveCostCodeIds.map((ccId) => {
                    const stTotal = entries.reduce((s, e) => s + (e.costCodeHours?.[ccId]?.st || 0), 0);
                    const otTotal = entries.reduce((s, e) => s + (e.costCodeHours?.[ccId]?.ot || 0), 0);
                    return (
                      <td key={ccId} className="p-2 border-r">
                        <div className="flex items-center justify-center gap-0 text-xs">
                          <span className="w-[45px] text-center">{stTotal || ''}</span>
                          <span className="text-border">|</span>
                          <span className="w-[45px] text-center">{otTotal || ''}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2"></td>
                  <td className="p-2"></td>
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

interface TableRowProps {
  entry: LaborEntry;
  index: number;
  employees: { id: string; name: string; trade: Trade }[];
  equipment: { id: string; equipmentNumber: string; description: string }[];
  costCodes: { id: string; code: string; description: string }[];
  activeCostCodeIds: string[];
  onUpdate: (updates: Partial<LaborEntry>) => void;
  onRemove: () => void;
}

function TableRow({
  entry,
  index,
  employees,
  equipment,
  activeCostCodeIds,
  onUpdate,
  onRemove,
}: TableRowProps) {
  const selectedEquipment = equipment.find((e) => e.id === entry.equipmentId);

  function updateCostCodeHours(ccId: string, field: 'st' | 'ot', value: number) {
    const newHours = { ...entry.costCodeHours };
    newHours[ccId] = { ...newHours[ccId], [field]: value };
    // Default the other field if not set
    if (field === 'st' && newHours[ccId].ot === undefined) newHours[ccId].ot = 0;
    if (field === 'ot' && newHours[ccId].st === undefined) newHours[ccId].st = 0;
    onUpdate({ costCodeHours: newHours });
  }

  return (
    <tr className="border-b hover:bg-muted/50">
      {/* Employee */}
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
          <SelectTrigger className="h-8 text-sm min-w-[130px]">
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
      {/* Trade */}
      <td className="p-2">
        <Select
          value={entry.trade}
          onValueChange={(value) => onUpdate({ trade: value as Trade })}
        >
          <SelectTrigger className="h-8 text-sm w-[65px]">
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
      {/* ST | OT */}
      <td className="p-2 border-r">
        <SplitHoursCell
          stValue={entry.stHours}
          otValue={entry.otHours}
          onStChange={(v) => onUpdate({ stHours: v })}
          onOtChange={(v) => onUpdate({ otHours: v })}
        />
      </td>
      {/* Equip. # / Rental Co. */}
      <td className="p-2">
        {entry.equipmentId ? (
          <div className="flex items-center gap-1">
            <Select
              value={entry.equipmentId || 'none'}
              onValueChange={(value) => onUpdate({ equipmentId: value === 'none' ? undefined : value })}
            >
              <SelectTrigger className="h-8 text-sm w-[80px]">
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
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Select
              value="none"
              onValueChange={(value) => onUpdate({ equipmentId: value === 'none' ? undefined : value })}
            >
              <SelectTrigger className="h-8 text-sm min-w-[100px]">
                <SelectValue placeholder="Equip #" />
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
          </div>
        )}
        <Input
          type="text"
          value={entry.rentalCompany || ''}
          onChange={(e) => onUpdate({ rentalCompany: e.target.value || undefined })}
          placeholder="Rental Co."
          className="h-7 text-xs mt-1 min-w-[100px]"
        />
      </td>
      {/* Equip. description (auto-filled) */}
      <td className="p-2 text-xs text-muted-foreground min-w-[80px]">
        {selectedEquipment?.description || ''}
      </td>
      {/* Idle ST|OT */}
      <td className="p-2">
        <SplitHoursCell
          stValue={entry.idleStHours}
          otValue={entry.idleOtHours}
          onStChange={(v) => onUpdate({ idleStHours: v })}
          onOtChange={(v) => onUpdate({ idleOtHours: v })}
        />
      </td>
      {/* Down ST|OT */}
      <td className="p-2">
        <SplitHoursCell
          stValue={entry.downStHours}
          otValue={entry.downOtHours}
          onStChange={(v) => onUpdate({ downStHours: v })}
          onOtChange={(v) => onUpdate({ downOtHours: v })}
        />
      </td>
      {/* Work ST|OT */}
      <td className="p-2 border-r">
        <SplitHoursCell
          stValue={entry.workStHours}
          otValue={entry.workOtHours}
          onStChange={(v) => onUpdate({ workStHours: v })}
          onOtChange={(v) => onUpdate({ workOtHours: v })}
        />
      </td>
      {/* Dynamic cost code columns */}
      {activeCostCodeIds.map((ccId) => (
        <td key={ccId} className="p-2 border-r">
          <SplitHoursCell
            stValue={entry.costCodeHours?.[ccId]?.st || 0}
            otValue={entry.costCodeHours?.[ccId]?.ot || 0}
            onStChange={(v) => updateCostCodeHours(ccId, 'st', v)}
            onOtChange={(v) => updateCostCodeHours(ccId, 'ot', v)}
          />
        </td>
      ))}
      {/* Add cost code spacer */}
      <td className="p-2"></td>
      {/* Delete */}
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
