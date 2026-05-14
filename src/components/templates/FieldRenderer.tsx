import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Field } from "@/templates/types";
import { computeFieldValue, computeScoredScale } from "@/templates/runtime";

interface FieldRendererProps {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  // Valores da seção inteira — usados em campos `computed` que referenciam vizinhos.
  sectionValues: Record<string, unknown>;
  readOnly?: boolean;
}

export function FieldRenderer({ field, value, onChange, sectionValues, readOnly }: FieldRendererProps) {
  const disabled = readOnly;

  switch (field.type) {
    case "text":
      return (
        <Field label={field.label} required={field.required}>
          <Input
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            disabled={disabled}
          />
        </Field>
      );

    case "textarea":
      return (
        <Field label={field.label} required={field.required}>
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={field.rows ?? 3}
            maxLength={field.maxLength}
            disabled={disabled}
          />
        </Field>
      );

    case "number":
      return (
        <Field label={field.label} required={field.required}>
          <Input
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            disabled={disabled}
          />
        </Field>
      );

    case "number_with_unit":
      return (
        <Field label={field.label} required={field.required}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={value === null || value === undefined ? "" : String(value)}
              onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
              min={field.min}
              max={field.max}
              step={field.step}
              disabled={disabled}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">{field.unit}</span>
          </div>
        </Field>
      );

    case "date":
      return (
        <Field label={field.label} required={field.required}>
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            min={field.min === "today" ? undefined : field.min}
            max={field.max === "today" ? new Date().toISOString().slice(0, 10) : field.max}
            disabled={disabled}
          />
        </Field>
      );

    case "datetime":
      return (
        <Field label={field.label} required={field.required}>
          <Input
            type="datetime-local"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
          />
        </Field>
      );

    case "boolean":
      return (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label className="cursor-pointer">{field.label}</Label>
          <Switch
            checked={!!value}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        </div>
      );

    case "radio":
      return (
        <Field label={field.label} required={field.required}>
          <RadioGroup
            value={(value as string) ?? ""}
            onValueChange={onChange}
            disabled={disabled}
            className="grid gap-1.5"
          >
            {field.options.map((opt) => (
              <label
                key={String(opt.value)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <RadioGroupItem value={String(opt.value)} />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        </Field>
      );

    case "select":
      return (
        <Field label={field.label} required={field.required}>
          <Select
            value={(value as string) ?? ""}
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );

    case "multi_checkbox": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (v: string) => {
        if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
        else onChange([...arr, v]);
      };
      return (
        <Field label={field.label} required={field.required}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {field.options.map((opt) => {
              const checked = arr.includes(String(opt.value));
              return (
                <label
                  key={String(opt.value)}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(String(opt.value))}
                    disabled={disabled}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </Field>
      );
    }

    case "scale": {
      const v = typeof value === "number" ? value : field.min;
      return (
        <Field label={field.label} required={field.required}>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Slider
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                value={[v]}
                onValueChange={(arr) => onChange(arr[0])}
                disabled={disabled}
                className="flex-1"
              />
              <span className="font-mono tabular-nums text-sm w-8 text-right">{v}</span>
            </div>
            {field.labels && (
              <div className="flex justify-between text-xs text-muted-foreground">
                {Object.entries(field.labels).map(([k, l]) => (
                  <span key={k}>{l}</span>
                ))}
              </div>
            )}
          </div>
        </Field>
      );
    }

    case "scored_scale": {
      const obj = (value as Record<string, number> | undefined) ?? {};
      const { total, classification } = computeScoredScale(field, obj);
      return (
        <Field label={field.label} required={field.required}>
          <div className="space-y-3 rounded-md border p-3 bg-muted/20">
            {field.items.map((item) => (
              <div key={item.id}>
                <Label className="text-xs mb-1">{item.label}</Label>
                <Select
                  value={obj[item.id] !== undefined ? String(obj[item.id]) : ""}
                  onValueChange={(v) =>
                    onChange({ ...obj, [item.id]: Number(v) })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {item.options.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label} ({opt.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">Score: {total}</span>
              {classification && (
                <Badge
                  className={cn(
                    "text-xs",
                    classification.color === "green" && "bg-green-500/15 text-green-700 dark:text-green-300",
                    classification.color === "blue" && "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                    classification.color === "yellow" && "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
                    classification.color === "orange" && "bg-orange-500/15 text-orange-700 dark:text-orange-300",
                    classification.color === "red" && "bg-red-500/15 text-red-700 dark:text-red-300",
                  )}
                >
                  {classification.label}
                </Badge>
              )}
            </div>
          </div>
        </Field>
      );
    }

    case "table": {
      const rows = (Array.isArray(value) ? value : []) as Record<string, unknown>[];
      const update = (i: number, k: string, v: unknown) => {
        const next = [...rows];
        next[i] = { ...next[i], [k]: v };
        onChange(next);
      };
      const addRow = () => {
        if (field.maxRows && rows.length >= field.maxRows) return;
        onChange([...rows, {}]);
      };
      const removeRow = (i: number) => {
        const next = [...rows];
        next.splice(i, 1);
        onChange(next);
      };
      return (
        <Field label={field.label} required={field.required}>
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhum item.</p>
            )}
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-md border p-2 bg-muted/10 relative"
                style={{ gridTemplateColumns: `repeat(${field.columns.length}, minmax(0, 1fr)) auto` }}
              >
                {field.columns.map((col) => (
                  <FieldRenderer
                    key={col.id}
                    field={col as Field}
                    value={row[col.id]}
                    onChange={(v) => update(i, col.id, v)}
                    sectionValues={row}
                    readOnly={readOnly}
                  />
                ))}
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(i)}
                    className="self-end text-destructive hover:text-destructive"
                    aria-label="Remover linha"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={addRow}
                className="gap-1.5"
                disabled={!!(field.maxRows && rows.length >= field.maxRows)}
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            )}
          </div>
        </Field>
      );
    }

    case "computed": {
      const computed = computeFieldValue(field, sectionValues);
      return (
        <Field label={field.label}>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {computed !== null ? (
              <>
                <span className="font-mono">{computed.toFixed(2)}</span>
                {field.unit && <span className="text-muted-foreground ml-1">{field.unit}</span>}
              </>
            ) : (
              <span className="text-muted-foreground italic text-xs">
                Aguardando entradas pra calcular…
              </span>
            )}
          </div>
        </Field>
      );
    }

    case "tri_state_checklist": {
      const obj = (value as Record<string, "SIM" | "NAO" | "NA"> | undefined) ?? {};
      const set = (id: string, v: "SIM" | "NAO" | "NA" | null) => {
        const next = { ...obj };
        if (v === null) delete next[id];
        else next[id] = v;
        onChange(next);
      };
      return (
        <Field label={field.label} required={field.required}>
          <div className="space-y-1.5">
            {field.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
              >
                <Label className="text-sm flex-1">{item.label}</Label>
                <RadioGroup
                  value={obj[item.id] ?? ""}
                  onValueChange={(v) => set(item.id, v as "SIM" | "NAO" | "NA")}
                  disabled={disabled}
                  className="flex gap-3"
                >
                  {(["SIM", "NAO", "NA"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1 cursor-pointer text-xs">
                      <RadioGroupItem value={v} />
                      {v === "NAO" ? "NÃO" : v}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
        </Field>
      );
    }

    case "counter_grid": {
      const obj = (value as Record<string, number> | undefined) ?? {};
      return (
        <Field label={field.label} required={field.required}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {field.categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-md border px-3 py-1.5">
                <Label className="text-sm">{cat.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={obj[cat.id] === undefined ? "" : String(obj[cat.id])}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Number(e.target.value);
                    const next = { ...obj };
                    if (v === undefined) delete next[cat.id];
                    else next[cat.id] = v;
                    onChange(next);
                  }}
                  disabled={disabled}
                  className="w-20 text-right"
                />
              </div>
            ))}
          </div>
        </Field>
      );
    }

    case "time_window_multi": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (id: string) => {
        if (arr.includes(id)) onChange(arr.filter((x) => x !== id));
        else onChange([...arr, id]);
      };
      return (
        <Field label={field.label} required={field.required}>
          <div className="flex flex-wrap gap-1.5">
            {field.windows.map((w) => {
              const on = arr.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggle(w.id)}
                  disabled={disabled}
                  className={cn(
                    "px-3 py-1 rounded-md border text-sm transition-colors",
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </Field>
      );
    }

    case "block_ref":
      // Blocos reutilizáveis ainda não implementados (fase posterior).
      return (
        <Field label={field.label}>
          <div className="text-xs text-muted-foreground italic">
            Bloco reutilizável: <code>{field.ref}</code> (render pendente)
          </div>
        </Field>
      );
  }
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
