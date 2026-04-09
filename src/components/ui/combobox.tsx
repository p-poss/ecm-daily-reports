'use client';

import * as React from 'react';
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ComboboxItem {
  /** Stable id stored in form state. */
  value: string;
  /** Primary label shown in the input and the list. */
  label: string;
  /** Optional secondary text shown muted next to the label. */
  detail?: string;
}

interface ComboboxProps {
  items: ComboboxItem[];
  /** Controlled selected value (an item.value), or empty string for none. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  /** Trigger height — matches the SelectTrigger sizes used elsewhere. */
  size?: 'default' | 'sm';
  /**
   * Which edge of the popup aligns with the same edge of the trigger.
   * 'start' = left-align, 'end' = right-align, 'center' = centered.
   * Defaults to 'start'.
   */
  align?: 'start' | 'center' | 'end';
}

/**
 * Single-input searchable combobox built on Base UI's Combobox primitive.
 * The input element is BOTH the trigger and the search field — typing into
 * it filters the popover list live. No separate search bar above the list.
 */
export function Combobox({
  items,
  value,
  onChange,
  placeholder = 'Select…',
  emptyText = 'No results.',
  disabled,
  className,
  size = 'default',
  align = 'start',
}: ComboboxProps) {
  // Resolve the controlled string value to its item object (Base UI compares
  // by reference / itemToStringValue).
  const selectedItem = React.useMemo(
    () => items.find((i) => i.value === value) ?? null,
    [items, value]
  );

  return (
    <BaseCombobox.Root
      items={items}
      value={selectedItem}
      onValueChange={(item) => {
        // item is the selected ComboboxItem (or null on clear).
        onChange((item as ComboboxItem | null)?.value ?? '');
      }}
      itemToStringLabel={(item) => (item as ComboboxItem).label}
      itemToStringValue={(item) => (item as ComboboxItem).value}
    >
      <BaseCombobox.InputGroup
        className={cn(
          'flex w-fit items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 text-sm md:text-xs/relaxed transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/30 dark:hover:bg-input/50',
          size === 'default' ? 'h-9 md:h-7' : 'h-8 md:h-6',
          className
        )}
      >
        <BaseCombobox.Input
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
        <BaseCombobox.Trigger
          disabled={disabled}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="size-3.5" />
        </BaseCombobox.Trigger>
      </BaseCombobox.InputGroup>

      <BaseCombobox.Portal>
        {/* z-index needs to live on the Positioner (the absolute-positioned
            wrapper). It's set high enough to win against any sticky table
            cells (z-[1]) and headers (z-10) the trigger might sit inside. */}
        <BaseCombobox.Positioner sideOffset={4} align={align} className="z-[60]">
          <BaseCombobox.Popup
            className={cn(
              'max-h-[300px] min-w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden',
              'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
              'transition-opacity duration-100'
            )}
          >
            <BaseCombobox.Empty className="py-6 text-center text-xs text-muted-foreground empty:hidden empty:p-0">
              {emptyText}
            </BaseCombobox.Empty>
            <BaseCombobox.List>
              {(item: ComboboxItem) => (
                <BaseCombobox.Item
                  key={item.value}
                  value={item}
                  className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs select-none data-[highlighted]:bg-input/50 data-[highlighted]:text-foreground"
                >
                  <BaseCombobox.ItemIndicator className="flex size-3.5 shrink-0 items-center justify-center">
                    <Check className="size-3.5" />
                  </BaseCombobox.ItemIndicator>
                  {/* Reserve indicator space when no item is selected */}
                  {selectedItem?.value !== item.value && <span className="size-3.5 shrink-0" />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.detail && (
                    <span className="text-muted-foreground truncate ml-2">{item.detail}</span>
                  )}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
