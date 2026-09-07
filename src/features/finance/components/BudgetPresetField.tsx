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
import { Label } from '@/components/ui/label';
import type { BudgetPresetGroup, BudgetPresetOption } from '../budget-preset-groups';

/* The site has no styled <select>; this is the inline chevron the dialog has
   always used, kept verbatim so the control looks unchanged. */
const SELECT_CLASS =
  "flex w-full rounded-xl border border-primary/20 bg-background/50 h-10 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:bg-background/80 transition-colors";

const FIELD_CLASS = 'rounded-xl h-10 border-primary/20 bg-background/50';

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
      <select
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
      </select>

      {group.provider && !isCustom ? (
        <div className="space-y-1 pt-1">
          <Label htmlFor={`${group.kind}-provider-input`} className="text-xs text-muted-foreground">
            {group.provider.label}
          </Label>
          <Input
            id={`${group.kind}-provider-input`}
            placeholder={group.provider.placeholder}
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
