import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Database, Zap, Calculator } from "lucide-react";

interface FilterField {
  key: string;
  label: string;
  type: "text" | "boolean" | "enum";
  options?: { value: string; label: string }[];
}

interface DataSource {
  value: string;
  label: string;
  filters: FilterField[];
  aggColumns?: { value: string; label: string }[];
}

const BOOLEAN_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "recording", label: "Gravando" },
  { value: "transcribing", label: "Transcrevendo" },
  { value: "completed", label: "Concluído" },
  { value: "open", label: "Aberto" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "done", label: "Feito" },
];

const SEVERITY_OPTIONS = [
  { value: "warning", label: "Aviso" },
  { value: "critical", label: "Crítico" },
  { value: "green", label: "Verde" },
  { value: "yellow", label: "Amarelo" },
  { value: "red", label: "Vermelho" },
];

const RISK_LEVEL_OPTIONS = [
  { value: "high", label: "Alto" },
  { value: "medium", label: "Médio" },
  { value: "low", label: "Baixo" },
];

const WARD_TYPE_OPTIONS = [
  { value: "enfermaria", label: "Enfermaria" },
  { value: "uti", label: "UTI" },
  { value: "semi_intensiva", label: "Semi-Intensiva" },
  { value: "centro_cirurgico", label: "Centro Cirúrgico" },
  { value: "emergencia", label: "Emergência" },
  { value: "ambulatorio", label: "Ambulatório" },
];

const OPERATIONS = [
  { value: "count", label: "Contagem" },
  { value: "count_distinct", label: "Contagem Distinta" },
  { value: "sum", label: "Soma" },
  { value: "avg", label: "Média" },
];

