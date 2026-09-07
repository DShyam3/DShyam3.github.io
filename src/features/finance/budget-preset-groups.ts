/**
 * The budget item presets, as data.
 *
 * Adding an item to a budget category offers a dropdown of presets for that
 * kind of category -- savings, housing, subscriptions and so on. Fifteen
 * categories, and every one of them was written out longhand: its own
 * `useState`, its own branch of a fifteen-arm `if/else` chain seeding the
 * dialog, and its own ~50-line arm of a fifteen-deep JSX ternary. The three
 * had to be kept in step by hand, and the only thing that actually differed
 * between them was the four or five values below.
 *
 * So they live here instead, in declaration order, because the matcher is a
 * first-match-wins scan and the original chain's order is part of its
 * behaviour: `savings` is tested by group before any of the name predicates
 * get a look at the category.
 */

import type { BudgetCategory, FinanceSettings } from '@/features/finance/finance-types';
import {
  ALL_SAVINGS_IDS,
  EDUCATION_CAREER_PRESETS,
  FAMILY_KIDS_PRESETS,
  FOOD_ENTERTAINMENT_PRESETS,
  GIFTS_DONATIONS_PRESETS,
  HEALTH_WELLNESS_PRESETS,
  HOUSING_PRESETS,
  INSURANCE_PRESETS,
  LOANS_PRESETS,
  OTHER_PRESETS,
  PETS_PRESETS,
  SAVINGS_PRESETS,
  SHOPPING_PRESETS,
  SUBSCRIPTION_PRESETS,
  TRANSPORT_PRESETS,
  TRAVEL_HOLIDAYS_PRESETS,
  isDiscretionaryCategory,
  isEducationCareerCategory,
  isFamilyKidsCategory,
  isGiftsDonationsCategory,
  isHealthWellnessCategory,
  isHousingCategory,
  isInsuranceCategory,
  isLoansCategory,
  isOtherCategory,
  isPetsCategory,
  isShoppingCategory,
  isSubscriptionsCategory,
  isTransportCategory,
  isTravelHolidaysCategory,
} from './finance-defaults';

/** Only the two fields the picker reads; the JSON rows carry more. */
export interface BudgetPresetOption {
  name: string;
  emoji: string;
}

export interface BudgetPresetGroup {
  /** Keys this group's selection, and names its <select> for tests and labels. */
  kind: string;
  matches: (cat: BudgetCategory) => boolean;
  /**
   * A function, not an array, because savings offers only the types the user
   * has switched on in settings -- and that set can be empty.
   */
  options: (settings: FinanceSettings) => BudgetPresetOption[];
  /** Used when a preset carries no emoji, and for the custom entry. */
  fallbackEmoji: string;
  customLabel: string;
  customPlaceholder: string;
  /**
   * Subscriptions and loans ask for a provider alongside the preset, and the
   * two are combined into the item name as "Preset (Provider)".
   */
  provider?: { label: string; placeholder: string };
}

