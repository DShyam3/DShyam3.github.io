import { useState, useEffect } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { ALL } from '@/hooks/useCollection';
import type {
  CollectionConfig,
  CollectionRow,
  FieldDef,
  FormValues,
} from '@/lib/collections/types';

interface EntityFormDialogProps<T extends CollectionRow> {
  mode: 'add' | 'edit';
  config: CollectionConfig<T>;
  /** Required in edit mode; the row being edited. */
  item?: T;
  onSubmit: (values: FormValues) => void;
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
export function EntityFormDialog<T extends CollectionRow>({
  mode,
  config,
  item,
  onSubmit,
}: EntityFormDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() =>
    initialValues(config.fields, item),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageFailed, setImageFailed] = useState<Record<string, boolean>>({});

  // Re-seed on open so an edit dialog never shows a stale row, and an add
  // dialog starts clean after a previous submit.
  useEffect(() => {
    if (open) {
      setValues(initialValues(config.fields, item));
      setErrors({});
      setImageFailed({});
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const missing = config.fields.filter(
      (f) => f.required && !values[f.name]?.trim(),
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

    // Empty optional fields are sent as undefined rather than '' so the column
    // stays null instead of collecting blank strings.
    onSubmit(
      Object.fromEntries(
        config.fields.map((f) => [f.name, values[f.name]?.trim() || undefined]),
      ) as FormValues,
    );

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
        {mode === 'add' ? (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add {config.noun.singular}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-primary hover:text-primary-foreground w-7 h-7"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {mode === 'add' ? `Add New ${config.noun.singular}` : `Edit ${config.noun.singular}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                ) : field.type === 'image' ? (
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      type="url"
                      value={value}
                      onChange={(e) => {
                        setValue(field.name, e.target.value);
                        setImageFailed((p) => ({ ...p, [field.name]: false }));
                      }}
                      placeholder={field.placeholder}
                    />
                    {value && !imageFailed[field.name] && (
                      <img
                        src={value}
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

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {mode === 'add' ? `Add ${config.noun.singular}` : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