const DATA_SOURCES: DataSource[] = [
  {
    value: "consultations", label: "Consultas",
    filters: [
      { key: "status", label: "Status", type: "enum", options: STATUS_OPTIONS },
      { key: "specialty_id", label: "Especialidade (ID)", type: "text" },
    ],
  },
  {
    value: "patients", label: "Pacientes",
    filters: [
      { key: "bed", label: "Leito", type: "text" },
      { key: "medical_record", label: "Prontuário", type: "text" },
    ],
  },
  {
    value: "infections", label: "Infecções (IRAS)",
    filters: [
      { key: "infection_type", label: "Tipo de Infecção", type: "text" },
      { key: "is_device_related", label: "Relacionada a Dispositivo", type: "boolean", options: BOOLEAN_OPTIONS },
      { key: "device_type", label: "Tipo de Dispositivo", type: "text" },
      { key: "organism", label: "Organismo", type: "text" },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
  },
  {
    value: "ipsg_audits", label: "Auditorias IPSG",
    filters: [
      { key: "status", label: "Status", type: "enum", options: STATUS_OPTIONS },
      { key: "ipsg_goal_id", label: "Meta IPSG (ID)", type: "text" },
      { key: "checklist_id", label: "Checklist (ID)", type: "text" },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
    aggColumns: [
      { value: "conformity_rate", label: "Taxa de Conformidade" },
      { value: "conforming_items", label: "Itens Conformes" },
      { value: "total_items", label: "Total de Itens" },
    ],
  },
  {
    value: "ipsg_events", label: "Eventos IPSG",
    filters: [
      { key: "event_type", label: "Tipo de Evento", type: "text" },
      { key: "is_conforming", label: "Conforme", type: "boolean", options: BOOLEAN_OPTIONS },
      { key: "ipsg_goal_id", label: "Meta IPSG (ID)", type: "text" },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
  },
  {
    value: "surgical_checklists", label: "Checklists Cirúrgicos",
    filters: [
      { key: "status", label: "Status", type: "enum", options: STATUS_OPTIONS },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
  },
  {
    value: "clinical_reports", label: "Relatórios Clínicos",
    filters: [
      { key: "template_type", label: "Tipo de Template", type: "text" },
    ],
  },
  {
    value: "indicator_events", label: "Eventos de Indicador",
    filters: [
      { key: "indicator_id", label: "Indicador (ID)", type: "text" },
      { key: "subtype_id", label: "Subtipo (ID)", type: "text" },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
    aggColumns: [
      { value: "bundle_score", label: "Score do Bundle" },
    ],
  },
  {
    value: "bundle_alerts", label: "Alertas de Bundle",
    filters: [
      { key: "severity", label: "Severidade", type: "enum", options: SEVERITY_OPTIONS },
      { key: "is_resolved", label: "Resolvido", type: "boolean", options: BOOLEAN_OPTIONS },
      { key: "subtype_id", label: "Subtipo (ID)", type: "text" },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
  },
  {
    value: "indicator_subtypes", label: "Subtipos de Indicador",
    filters: [
      { key: "indicator_id", label: "Indicador (ID)", type: "text" },
      { key: "code", label: "Código", type: "text" },
      { key: "is_active", label: "Ativo", type: "boolean", options: BOOLEAN_OPTIONS },
    ],
    aggColumns: [
      { value: "target_value", label: "Meta" },
    ],
  },
  {
    value: "indicator_alerts", label: "Alertas de Indicador",
    filters: [
      { key: "severity", label: "Severidade", type: "enum", options: SEVERITY_OPTIONS },
      { key: "is_read", label: "Lido", type: "boolean", options: BOOLEAN_OPTIONS },
      { key: "indicator_id", label: "Indicador (ID)", type: "text" },
    ],
    aggColumns: [
      { value: "current_value", label: "Valor Atual" },
      { value: "target_value", label: "Meta" },
    ],
  },
  {
    value: "clinical_protocols", label: "Protocolos Clínicos",
    filters: [
      { key: "category", label: "Categoria", type: "text" },
      { key: "is_active", label: "Ativo", type: "boolean", options: BOOLEAN_OPTIONS },
    ],
  },
  {
    value: "high_alert_medications", label: "Medicamentos Alto Risco",
    filters: [
      { key: "category", label: "Categoria", type: "text" },
      { key: "risk_level", label: "Nível de Risco", type: "enum", options: RISK_LEVEL_OPTIONS },
      { key: "is_active", label: "Ativo", type: "boolean", options: BOOLEAN_OPTIONS },
    ],
  },
  {
    value: "ipsg_action_plans", label: "Planos de Ação IPSG",
    filters: [
      { key: "status", label: "Status", type: "enum", options: STATUS_OPTIONS },
      { key: "ipsg_goal_id", label: "Meta IPSG (ID)", type: "text" },
      { key: "ward_id", label: "Enfermaria (ID)", type: "text" },
    ],
  },
  {
    value: "wards", label: "Enfermarias",
    filters: [
      { key: "ward_type", label: "Tipo", type: "enum", options: WARD_TYPE_OPTIONS },
      { key: "is_active", label: "Ativo", type: "boolean", options: BOOLEAN_OPTIONS },
    ],
    aggColumns: [
      { value: "bed_count", label: "Número de Leitos" },
    ],
  },
];

interface AutoCollectionConfigProps {
  autoEnabled: boolean;
  autoSource: string;
  autoNumeratorFilter: Record<string, any>;
  autoDenominatorFilter: Record<string, any>;
  calcType: string;
  autoOperation?: string;
  autoAggColumn?: string;
  onChange: (field: string, value: any) => void;
}

function FilterRow({ field, value, onChange }: { field: FilterField; value: string; onChange: (v: string) => void }) {
  if (field.type === "boolean" || field.type === "enum") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs w-36 text-muted-foreground font-mono truncate" title={field.key}>{field.label} =</span>
        <Select value={value || ""} onValueChange={(v) => onChange(v === "__clear__" ? "" : v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="(todos)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">(todos)</SelectItem>
            {(field.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-36 text-muted-foreground font-mono truncate" title={field.key}>{field.label} =</span>
      <Input
        className="h-8 text-sm"
        placeholder="(vazio = todos)"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SourceFilterSection({
  label,
  sourceValue,
  filters,
  onSourceChange,
  onFilterChange,
}: {
  label: string;
  sourceValue: string;
  filters: Record<string, any>;
  onSourceChange: (v: string) => void;
  onFilterChange: (filters: Record<string, any>) => void;
}) {
  const selectedSource = DATA_SOURCES.find((s) => s.value === sourceValue);

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground font-semibold">{label}</Label>
      <Select value={sourceValue || ""} onValueChange={onSourceChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Selecione a tabela..." />
        </SelectTrigger>
        <SelectContent>
          {DATA_SOURCES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span className="flex items-center gap-2">
                <Database className="w-3 h-3" /> {s.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedSource && selectedSource.filters.length > 0 && (
        <div className="space-y-2 pl-2 border-l-2 border-primary/20 mt-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Filtros</span>
          {selectedSource.filters.map((f) => (
            <FilterRow
              key={f.key}
              field={f}
              value={filters[f.key] || ""}
              onChange={(v) =>
                onFilterChange({ ...filters, [f.key]: v || undefined })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AutoCollectionConfig({
  autoEnabled,
  autoSource,
  autoNumeratorFilter,
  autoDenominatorFilter,
  calcType,
  autoOperation = "count",
  autoAggColumn,
  onChange,
}: AutoCollectionConfigProps) {
  const numSource = autoSource || "";
  const denomSource = (autoDenominatorFilter as any)?.source || numSource;
  const selectedNumSource = DATA_SOURCES.find((s) => s.value === numSource);
  const selectedDenomSource = DATA_SOURCES.find((s) => s.value === denomSource);
  const needsAggColumn = autoOperation === "sum" || autoOperation === "avg";

  const allAggColumns = [
    ...(selectedNumSource?.aggColumns || []),
    { value: "numerator_value", label: "Valor do Numerador" },
    { value: "denominator_value", label: "Valor do Denominador" },
    { value: "calculated_value", label: "Valor Calculado" },
  ];

  const getOpLabel = (op: string) => OPERATIONS.find((o) => o.value === op)?.label || op;
  const getSourceLabel = (src: string) => DATA_SOURCES.find((s) => s.value === src)?.label || src;

  return (
    <div className="col-span-2 border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">Coleta Automática</Label>
          <Badge variant="outline" className="text-xs">Beta</Badge>
        </div>
        <Switch
          checked={autoEnabled}
          onCheckedChange={(v) => onChange("auto_enabled", v)}
        />
      </div>

      {autoEnabled && (
        <div className="space-y-4">
          {/* Operation selector */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Operação Matemática</Label>
              <Select value={autoOperation} onValueChange={(v) => onChange("auto_operation", v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <Calculator className="w-3 h-3" /> {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsAggColumn && (
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Coluna de Agregação</Label>
                <Select value={autoAggColumn || ""} onValueChange={(v) => onChange("auto_agg_column", v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allAggColumns.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Numerator */}
          <div className="border rounded p-3 bg-background/50">
            <SourceFilterSection
              label="📊 Numerador — Fonte de Dados"
              sourceValue={numSource}
              filters={autoNumeratorFilter}
              onSourceChange={(v) => onChange("auto_source", v)}
              onFilterChange={(f) => onChange("auto_numerator_filter", f)}
            />
          </div>

          {/* Denominator */}
          {calcType !== "absolute" && (
            <div className="border rounded p-3 bg-background/50">
              <SourceFilterSection
                label="📐 Denominador — Fonte de Dados"
                sourceValue={denomSource}
                filters={(() => {
                  const f = { ...autoDenominatorFilter };
                  delete f.source;
                  return f;
                })()}
                onSourceChange={(v) =>
                  onChange("auto_denominator_filter", { ...autoDenominatorFilter, source: v })
                }
                onFilterChange={(f) =>
                  onChange("auto_denominator_filter", { ...f, source: denomSource })
                }
              />
            </div>
          )}

          {/* Preview */}
          {numSource && (
            <div className="bg-muted/50 rounded p-3 text-xs text-muted-foreground font-mono space-y-1">
              <div className="font-semibold text-foreground text-sm mb-1">📊 Preview da Fórmula</div>
              <div>
                <strong>{getOpLabel(autoOperation)}</strong>
                {needsAggColumn && autoAggColumn && <> de <strong>{autoAggColumn}</strong></>}
                {" em "}<strong>{getSourceLabel(numSource)}</strong>
                {Object.entries(autoNumeratorFilter).filter(([, v]) => v).length > 0 && (
                  <> onde {Object.entries(autoNumeratorFilter).filter(([, v]) => v).map(([k, v]) => `${k}="${v}"`).join(", ")}</>
                )}
              </div>
              {calcType !== "absolute" && (
                <div>
                  ÷ <strong>{getOpLabel(autoOperation)}</strong>
                  {" em "}<strong>{getSourceLabel(denomSource)}</strong>
                  {Object.entries(autoDenominatorFilter).filter(([k, v]) => v && k !== "source").length > 0 && (
                    <> onde {Object.entries(autoDenominatorFilter).filter(([k, v]) => v && k !== "source").map(([k, v]) => `${k}="${v}"`).join(", ")}</>
                  )}
                  {calcType === "percentage" && " × 100"}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