export const BUDGET_PRESET_GROUPS: readonly BudgetPresetGroup[] = [
  {
    kind: 'savings',
    // By group, not by name: the only arm of the original chain that was not
    // a name predicate.
    matches: (cat) => cat.group === 'savings',
    options: (settings) => {
      const active = settings.activeSavingsTypes || ALL_SAVINGS_IDS;
      return SAVINGS_PRESETS.filter(p =>
        active.includes(p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')),
      );
    },
    fallbackEmoji: '💰',
    customLabel: '✍️ Custom savings type...',
    customPlaceholder: 'e.g. Dream House Fund',
  },
  {
    kind: 'discretionary',
    matches: isDiscretionaryCategory,
    options: () => FOOD_ENTERTAINMENT_PRESETS,
    fallbackEmoji: '🍔',
    customLabel: '✍️ Custom discretionary type...',
    customPlaceholder: 'e.g. Weekly Coffee Run',
  },
  {
    kind: 'housing',
    matches: isHousingCategory,
    options: () => HOUSING_PRESETS,
    fallbackEmoji: '🏠',
    customLabel: '✍️ Custom housing type...',
    customPlaceholder: 'e.g. Service Charges',
  },
  {
    kind: 'insurance',
    matches: isInsuranceCategory,
    options: () => INSURANCE_PRESETS,
    fallbackEmoji: '🛡️',
    customLabel: '✍️ Custom insurance type...',
    customPlaceholder: 'e.g. Appliance Cover',
  },
  {
    kind: 'transport',
    matches: isTransportCategory,
    options: () => TRANSPORT_PRESETS,
    fallbackEmoji: '🚗',
    customLabel: '✍️ Custom transport type...',
    customPlaceholder: 'e.g. Helicopter ride',
  },
  {
    kind: 'subscription',
    matches: isSubscriptionsCategory,
    options: () => SUBSCRIPTION_PRESETS,
    fallbackEmoji: '📺',
    customLabel: '✍️ Custom subscription type...',
    customPlaceholder: 'e.g. Bespoke Monthly Box',
    provider: { label: 'Service Name / Provider', placeholder: 'e.g. Netflix, ChatGPT, iCloud' },
  },
  {
    kind: 'loan',
    matches: isLoansCategory,
    options: () => LOANS_PRESETS,
    fallbackEmoji: '💳',
    customLabel: '✍️ Custom loan type...',
    customPlaceholder: 'e.g. Family Loan',
    provider: { label: 'Lender / Provider', placeholder: 'e.g. Klarna, Student Loans Company, Halifax' },
  },
  {
    kind: 'gifts',
    matches: isGiftsDonationsCategory,
    options: () => GIFTS_DONATIONS_PRESETS,
    fallbackEmoji: '🎁',
    customLabel: '✍️ Custom gift/donation type...',
    customPlaceholder: 'e.g. Anniversary Gift',
  },
  {
    kind: 'health',
    matches: isHealthWellnessCategory,
    options: () => HEALTH_WELLNESS_PRESETS,
    fallbackEmoji: '🏥',
    customLabel: '✍️ Custom health type...',
    customPlaceholder: 'e.g. Chiropractor',
  },
  {
    kind: 'pets',
    matches: isPetsCategory,
    options: () => PETS_PRESETS,
    fallbackEmoji: '🐱',
    customLabel: '✍️ Custom pet type...',
    customPlaceholder: 'e.g. Pet Sitting',
  },
  {
    kind: 'shopping',
    matches: isShoppingCategory,
    options: () => SHOPPING_PRESETS,
    fallbackEmoji: '🛍️',
    customLabel: '✍️ Custom shopping type...',
    customPlaceholder: 'e.g. Gadget Purchase',
  },
  {
    kind: 'travel',
    matches: isTravelHolidaysCategory,
    options: () => TRAVEL_HOLIDAYS_PRESETS,
    fallbackEmoji: '🏖️',
    customLabel: '✍️ Custom travel type...',
    customPlaceholder: 'e.g. Weekend Getaway',
  },
  {
    kind: 'other',
    matches: isOtherCategory,
    options: () => OTHER_PRESETS,
    fallbackEmoji: '🌀',
    customLabel: '✍️ Custom other type...',
    customPlaceholder: 'e.g. Cash withdrawal',
  },
  {
    kind: 'family',
    matches: isFamilyKidsCategory,
    options: () => FAMILY_KIDS_PRESETS,
    fallbackEmoji: '🚸',
    customLabel: '✍️ Custom family/kids type...',
    customPlaceholder: 'e.g. School Trip',
  },
  {
    kind: 'education',
    matches: isEducationCareerCategory,
    options: () => EDUCATION_CAREER_PRESETS,
    fallbackEmoji: '🎓',
    customLabel: '✍️ Custom education type...',
    customPlaceholder: 'e.g. Udemy course',
  },
];

/** First match wins, mirroring the if/else chain this replaced. */
export function presetGroupFor(cat: BudgetCategory | null | undefined): BudgetPresetGroup | null {
  if (!cat) return null;
  return BUDGET_PRESET_GROUPS.find(group => group.matches(cat)) ?? null;
}

/**
 * What the add-item dialog should show when it opens on `cat`.
 *
 * Returns the preset to preselect and the emoji to seed the item with. A group
 * whose options are all switched off (savings, with nothing enabled) falls
 * through to the custom entry rather than preselecting nothing.
 */
export function initialPresetSelection(
  cat: BudgetCategory | null | undefined,
  settings: FinanceSettings,
): { kind: string; selected: string; name: string; emoji: string } | null {
  const group = presetGroupFor(cat);
  if (!group) return null;

  const options = group.options(settings);
  if (options.length === 0) {
    return { kind: group.kind, selected: 'custom', name: '', emoji: group.fallbackEmoji };
  }
  const first = options[0];
  return { kind: group.kind, selected: first.name, name: first.name, emoji: first.emoji || group.fallbackEmoji };
}

/**
 * The name an added item ends up with.
 *
 * Groups that ask for a provider fold it into the name -- "Netflix" under a
 * "Streaming" preset becomes "Streaming (Netflix)" -- because the item list
 * shows one line per item and the preset alone would not say which service it
 * was. Everything else, including the custom entry, uses the typed name.
 */
export function resolveItemName(
  group: BudgetPresetGroup | null,
  selected: string,
  provider: string,
  typedName: string,
): string {
  if (!group?.provider || selected === 'custom') return typedName;
  const trimmed = provider.trim();
  return trimmed ? `${selected} (${trimmed})` : selected;
}
