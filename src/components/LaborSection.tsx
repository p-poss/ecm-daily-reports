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
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Sheet, X } from 'lucide-react';
import type { LaborEntry, Trade } from '@/types';

const TRADE_CODES: { value: Trade; label: string }[] = [
  { value: 'N/A', label: 'N/A' },
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
  jobId: string;
  highlightedIds?: Set<string>;
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
    <div className="flex items-center border border-input bg-input/20 rounded-md overflow-hidden h-9 md:h-8 w-[90px] mx-auto">
      <Input
        type="number"
        min="0"
        max="24"
        step="0.5"
        value={stValue || ''}
        onChange={(e) => onStChange(parseFloat(e.target.value) || 0)}
        className="h-9 md:h-8 text-sm text-center flex-1 min-w-0 border-0 rounded-none bg-transparent focus-visible:ring-0 px-1"
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
        className="h-9 md:h-8 text-sm text-center flex-1 min-w-0 border-0 rounded-none bg-transparent focus-visible:ring-0 px-1"
        placeholder="OT"
      />
    </div>
  );
}

/** Split header cell showing "ST | OT" with a divider */
function SplitHeaderLabel() {
  return (
    <div className="flex items-center justify-center text-xs text-muted-foreground w-[90px] mx-auto">
      <span className="flex-1 text-center">ST</span>
      <span className="text-border">|</span>
      <span className="flex-1 text-center">OT</span>
    </div>
  );
}

