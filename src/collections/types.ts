import type { ReactNode } from 'react';

/**
 * A collection is a table of items the site lists, filters and edits: books,
 * links, recipes, and so on. Each one is described by a single config object
 * rather than its own hook, grid, card, nav and pair of dialogs.
 *
 * Adding a collection should mean writing one file in src/collections/ and one
 * migration. If it needs a new component, the config is missing something.
 */

/** A row as it comes back from Supabase: real column names, `id` guaranteed. */
export interface CollectionRow {
  id: string;
  [column: string]: unknown;
}

/**
 * One filter dimension. Books and links have a single facet (category);
 * watchlist has six (category, platform, genre, status, ...). The shape is the
 * same either way, so pages do not each reinvent the filtering.
 */
export interface FacetDef<T> {
  /** Stable key used in the filter state, e.g. 'category'. */
  key: string;
  /** Column this facet filters on. */
  field: keyof T & string;
  /**
   * Options in display order. `all` is added automatically as the first
   * option and means "no filter".
   */
  options: { key: string; label: string }[];
}

/** Field types the generated add/edit form knows how to render. */
export type FieldType = 'text' | 'textarea' | 'url' | 'select' | 'image';

export interface FieldDef<T> {
  name: keyof T & string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** Rows for `textarea`. */
  rows?: number;
  /** Options for `select`. Defaults to the matching facet's options. */
  options?: { key: string; label: string }[];
  /** Value used when the add form is opened. */
  defaultValue?: string;
}

/** Values the form holds while being edited -- every input is a string. */
export type FormValues = Record<string, string>;

export interface CollectionConfig<T extends CollectionRow> {
  /** Supabase table name. */
  table: string;
  /** Route path, e.g. '/links'. */
  path: string;
  /** Page header. */
  title: string;
  subtitle: string;
  /** Used in counts and button labels: "3 links", "Add Link". */
  noun: { singular: string; plural: string };

  /** Column to order by. Defaults to 'created_at' descending. */
  sortColumn?: string;
  sortAscending?: boolean;

  /** Columns searched by the search box. Omit to hide the search box. */
  searchFields?: (keyof T & string)[];

  /** Filter dimensions. Usually one. */
  facets: FacetDef<T>[];

  /** How a card looks. Only 'tile' exists so far -- see EntityCard. */
  card: {
    variant: 'tile';
    title: (item: T) => string;
    /** Small line under the title, typically the category label. */
    subtitle?: (item: T) => string | undefined;
    /** Thumbnail or icon. */
    image?: (item: T) => string | undefined;
    /** External link the detail dialog opens. */
    href?: (item: T) => string | undefined;
    /** Body text on the card face. */
    excerpt?: (item: T) => string | undefined;
  };

  /** Drives both the add and the edit dialog. */
  fields: FieldDef<T>[];

  /** Contents of the detail dialog, below the shared chrome. */
  renderDetail?: (item: T) => ReactNode;

  /**
   * Optional hook for per-collection form behaviour, e.g. links auto-filling a
   * favicon once a URL is entered. Returns the values to merge in, or null.
   */
  onFieldBlur?: (
    field: keyof T & string,
    values: FormValues,
  ) => Partial<FormValues> | null;

  /** Validate on submit. Return a message keyed by field, or null if valid. */
  validate?: (values: FormValues) => Record<string, string> | null;
}
