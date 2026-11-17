/**
 * The "Item Name" field of the add-budget-item dialog.
 *
 * Which control this is depends on the category: a preset dropdown for the
 * fifteen kinds that have one, plus either a provider box (subscriptions,
 * loans) or a free-text box (the custom entry), and a plain text box for a
 * category no preset group claims.
 *
 * All fifteen were written out as arms of one ternary chain -- ~670 lines that
 * differed only in their preset list and placeholder. The differences are data
 * now, in `budget-preset-groups.ts`; this renders them.
 */

import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import type { BudgetPresetGroup, BudgetPresetOption } from '../budget-preset-groups';

const SELECT_CLASS =
  "rounded-lg border border-primary/20 bg-background/50 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary hover:bg-background/80 transition-colors";

const FIELD_CLASS = 'rounded-lg h-10 border-primary/20 bg-background/50';

export interface BudgetPresetFieldProps {
  /** Null when no preset group claims the category: a plain name box. */
  group: BudgetPresetGroup | null;
  options: BudgetPresetOption[];
  selected: string;
  onSelect: (value: string) => void;
  provider: string;
  onProviderChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
}

export function BudgetPresetField({
  group,
  options,
  selected,
  onSelect,
  provider,
  onProviderChange,
  name,
  onNameChange,
}: BudgetPresetFieldProps) {
  if (!group) {
    return (
      <Input
        id="item-new-name"
        placeholder="e.g. Weekly Fuel"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className={FIELD_CLASS}
        required
      />
    );
  }

  const isCustom = selected === 'custom';

  return (
    <div className="space-y-2">
      <NativeSelect
        id={`${group.kind}-preset-select`}
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className={SELECT_CLASS}
      >
        {options.map((preset) => (
          <option key={preset.name} value={preset.name}>
            {preset.emoji} {preset.name}
          </option>
        ))}
        <option value="custom">{group.customLabel}</option>
      </NativeSelect>

      {group.provider && !isCustom ? (
        <div className="space-y-1 pt-1">
          <Label htmlFor={`${group.kind}-provider-input`} className="text-xs text-muted-foreground">
            {group.provider.label}
          </Label>
          <Input
            id={`${group.kind}-provider-input`}
            placeholder={group.provider.placeholder}
            maxLength={60}
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className={`${FIELD_CLASS} text-xs`}
          />
        </div>
      ) : isCustom ? (
        <Input
          id="item-new-name-custom"
          placeholder={group.customPlaceholder}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={FIELD_CLASS}
          required
        />
      ) : null}
    </div>
  );
}
