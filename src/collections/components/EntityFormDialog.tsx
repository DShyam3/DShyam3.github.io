import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Image as ImageIcon, Loader2, Pencil, Plus, Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/shared/ActionButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ALL } from '../useCollection';
import type {
  CollectionConfig,
  CollectionRow,
  FieldDef,
  FormValues,
} from '../types';

/** Click-to-select file input with a preview. Photos upload rather than paste a URL. */
function FileField<T extends CollectionRow>({
  id,
  field,
  preview,
  fileName,
  onPick,
}: {
  id: string;
  field: FieldDef<T>;
  preview?: string;
  fileName?: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div
        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <div className="space-y-2">
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-md object-cover" />
            {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            <p className="text-xs text-muted-foreground">Click to change</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Click to select a file</p>
            {field.placeholder && (
              <p className="text-xs text-muted-foreground">{field.placeholder}</p>
            )}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={field.accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
        }}
      />
    </>
  );
}

/** Upload / clear control sat beside an image URL field. */
function ImageUploadButton({
  onPick,
  hasFile,
  onClear,
}: {
  onPick: (file: File) => void;
  hasFile: boolean;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        title={hasFile ? 'Remove upload' : 'Upload an image'}
        onClick={() => (hasFile ? onClear() : inputRef.current?.click())}
      >
        {hasFile ? <X className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
        }}
      />
    </>
  );
}

interface EntityFormDialogProps<T extends CollectionRow, R> {
  mode: 'add' | 'edit';
  config: CollectionConfig<T, R>;
  /** Required in edit mode; the row being edited. */
  item?: T;
  onSubmit: (values: FormValues) => void;
  /**
   * What opens the form. Defaults to the pencil that sits over a card; the
   * detail dialog passes a labelled button instead, since it has the room and
   * nothing there is hovering over an image.
   */
  trigger?: ReactNode;
}

/**
 * The optional lookup step at the top of the add dialog: type, pick a result,
 * and the form fills itself in. Books searches Google Books; the watchlist
 * will search TMDB through the same interface.
 *
 * Split out so the hook it calls (config.externalSearch.useSearch) is only
 * mounted when a collection actually declares one -- calling it conditionally
 * inside EntityFormDialog would break the rules of hooks.
 */
