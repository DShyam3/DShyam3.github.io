import type { LucideIcon } from 'lucide-react';
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
  /** Column this facet filters on. Compared as a string, so booleans work. */
  field: keyof T & string;
  /**
   * Options in display order. `all` is prepended automatically and means "no
   * filter", unless `includeAll` is false.
   */
  options: { key: string; label: string }[];
  /**
   * Inventory always shows exactly one category -- there is no "everything"
   * view -- so it opts out of the All option and starts on a real one.
   */
  includeAll?: boolean;
  /** Option selected on first render. Defaults to `all`. */
  defaultValue?: string;
}

/**
 * Section headings inside the grid. Wardrobe and homelab items are grouped by
 * subcategory; every other inventory category is a flat list.
 */
export interface GroupByDef<T> {
  field: keyof T & string;
  /**
   * Ordered groups for the current filter state, or undefined to not group.
   * Returning a list also fixes the display order of the sections.
   */
  groupsFor: (
    filters: Record<string, string>,
  ) => { key: string; label: string }[] | undefined;
  /** Heading for items whose group field is empty. */
  ungroupedLabel?: string;
}

/** A user-selectable sort order, shown as a toggle button above the grid. */
export interface SortOptionDef<T> {
  key: string;
  label: string;
  icon?: LucideIcon;
  compare: (a: T, b: T) => number;
  /** Hide the toggle while these filter values are active. */
  hiddenWhen?: (filters: Record<string, string>) => boolean;
}

/** Field types the generated add/edit form knows how to render. */
export type FieldType = 'text' | 'textarea' | 'url' | 'select' | 'image' | 'file';

/**
 * Card face shapes.
 *
 *   media  an image with text beneath. Everything with a picture.
 *   text   no image at all. Beliefs, where the quote is the content.
 *
 * The image's aspect ratio is per collection (`card.aspect`), because the
 * source images genuinely differ: book covers are 2:3, product shots and
 * photographs are square. Forcing one ratio on all of them cropped the covers.
 *
 * What is shared is the grid and the text block beneath the image, so every
 * card within a tab is exactly the same height and the columns line up
 * between tabs.
 */
export type CardVariant = 'media' | 'text';

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
  /** `file` only: accepted MIME types, and the size cap in bytes. */
  accept?: string;
  maxBytes?: number;
}

/** Values the form holds while being edited -- every input is a string. */
export type FormValues = Record<string, string>;

/**
 * An optional lookup step at the top of the add dialog: search an external
 * source, pick a result, and have the form prefilled from it.
 *
 * Books searches Google Books; the watchlist will search TMDB. Same shape.
 */
export interface ExternalSearch<R> {
  placeholder: string;
  /** Any hook returning debounced results, e.g. useGoogleBooks. */
  useSearch: () => {
    results: R[];
    loading: boolean;
    search: (query: string) => void;
  };
  /** A row in the results dropdown. */
  renderResult: (result: R) => ReactNode;
  /** Stable key for the result list. */
  resultKey: (result: R) => string;
  /** Form values to apply when a result is picked. */
  toValues: (result: R) => FormValues;
  /** Toast shown after picking, e.g. `Selected "Dune"`. */
  pickedMessage?: (result: R) => string;
}

/**
 * `R` is the external search result type, only used by collections that
 * declare `externalSearch`. It defaults to `never` so the common case stays
 * `CollectionConfig<SomeRow>`.
 */
export interface CollectionConfig<T extends CollectionRow, R = never> {
  /** Supabase table name. */
  table: string;
  /** Route path, e.g. '/links'. */
  path: string;
  /** Redirect non-admins to '/' instead of rendering. */
  adminOnly?: boolean;
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

  /**
   * How a card looks. `tile` is a wide row with a small icon (links,
   * inventory); `poster` is a 2:3 cover with text beneath (books, photos).
   * Each variant owns its grid and skeleton shape -- see CARD_LAYOUT in
   * EntityCard.tsx.
   */
  card: {
    variant: CardVariant;
    title: (item: T) => string;
    /** Small line under the title: a category label, or "by <author>". */
    subtitle?: (item: T) => string | undefined;
    /** Thumbnail, icon or cover. */
    image?: (item: T) => string | undefined;
    /** External link the detail dialog opens. */
    href?: (item: T) => string | undefined;
    /** Body text on the card face. */
    excerpt?: (item: T) => string | undefined;
    /** Corner label in the detail dialog. */
    badge?: (item: T) => string | undefined;
    /**
     * Show the image large in the detail dialog rather than as a thumbnail
     * beside the text, and offer it as a download. For collections where the
     * picture is the content -- photographs -- rather than a cover for it.
     */
    imageIsContent?: boolean;
    /** Shown when an item has no image. Defaults per variant. */
    fallbackIcon?: LucideIcon;
    /**
     * `cover` fills the box and crops; `contain` fits the whole image in, for
     * logos and favicons that would look wrong cropped.
     */
    imageFit?: 'cover' | 'contain';
    /**
     * CSS aspect-ratio for the image box, e.g. '2 / 3' for book covers or
     * '1 / 1' for product shots. Match it to the source images and `cover`
     * will not crop anything. Defaults to '1 / 1'.
     */
    aspect?: string;
    /**
     * Set false for collections with nothing worth a dialog. The card stops
     * being clickable and its title becomes the outbound link instead --
     * inventory items and links go straight to the shop or the site.
     */
    openable?: boolean;
    /** Right-aligned on the card face, e.g. an inventory item's price. */
    meta?: (item: T) => string | undefined;
    /** Dims the whole card, e.g. inventory items that are only wished for. */
    dimmed?: (item: T) => boolean;
  };

  /** Drives both the add and the edit dialog. */
  fields: FieldDef<T>[];

  /** Optional lookup step at the top of the add dialog. */
  externalSearch?: ExternalSearch<R>;

  /**
   * Required when any field has type 'file'. Uploads the chosen file and
   * returns the public URL to store in that column.
   */
  uploadFile?: (file: File) => Promise<string>;

  /** Group the grid into labelled sections. */
  groupBy?: GroupByDef<T>;

  /** Sort orders the reader can toggle between. */
  sortOptions?: SortOptionDef<T>[];

  /** Extra content in the row above the grid, e.g. a total valuation. */
  summary?: (items: T[], isAdmin: boolean) => ReactNode;

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
