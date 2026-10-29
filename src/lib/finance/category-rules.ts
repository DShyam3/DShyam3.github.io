/**
 * Pure domain logic for category rules.
 *
 * Rules over rows (REHAUL_PLAN.md 7.P, 7.I):
 * - No model output in arithmetic or categorization paths.
 * - Rules are applied at read time; user-modified transactions are never overridden.
 * - First matching rule wins.
 */

export interface CategoryRule {
  id: string;
  profile_id?: string;
  merchant_pattern: string; // pattern or name to match
  category: string;
  rename_to?: string | null; // optional clean display name override
  created_at?: string;
  updated_at?: string;
}

export interface RuleImpactResult {
  matchingCount: number;
  unmodifiedCount: number; // rows whose category was not explicitly user-modified
  affectedTransactions: Array<{
    id: string;
    originalName: string;
    newName?: string;
    originalCategory?: string;
    newCategory: string;
  }>;
}

/**
 * Normalizes a merchant pattern or transaction name:
 * lowercases, trims outer whitespace, and collapses inner whitespace runs.
 */
export function normalizeMerchantPattern(pattern: string): string {
  if (!pattern) return '';
  return pattern.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Determines whether a transaction matches a category rule.
 *
 * Matches if the normalized rule pattern is a substring or exact match
 * of the normalized merchant_name, name, or description.
 * Empty or whitespace-only patterns never match.
 */
export function matchesCategoryRule(
  tx: {
    name?: string | null;
    description?: string | null;
    merchant_name?: string | null;
    merchant?: string | null;
  },
  rule: { merchant_pattern: string } | CategoryRule,
): boolean {
  if (!tx || !rule) return false;

  const pattern = normalizeMerchantPattern(rule.merchant_pattern);
  if (!pattern) return false;

  const candidates = [tx.merchant, tx.merchant_name, tx.name, tx.description];
  for (const field of candidates) {
    if (field && typeof field === 'string') {
      const normalizedField = normalizeMerchantPattern(field);
      if (normalizedField.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Pure mapping function applying category rules to transactions at read time.
 *
 * Rules:
 * - If `tx.user_modified === true` or `tx.userModified === true`: preserve `tx.category` and `tx.name`
 *   (a rule never overrides hand-assigned categories).
 * - First matching rule wins: set `category = rule.category`, and if `rule.rename_to` is non-empty, set `name = rule.rename_to`.
 * - If no rule matches, keep original `tx.category` and `tx.name`.
 */
export function applyCategoryRules<
  T extends {
    id: string;
    name: string;
    category?: string | null;
    user_modified?: boolean;
    userModified?: boolean;
    isReviewed?: boolean;
    is_reviewed?: boolean;
    merchant_name?: string | null;
    merchant?: string | null;
    description?: string | null;
  },
>(transactions: T[], rules: CategoryRule[]): T[] {
  if (!transactions) return [];
  if (!rules || rules.length === 0) {
    return transactions.map(tx => ({ ...tx }));
  }

  return transactions.map(tx => {
    // Hand-assigned or reviewed categories are sacrosanct
    if (
      tx.user_modified === true ||
      tx.userModified === true ||
      tx.isReviewed === true ||
      tx.is_reviewed === true
    ) {
      return { ...tx };
    }

    for (const rule of rules) {
      if (matchesCategoryRule(tx, rule)) {
        const rename = rule.rename_to?.trim();
        return {
          ...tx,
          category: rule.category,
          name: rename && rename.length > 0 ? rename : tx.name,
        };
      }
    }

    return { ...tx };
  });
}

/**
 * Determines the impact of creating or updating a category rule:
 * - `matchingCount`: how many transactions match the merchant pattern.
 * - `unmodifiedCount`: how many matching rows have not been explicitly user-modified.
 * - `affectedTransactions`: list of eligible rows with their original and new values.
 */
export function calculateRuleImpact<
  T extends {
    id: string;
    name: string;
    category?: string | null;
    user_modified?: boolean;
    userModified?: boolean;
    isReviewed?: boolean;
    is_reviewed?: boolean;
    merchant_name?: string | null;
    merchant?: string | null;
    description?: string | null;
  },
>(
  transactions: T[],
  rule: Omit<CategoryRule, 'id'> | CategoryRule,
): RuleImpactResult {
  if (!transactions || transactions.length === 0) {
    return {
      matchingCount: 0,
      unmodifiedCount: 0,
      affectedTransactions: [],
    };
  }

  const matchingTransactions = transactions.filter(tx => matchesCategoryRule(tx, rule));
  const matchingCount = matchingTransactions.length;

  const unmodified = matchingTransactions.filter(
    tx =>
      tx.user_modified !== true &&
      tx.userModified !== true &&
      tx.isReviewed !== true &&
      tx.is_reviewed !== true,
  );
  const unmodifiedCount = unmodified.length;

  const rename = rule.rename_to?.trim();
  const affectedTransactions = unmodified.map(tx => {
    const item: RuleImpactResult['affectedTransactions'][number] = {
      id: tx.id,
      originalName: tx.name,
      newCategory: rule.category,
    };

    if (rename && rename.length > 0) {
      item.newName = rename;
    }

    if (tx.category !== undefined && tx.category !== null && tx.category.trim().length > 0) {
      item.originalCategory = tx.category;
    }

    return item;
  });

  return {
    matchingCount,
    unmodifiedCount,
    affectedTransactions,
  };
}