function ExternalSearchField<R>({
  search: spec,
  onPick,
}: {
  search: NonNullable<CollectionConfig<CollectionRow, R>['externalSearch']>;
  onPick: (values: FormValues) => void;
}) {
  const [term, setTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { results, loading, search } = spec.useSearch();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setTerm(value);
    if (value.trim().length >= 2) {
      setShowResults(true);
      search(value);
    } else {
      setShowResults(false);
    }
  };

  return (
    <div className="space-y-2 relative" ref={boxRef}>
      <Label htmlFor="external-search">Search</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id="external-search"
          value={term}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={spec.placeholder}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.map((result) => (
            <button
              key={spec.resultKey(result as R)}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
              onClick={() => {
                onPick(spec.toValues(result as R));
                setShowResults(false);
                setTerm('');
                const message = spec.pickedMessage?.(result as R);
                if (message) toast.info(message);
              }}
            >
              {spec.renderResult(result as R)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function initialValues<T extends CollectionRow>(
  fields: FieldDef<T>[],
  item?: T,
): FormValues {
  return Object.fromEntries(
    fields.map((f) => [
      f.name,
      item ? String(item[f.name] ?? '') : (f.defaultValue ?? ''),
    ]),
  );
}

/**
 * One dialog for both adding and editing. Previously every collection shipped
 * an AddXDialog and an EditXDialog that were near-copies of each other, and
 * both hardcoded the category list -- which for links meant the same five
 * options were written out four separate times (add, edit, the hook, and the
 * card's label lookup). Here they come from the config's facet.
 */
export function EntityFormDialog<T extends CollectionRow, R>({
  mode,
  config,
  item,
  onSubmit,
  trigger,
}: EntityFormDialogProps<T, R>) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(config.fields, item),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageFailed, setImageFailed] = useState<Record<string, boolean>>({});
  // `file` fields hold a File plus a data-URL preview; `values` only ever holds
  // strings, and the uploaded public URL lands there on submit.
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  // Re-seed on open so an edit dialog never shows a stale row, and an add
  // dialog starts clean after a previous submit.
  useEffect(() => {
    if (open) {
      setValues(initialValues(config.fields, item));
      setErrors({});
      setImageFailed({});
      setFiles({});
      setPreviews({});
    }
  }, [open, item, config.fields]);

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleBlur = (field: FieldDef<T>) => {
    const merged = config.onFieldBlur?.(field.name, values);
    if (merged) setValues((prev) => ({ ...prev, ...merged }));
  };

  const pickFile = (field: FieldDef<T>, file: File) => {
    if (field.accept && !field.accept.split(',').includes(file.type)) {
      setErrors((prev) => ({ ...prev, [field.name]: 'Unsupported file type' }));
      return;
    }
    if (field.maxBytes && file.size > field.maxBytes) {
      const mb = Math.round(field.maxBytes / 1024 / 1024);
      setErrors((prev) => ({ ...prev, [field.name]: `Maximum file size is ${mb}MB` }));
      return;
    }
    setErrors((prev) => ({ ...prev, [field.name]: '' }));
    setFiles((prev) => ({ ...prev, [field.name]: file }));
    const reader = new FileReader();
    reader.onloadend = () =>
      setPreviews((prev) => ({ ...prev, [field.name]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // A file field counts as filled if a file is staged or a URL already exists.
    const missing = config.fields.filter((f) =>
      f.required && f.type === 'file'
        ? !files[f.name] && !values[f.name]?.trim()
        : f.required && !values[f.name]?.trim(),
    );
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.name, 'Required'])));
      toast.error('Please fill in all required fields');
      return;
    }

    const invalid = config.validate?.(values);
    if (invalid) {
      setErrors(invalid);
      return;
    }

    // Upload any staged files first; the public URL becomes the column value.
    const uploaded: FormValues = {};
    const staged = Object.entries(files);
    if (staged.length) {
      if (!config.uploadFile) {
        toast.error('This collection has a file field but no uploader');
        return;
      }
      setUploading(true);
      try {
        for (const [name, file] of staged) {
          uploaded[name] = await config.uploadFile(file);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload', { description: (error as Error).message });
        return;
      } finally {
        setUploading(false);
      }
    }

    // Empty optional fields are sent as undefined rather than '' so the column
    // stays null instead of collecting blank strings.
    onSubmit({
      ...(Object.fromEntries(
        config.fields.map((f) => [f.name, values[f.name]?.trim() || undefined]),
      ) as FormValues),
      ...uploaded,
    });

    toast.success(`${config.noun.singular} ${mode === 'add' ? 'added' : 'updated'}`);
    setOpen(false);
  };

  const optionsFor = (field: FieldDef<T>) =>
    field.options ??
    config.facets
      .find((f) => f.field === field.name)
      ?.options.filter((o) => o.key !== ALL) ??
    [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (mode === 'add' ? (
          <ActionButton icon={Plus} label={`Add ${config.noun.singular}`} />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-primary hover:text-primary-foreground w-7 h-7"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ))}
      </DialogTrigger>

      {/*
        The form is as long as the collection has fields, which on a tablet in
        portrait is taller than the screen: the title ran off the top and Save
        off the bottom, with nothing to scroll. So the dialog is capped at the
        viewport, the fields scroll, and the title and buttons stay put.
      */}
      <DialogContent className="sm:max-w-md p-0 max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 shrink-0">
          <DialogTitle className="font-serif text-xl">
            {mode === 'add' ? `Add New ${config.noun.singular}` : `Edit ${config.noun.singular}`}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 mt-4 flex-1 min-h-0 overflow-y-auto px-6"
        >
          {mode === 'add' && config.externalSearch && (
            <ExternalSearchField
              search={config.externalSearch}
              onPick={(picked) => setValues((prev) => ({ ...prev, ...picked }))}
            />
          )}

          {config.fields.map((field) => {
            const id = `${mode}-${config.table}-${field.name}`;
            const error = errors[field.name];
            const value = values[field.name] ?? '';

            return (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={id} className={error ? 'text-destructive' : undefined}>
                  {field.label}
                  {field.required && ' *'}
                </Label>

                {field.type === 'textarea' ? (
                  <Textarea
                    id={id}
                    value={value}
                    onChange={(e) => setValue(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={field.rows ?? 3}
                  />
                ) : field.type === 'select' ? (
                  <Select value={value} onValueChange={(v) => setValue(field.name, v)}>
                    <SelectTrigger id={id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsFor(field).map((opt) => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'file' ? (
                  <FileField
                    id={id}
                    field={field}
                    preview={previews[field.name] ?? values[field.name]}
                    fileName={files[field.name]?.name}
                    onPick={(file) => pickFile(field, file)}
                  />
                ) : field.type === 'image' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      type="url"
                      value={files[field.name] ? files[field.name].name : value}
                      readOnly={Boolean(files[field.name])}
                      onChange={(e) => {
                        setValue(field.name, e.target.value);
                        setImageFailed((p) => ({ ...p, [field.name]: false }));
                      }}
                      placeholder={field.placeholder}
                    />
                    {/* Paste a URL, or upload -- URLs go stale, and some
                        images were never online to begin with. */}
                    <ImageUploadButton
                      onPick={(file) => pickFile(field, file)}
                      hasFile={Boolean(files[field.name])}
                      onClear={() => {
                        setFiles((prev) => {
                          const next = { ...prev };
                          delete next[field.name];
                          return next;
                        });
                        setPreviews((prev) => {
                          const next = { ...prev };
                          delete next[field.name];
                          return next;
                        });
                      }}
                    />
                    {(previews[field.name] || (value && !imageFailed[field.name])) && (
                      <img
                        src={previews[field.name] || value}
                        alt="Preview"
                        className="h-8 w-8 shrink-0 rounded object-contain bg-secondary/30"
                        onError={() =>
                          setImageFailed((p) => ({ ...p, [field.name]: true }))
                        }
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    id={id}
                    type={field.type === 'url' ? 'url' : 'text'}
                    value={value}
                    onChange={(e) => setValue(field.name, e.target.value)}
                    onBlur={() => handleBlur(field)}
                    placeholder={field.placeholder}
                    className={cn(
                      error && 'border-destructive focus-visible:ring-destructive',
                    )}
                  />
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}
                {field.type === 'image' && imageFailed[field.name] && (
                  <p className="text-xs text-destructive">
                    Couldn't load an image from that URL
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 pt-4 pb-6 sticky bottom-0 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : mode === 'add' ? (
                `Add ${config.noun.singular}`
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
