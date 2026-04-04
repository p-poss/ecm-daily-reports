import { useLiveQuery } from 'dexie-react-hooks';
import { db, generateId } from '@/db/database';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
import { Plus, X, HardHat, Truck } from 'lucide-react';
import type { SubcontractorWork, MaterialDelivered } from '@/types';

interface SubcontractorsDeliveriesSectionProps {
  subcontractorEntries: SubcontractorWork[];
  deliveryEntries: MaterialDelivered[];
  onSubcontractorsChange: (entries: SubcontractorWork[]) => void;
  onDeliveriesChange: (entries: MaterialDelivered[]) => void;
  dailyReportId: string;
}

export function SubcontractorsDeliveriesSection({
  subcontractorEntries,
  deliveryEntries,
  onSubcontractorsChange,
  onDeliveriesChange,
  dailyReportId,
}: SubcontractorsDeliveriesSectionProps) {
  const subcontractors = useLiveQuery(() => db.subcontractors.toArray());
  const costCodes = useLiveQuery(() => db.costCodes.toArray());

  function addSubcontractorEntry() {
    const newEntry: SubcontractorWork = {
      id: generateId(),
      dailyReportId,
      contractorId: '',
      itemsWorked: '',
    };
    onSubcontractorsChange([...subcontractorEntries, newEntry]);
  }

  function updateSubcontractorEntry(index: number, updates: Partial<SubcontractorWork>) {
    const newEntries = [...subcontractorEntries];
    newEntries[index] = { ...newEntries[index], ...updates };
    onSubcontractorsChange(newEntries);
  }

  function removeSubcontractorEntry(index: number) {
    onSubcontractorsChange(subcontractorEntries.filter((_, i) => i !== index));
  }

  function addDeliveryEntry() {
    const newEntry: MaterialDelivered = {
      id: generateId(),
      dailyReportId,
      supplier: '',
      material: '',
      quantity: '',
    };
    onDeliveriesChange([...deliveryEntries, newEntry]);
  }

  function updateDeliveryEntry(index: number, updates: Partial<MaterialDelivered>) {
    const newEntries = [...deliveryEntries];
    newEntries[index] = { ...newEntries[index], ...updates };
    onDeliveriesChange(newEntries);
  }

  function removeDeliveryEntry(index: number) {
    onDeliveriesChange(deliveryEntries.filter((_, i) => i !== index));
  }

  return (
    <>
      {/* Subcontractors */}
      <div className="space-y-[20px]">
        <h2 className="text-lg font-semibold flex items-center gap-3 px-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><HardHat className="w-3 h-3" /></span>
          Subcontractors
        </h2>
        <Card>
          <CardContent className="space-y-4 pt-4">
          {subcontractorEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No subcontractor entries.
            </p>
          ) : (
            subcontractorEntries.map((entry, index) => (
              <div key={entry.id} className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {index + 1}
                    </span>
                    <Label className="text-sm font-medium">Subcontractor</Label>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeSubcontractorEntry(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <Select
                  value={entry.contractorId || 'none'}
                  onValueChange={(value) =>
                    updateSubcontractorEntry(index, {
                      contractorId: value === 'none' ? '' : value,
                    })
                  }
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select subcontractor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select subcontractor</SelectItem>
                    {(subcontractors || []).map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  value={entry.itemsWorked}
                  onChange={(e) =>
                    updateSubcontractorEntry(index, { itemsWorked: e.target.value })
                  }
                  placeholder="Items worked on..."
                  rows={2}
                  className="text-base resize-none"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Production (optional)</Label>
                    <Input
                      value={entry.production || ''}
                      onChange={(e) =>
                        updateSubcontractorEntry(index, { production: e.target.value })
                      }
                      placeholder="e.g. 200 LF"
                      className="text-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cost Code (optional)</Label>
                    <Select
                      value={entry.costCodeId || 'none'}
                      onValueChange={(value) =>
                        updateSubcontractorEntry(index, {
                          costCodeId: value === 'none' ? undefined : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select cost code" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No cost code</SelectItem>
                        {(costCodes || []).map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} - {cc.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full btn-action"
            onClick={addSubcontractorEntry}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Subcontractor
          </Button>
          </CardContent>
        </Card>
      </div>

      <Separator className="h-[2px] bg-foreground mt-[90px]" />

      {/* Deliveries */}
      <div className="space-y-[20px] mt-[20px]">
        <h2 className="text-lg font-semibold flex items-center gap-3 px-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground"><Truck className="w-3 h-3" /></span>
          Deliveries
        </h2>
        <Card>
          <CardContent className="space-y-4 pt-4">
          {deliveryEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No delivery entries.
            </p>
          ) : (
            deliveryEntries.map((entry, index) => (
              <div key={entry.id} className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {index + 1}
                    </span>
                    <Label className="text-sm font-medium">Delivery</Label>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeDeliveryEntry(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <Input
                    value={entry.supplier}
                    onChange={(e) =>
                      updateDeliveryEntry(index, { supplier: e.target.value })
                    }
                    placeholder="Supplier name..."
                    className="text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Material</Label>
                    <Input
                      value={entry.material}
                      onChange={(e) =>
                        updateDeliveryEntry(index, { material: e.target.value })
                      }
                      placeholder="Material description..."
                      className="text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Quantity</Label>
                    <Input
                      value={entry.quantity}
                      onChange={(e) =>
                        updateDeliveryEntry(index, { quantity: e.target.value })
                      }
                      placeholder="e.g. 10 CY, 500 LF"
                      className="text-base"
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full btn-action"
            onClick={addDeliveryEntry}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Delivery
          </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