export function LaborSection({ entries, onChange, dailyReportId, jobId, highlightedIds }: LaborSectionProps) {
  const [activeCostCodeIds, setActiveCostCodeIds] = useState<string[]>([]);
  const employees = useLiveQuery(() => db.employees.toArray());
  const equipment = useLiveQuery(() => db.equipment.toArray());
  const costCodes = useLiveQuery(
    () => db.costCodes.where('jobId').equals(jobId).toArray(),
    [jobId]
  );

  function addEntry() {
    const newEntry: LaborEntry = {
      id: generateId(),
      dailyReportId,
      employeeId: '',
      trade: 'N/A',
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
    <div className="space-y-[20px]">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-primary">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><Sheet className="w-3 h-3" /></span>
          Labor + Equipment
          {entries.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({entries.length} row{entries.length !== 1 ? 's' : ''})
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
            <p className="text-sm">No labor entries.</p>
          </CardContent>
        </Card>
      ) : (
        /* Table View - PDF-matching layout */
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Description row above cost code headers */}
              <thead>
                {/* Top row: section labels + cost code descriptions.
                    Every cell wraps its content in a fixed-height (h-5) flex
                    container so the X button on cost-code headers doesn't
                    push the row taller than the text-only cells, which would
                    cause a layout shift when columns are added/removed. */}
                <tr className="border-b border-b-border">
                  {/* Employee column spacer */}
                  <th className="p-2 pl-4 pt-4 w-[170px] min-w-[170px] max-w-[170px] sticky left-0 z-[1] bg-card shadow-[inset_-2px_0_0_0_var(--border)]">
                    <div className="h-5" />
                  </th>
                  {/* LABOR section header */}
                  <th colSpan={2} className="text-left p-2 pt-4 font-bold text-xs uppercase tracking-wider border-r border-r-border">
                    <div className="h-5 flex items-center">Labor</div>
                  </th>
                  {/* EQUIPMENT section header */}
                  <th colSpan={6} className="text-left p-2 pt-4 font-bold text-xs uppercase tracking-wider border-r border-r-border">
                    <div className="h-5 flex items-center">Equipment</div>
                  </th>
                  {/* Cost code description labels */}
                  {allActiveCostCodeIds.map((ccId) => {
                    const cc = (costCodes || []).find((c) => c.id === ccId);
                    return (
                      <th key={ccId} className="text-left p-2 pt-4 font-bold text-xs uppercase tracking-wider border-r border-r-border w-[160px] min-w-[160px] max-w-[160px]">
                        <div className="h-5 flex items-center justify-between overflow-hidden gap-2">
                          <span className="truncate min-w-0" title={cc?.description}>
                            {cc?.description || ''}
                          </span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-xs"
                            onClick={() => removeCostCodeColumn(ccId)}
                            className="shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </th>
                    );
                  })}
                  {/* Add cost code column button */}
                  <th rowSpan={3} colSpan={2} className="p-1 pl-2 pr-4 pt-4 align-top w-[160px] min-w-[160px] max-w-[160px]">
                    <Combobox
                      className="h-9 md:h-8 text-xs w-full"
                      value=""
                      onChange={(value) => { if (value) addCostCodeColumn(value); }}
                      items={availableCostCodes.map((cc) => ({
                        value: cc.id,
                        label: cc.code,
                        detail: cc.description,
                      }))}
                      placeholder={"+\u00A0\u00A0Cost Code"}
                      emptyText="No cost codes match."
                      align="end"
                    />
                  </th>
                </tr>

                {/* Column headers row */}
                <tr className="border-b border-b-border">
                  <th className="text-left p-2 pl-4 font-medium text-muted-foreground text-xs w-[170px] min-w-[170px] max-w-[170px] sticky left-0 z-[1] bg-card shadow-[inset_-2px_0_0_0_var(--border)]">Employee</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs">Trade</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs border-r border-r-border min-w-[90px]">
                    ST / OT
                  </th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[110px]">Equip. #</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs min-w-[110px]">Rental Co.</th>
                  <th className="text-left p-2 font-medium text-muted-foreground text-xs w-[180px]">Equip.</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[90px]">Idle</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[90px]">Down</th>
                  <th className="text-center p-2 font-medium text-muted-foreground text-xs border-r border-r-border min-w-[90px]">Work</th>
                  {/* Cost code column headers */}
                  {allActiveCostCodeIds.map((ccId) => {
                    const cc = (costCodes || []).find((c) => c.id === ccId);
                    return (
                      <th key={ccId} className="text-center p-2 font-medium text-muted-foreground text-xs border-r border-r-border w-[160px] min-w-[160px] max-w-[160px]">
                        {cc?.code || ccId}
                      </th>
                    );
                  })}
                </tr>

                {/* ST|OT sub-header row */}
                <tr className="border-b border-b-border">
                  <th className="p-0 pl-4 w-[170px] min-w-[170px] max-w-[170px] sticky left-0 z-[1] bg-card shadow-[inset_-2px_0_0_0_var(--border)]"></th>
                  <th className="p-0"></th>
                  <th className="p-0 border-r border-r-border"><SplitHeaderLabel /></th>
                  <th className="p-0"></th>
                  <th className="p-0"></th>
                  <th className="p-0"></th>
                  <th className="p-0"><SplitHeaderLabel /></th>
                  <th className="p-0"><SplitHeaderLabel /></th>
                  <th className="p-0 border-r border-r-border"><SplitHeaderLabel /></th>
                  {allActiveCostCodeIds.map((ccId) => (
                    <th key={ccId} className="p-0 border-r border-r-border w-[160px] min-w-[160px] max-w-[160px]"><SplitHeaderLabel /></th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {entries.map((entry, index) => (
                  <TableRow
                    key={entry.id}
                    entry={entry}
                    employees={employees || []}
                    equipment={equipment || []}
                    costCodes={costCodes || []}
                    activeCostCodeIds={allActiveCostCodeIds}
                    onUpdate={(updates) => updateEntry(index, updates)}
                    onRemove={() => removeEntry(index)}
                    highlighted={highlightedIds?.has(entry.id)}
                  />
                ))}
                {/* Totals Row */}
                <tr className="border-t-2 border-t-border font-medium">
                  <td className="p-2 pl-4 pb-4 w-[170px] min-w-[170px] max-w-[170px] sticky left-0 z-[1] bg-card shadow-[inset_-2px_0_0_0_var(--border)]"></td>
                  <td className="p-2 pb-4">Totals</td>
                  <td className="p-2 pb-4 border-r border-r-border">
                    <div className="flex items-center justify-center w-[90px] mx-auto text-xs">
                      <span className="flex-1 text-center font-bold">{totalST}</span>
                      <span className="text-border">|</span>
                      <span className="flex-1 text-center font-bold">{totalOT}</span>
                    </div>
                  </td>
                  <td className="p-2 pb-4"></td>
                  <td className="p-2 pb-4"></td>
                  <td className="p-2 pb-4"></td>
                  <td className="p-2 pb-4">
                    <div className="flex items-center justify-center w-[90px] mx-auto text-xs">
                      <span className="flex-1 text-center">{entries.reduce((s, e) => s + e.idleStHours, 0) || ''}</span>
                      <span className="text-border">|</span>
                      <span className="flex-1 text-center">{entries.reduce((s, e) => s + e.idleOtHours, 0) || ''}</span>
                    </div>
                  </td>
                  <td className="p-2 pb-4">
                    <div className="flex items-center justify-center w-[90px] mx-auto text-xs">
                      <span className="flex-1 text-center">{entries.reduce((s, e) => s + e.downStHours, 0) || ''}</span>
                      <span className="text-border">|</span>
                      <span className="flex-1 text-center">{entries.reduce((s, e) => s + e.downOtHours, 0) || ''}</span>
                    </div>
                  </td>
                  <td className="p-2 pb-4 border-r border-r-border">
                    <div className="flex items-center justify-center w-[90px] mx-auto text-xs">
                      <span className="flex-1 text-center">{entries.reduce((s, e) => s + e.workStHours, 0) || ''}</span>
                      <span className="text-border">|</span>
                      <span className="flex-1 text-center">{entries.reduce((s, e) => s + e.workOtHours, 0) || ''}</span>
                    </div>
                  </td>
                  {allActiveCostCodeIds.map((ccId) => {
                    const stTotal = entries.reduce((s, e) => s + (e.costCodeHours?.[ccId]?.st || 0), 0);
                    const otTotal = entries.reduce((s, e) => s + (e.costCodeHours?.[ccId]?.ot || 0), 0);
                    return (
                      <td key={ccId} className="p-2 pb-4 border-r border-r-border w-[160px] min-w-[160px] max-w-[160px]">
                        <div className="flex items-center justify-center w-[90px] mx-auto text-xs">
                          <span className="flex-1 text-center">{stTotal || ''}</span>
                          <span className="text-border">|</span>
                          <span className="flex-1 text-center">{otTotal || ''}</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 pb-4"></td>
                  <td className="p-2 pb-4 pr-4"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Row Button */}
      <Button
        type="button"
        variant="outline"
        className="w-full btn-action"
        onClick={addEntry}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Row
      </Button>
    </div>
  );
}

interface TableRowProps {
  entry: LaborEntry;
  employees: { id: string; name: string; trade: Trade }[];
  equipment: { id: string; equipmentNumber: string; description: string }[];
  costCodes: { id: string; code: string; description: string }[];
  activeCostCodeIds: string[];
  onUpdate: (updates: Partial<LaborEntry>) => void;
  onRemove: () => void;
  highlighted?: boolean;
}

function TableRow({
  entry,
  employees,
  equipment,
  activeCostCodeIds,
  onUpdate,
  onRemove,
  highlighted,
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
    <tr className={`border-b border-b-border ${highlighted ? 'ai-highlight' : ''}`}>
      {/* Employee */}
      <td className="p-2 pl-4 w-[170px] min-w-[170px] max-w-[170px] sticky left-0 z-[1] bg-card shadow-[inset_-2px_0_0_0_var(--border)]">
        <Combobox
          className="h-8 text-sm w-full"
          value={entry.employeeId || ''}
          onChange={(value) => {
            // Backspacing the input fires onChange(''); explicitly picking
            // the N/A item fires onChange('__none__'). Both clear.
            if (!value || value === '__none__') {
              onUpdate({ employeeId: '', trade: 'N/A' });
              return;
            }
            const emp = employees.find((e) => e.id === value);
            onUpdate({
              employeeId: value,
              trade: emp?.trade || entry.trade,
            });
          }}
          items={[
            { value: '__none__', label: 'N/A' },
            ...employees.map((emp) => ({
              value: emp.id,
              label: emp.name,
              detail: emp.trade,
            })),
          ]}
          placeholder="N/A"
          emptyText="No employees match."
        />
      </td>
      {/* Trade */}
      <td className="p-2">
        <Select
          value={entry.trade}
          onValueChange={(value) => onUpdate({ trade: value as Trade })}
        >
          <SelectTrigger className="h-8 text-sm w-[90px]">
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
      <td className="p-2 border-r border-r-border">
        <SplitHoursCell
          stValue={entry.stHours}
          otValue={entry.otHours}
          onStChange={(v) => onUpdate({ stHours: v })}
          onOtChange={(v) => onUpdate({ otHours: v })}
        />
      </td>
      {/* Equip. # / Rental Co. */}
      <td className="p-2">
        <div>
          <Select
            value={entry.equipmentId || 'none'}
            onValueChange={(value) => onUpdate({ equipmentId: value === 'none' ? undefined : value })}
          >
            <SelectTrigger className="h-8 text-sm w-[100px]">
              <SelectValue placeholder="Equip #" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">N/A</SelectItem>
              {equipment.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  #{eq.equipmentNumber}
                </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
      </td>
      {/* Rental Co. */}
      <td className="p-2">
        {entry.equipmentId ? (
          <span className="text-xs text-muted-foreground">ECM</span>
        ) : (
          <Input
            type="text"
            value={entry.rentalCompany || ''}
            onChange={(e) => onUpdate({ rentalCompany: e.target.value || undefined })}
            placeholder="Rental Co."
            className="h-8 text-sm w-[100px]"
          />
        )}
      </td>
      {/* Equip. description */}
      <td className="p-2">
        {entry.equipmentId ? (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{selectedEquipment?.description || ''}</span>
        ) : (
          <Input
            type="text"
            value={entry.equipmentDescription || ''}
            onChange={(e) => onUpdate({ equipmentDescription: e.target.value || undefined })}
            placeholder="Equip."
            className="h-8 text-sm min-w-[100px]"
          />
        )}
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
      <td className="p-2 border-r border-r-border">
        <SplitHoursCell
          stValue={entry.workStHours}
          otValue={entry.workOtHours}
          onStChange={(v) => onUpdate({ workStHours: v })}
          onOtChange={(v) => onUpdate({ workOtHours: v })}
        />
      </td>
      {/* Dynamic cost code columns */}
      {activeCostCodeIds.map((ccId) => (
        <td key={ccId} className="p-2 border-r border-r-border w-[160px] min-w-[160px] max-w-[160px]">
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
      <td className="p-2 pr-4 text-right">
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="h-8 w-8 ml-auto"
          onClick={onRemove}
        >
          <X className="w-4 h-4" />
        </Button>
      </td>
    </tr>
  );
}
