/**
 * Meta-schema do sistema de templates estruturados.
 *
 * Um template é uma árvore de Sections → Fields. Cada Field é uma união
 * discriminada por `type`. A IA preenche um objeto JSON conforme esse
 * schema e o frontend renderiza editor + PDF derivados.
 *
 * Cobertura de tipos nos exemplos:
 *   - evolucao-enfermagem.json: text, textarea, number, number_with_unit,
 *     date, boolean, radio, select, multi_checkbox, scored_scale, table,
 *     computed, tri_state_checklist
 *   - transicao-cuidado-sbar.json: layout SBAR, scale, time_window_multi,
 *     visibleWhen aninhado, table com columns tipadas
 *
 * Tipos `counter_grid` e `block_ref` são suportados mas não aparecem em
 * exemplos v1 (counter_grid pertence ao fluxo de briefing de equipe;
 * block_ref entra quando a tabela `template_blocks` for criada).
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "number_with_unit"
  | "date"
  | "datetime"
  | "boolean"
  | "radio"
  | "select"
  | "multi_checkbox"
  | "scale"
  | "scored_scale"
  | "table"
  | "computed"
  | "tri_state_checklist"
  | "counter_grid"
  | "time_window_multi"
  | "block_ref";

export interface Option {
  value: string | number;
  label: string;
}

// Regra de visibilidade: campo aparece somente quando a condição for verdadeira.
// Operadores simples sobre um campo OU combinadores all/any.
export type VisibilityRule =
  | {
      field: string;
      equals?: unknown;
      notEquals?: unknown;
      in?: unknown[];
      contains?: unknown; // pra multi_checkbox: valor presente no array
      notEmpty?: boolean;
    }
  | { all: VisibilityRule[] }
  | { any: VisibilityRule[] };

export interface FieldBase {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  visibleWhen?: VisibilityRule;
}

export interface TextField extends FieldBase {
  type: "text";
  placeholder?: string;
  maxLength?: number;
}

export interface TextareaField extends FieldBase {
  type: "textarea";
  rows?: number;
  maxLength?: number;
}

export interface NumberField extends FieldBase {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface NumberWithUnitField extends FieldBase {
  type: "number_with_unit";
  unit: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface DateField extends FieldBase {
  type: "date";
  // Aceita ISO date (YYYY-MM-DD) ou tokens: "today" | "birthMin"
  min?: string;
  max?: string;
}

export interface DateTimeField extends FieldBase {
  type: "datetime";
}

export interface BooleanField extends FieldBase {
  type: "boolean";
}

export interface RadioField extends FieldBase {
  type: "radio";
  options: Option[];
}

export interface SelectField extends FieldBase {
  type: "select";
  options: Option[];
}

export interface MultiCheckboxField extends FieldBase {
  type: "multi_checkbox";
  options: Option[];
  min?: number;
  max?: number;
}

// Slider numérico com rótulos opcionais em pontos específicos.
export interface ScaleField extends FieldBase {
  type: "scale";
  min: number;
  max: number;
  step?: number;
  labels?: Record<string, string>;
}

export interface ScoredScaleItem {
  id: string;
  label: string;
  options: { value: number; label: string }[];
}

export interface ScoredScaleClassification {
  min: number;
  max: number;
  label: string;
  color?: "green" | "blue" | "yellow" | "orange" | "red" | string;
}

// Escalas pontuadas tipo BRADEN/MORSE/RASS. Score = soma dos valores
// selecionados; classification mapeia faixas → label/cor.
export interface ScoredScaleField extends FieldBase {
  type: "scored_scale";
  items: ScoredScaleItem[];
  classification?: ScoredScaleClassification[];
}

// Tabela = lista de objetos, cada coluna é um Field. Aninhar table/computed
// dentro de table não é suportado (mantém UI simples).
export interface TableField extends FieldBase {
  type: "table";
  columns: Exclude<Field, TableField | ComputedField | BlockRefField>[];
  minRows?: number;
  maxRows?: number;
}

export type ComputedFormula =
  | { kind: "sum"; fields: string[] }
  | { kind: "expression"; expr: string };

export interface ComputedField extends FieldBase {
  type: "computed";
  formula: ComputedFormula;
  unit?: string;
}

// Lista de itens onde cada um pode ser SIM / NÃO / N/A.
export interface TriStateChecklistField extends FieldBase {
  type: "tri_state_checklist";
  items: { id: string; label: string }[];
}

// Grade de categorias com contador numérico em cada (ex: alto risco
// assistencial = Dor / LPP / Broncoasp / Queda / PAV / IPCS / etc).
export interface CounterGridField extends FieldBase {
  type: "counter_grid";
  categories: { id: string; label: string }[];
}

// Conjunto fixo de janelas horárias selecionáveis (qualidade percebida etc).
export interface TimeWindowMultiField extends FieldBase {
  type: "time_window_multi";
  windows: { id: string; label: string }[];
}

// Referência a um bloco reutilizável em `template_blocks` (fase posterior).
export interface BlockRefField extends FieldBase {
  type: "block_ref";
  ref: string;
}

export type Field =
  | TextField
  | TextareaField
  | NumberField
  | NumberWithUnitField
  | DateField
  | DateTimeField
  | BooleanField
  | RadioField
  | SelectField
  | MultiCheckboxField
  | ScaleField
  | ScoredScaleField
  | TableField
  | ComputedField
  | TriStateChecklistField
  | CounterGridField
  | TimeWindowMultiField
  | BlockRefField;

export type SbarRole = "S" | "B" | "A" | "R";

export interface Section {
  id: string;
  title: string;
  description?: string;
  sbarRole?: SbarRole;
  visibleWhen?: VisibilityRule;
  fields: Field[];
}

export type TemplateLayout = "free" | "sbar";

export type CaptureMode = "voice" | "manual" | "batch";

export interface TemplateMetadata {
  captureMode: CaptureMode;
  applicableRoles?: ("doctor" | "nurse")[];
  applicableWardTypes?: string[];
}

export interface TemplateSchema {
  id: string;
  name: string;
  description: string;
  version: number;
  layout: TemplateLayout;
  metadata: TemplateMetadata;
  sections: Section[];
}
