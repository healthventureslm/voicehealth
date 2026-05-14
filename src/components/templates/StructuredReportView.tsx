import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquareQuote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateSchema, Section, Field } from "@/templates/types";
import { NARRATIVE_KEY } from "@/templates/types";
import { evaluateVisibility } from "@/templates/runtime";
import { FieldRenderer } from "./FieldRenderer";

interface StructuredReportViewProps {
  schema: TemplateSchema;
  value: Record<string, Record<string, unknown>>;
  onChange?: (next: Record<string, Record<string, unknown>>) => void;
  readOnly?: boolean;
}

// Cores por papel SBAR — mesma convenção visual usada nos formulários da
// passagem de plantão (S=azul situação atual, B=cinza histórico,
// A=âmbar atual, R=verde recomendação).
const SBAR_COLORS: Record<string, { bar: string; chip: string; chipBg: string }> = {
  S: { bar: "border-l-blue-500",   chip: "text-blue-700 dark:text-blue-300",   chipBg: "bg-blue-500/10" },
  B: { bar: "border-l-slate-500",  chip: "text-slate-700 dark:text-slate-300", chipBg: "bg-slate-500/10" },
  A: { bar: "border-l-amber-500",  chip: "text-amber-700 dark:text-amber-300", chipBg: "bg-amber-500/10" },
  R: { bar: "border-l-emerald-500",chip: "text-emerald-700 dark:text-emerald-300", chipBg: "bg-emerald-500/10" },
};

const SBAR_LABELS: Record<string, string> = {
  S: "Situação", B: "Background", A: "Atualidade", R: "Recomendação",
};

export function StructuredReportView({
  schema,
  value,
  onChange,
  readOnly,
}: StructuredReportViewProps) {
  // Estado local quando não controlado externamente (modo só-leitura ou demo).
  const [local, setLocal] = useState(value);
  const current = onChange ? value : local;
  const setSection = (sectionId: string, sectionValues: Record<string, unknown>) => {
    const next = { ...current, [sectionId]: sectionValues };
    if (onChange) onChange(next);
    else setLocal(next);
  };

  return (
    <div className="space-y-4">
      {schema.sections.map((section) => {
        const sectionValues = current[section.id] ?? {};
        if (!evaluateVisibility(section.visibleWhen, sectionValues)) return null;
        return (
          <SectionCard
            key={section.id}
            section={section}
            layout={schema.layout}
            values={sectionValues}
            onFieldChange={(fieldId, v) =>
              setSection(section.id, { ...sectionValues, [fieldId]: v })
            }
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function SectionCard({
  section,
  layout,
  values,
  onFieldChange,
  readOnly,
}: {
  section: Section;
  layout: "free" | "sbar";
  values: Record<string, unknown>;
  onFieldChange: (fieldId: string, v: unknown) => void;
  readOnly?: boolean;
}) {
  const sbar = layout === "sbar" && section.sbarRole ? SBAR_COLORS[section.sbarRole] : null;

  return (
    <Card className={cn(sbar && `border-l-4 ${sbar.bar}`)}>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        {sbar && section.sbarRole && (
          <Badge className={cn("rounded-md", sbar.chipBg, sbar.chip)}>
            {section.sbarRole} — {SBAR_LABELS[section.sbarRole]}
          </Badge>
        )}
        <CardTitle className="heading-card">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.description && (
          <p className="text-xs text-muted-foreground">{section.description}</p>
        )}
        {section.fields.map((field) => {
          if (!evaluateVisibility(field.visibleWhen, values)) return null;
          return (
            <FieldRenderer
              key={field.id}
              field={field as Field}
              value={values[field.id]}
              onChange={(v) => onFieldChange(field.id, v)}
              sectionValues={values}
              readOnly={readOnly}
            />
          );
        })}
        {section.narrative?.enabled && (
          <div className="pt-2 border-t border-dashed space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <MessageSquareQuote className="w-3.5 h-3.5" />
              Observações da seção
              {section.narrative.hint && (
                <span className="font-normal italic">— {section.narrative.hint}</span>
              )}
            </Label>
            <Textarea
              value={(values[NARRATIVE_KEY] as string) ?? ""}
              onChange={(e) => onFieldChange(NARRATIVE_KEY, e.target.value || null)}
              placeholder="Contexto adicional, doses exatas, observações clínicas livres..."
              rows={2}
              disabled={readOnly}
              className="text-sm bg-muted/20"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
