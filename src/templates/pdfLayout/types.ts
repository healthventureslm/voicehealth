// Árvore declarativa de nós que descreve um layout PDF custom por template.
// É serializável em JSON (vive em report_templates.display_layout).
// A IA gera essa árvore a partir de uma imagem do documento alvo;
// o walker converte em React.createElement do react-pdf na hora de exportar.
//
// Strings em qualquer campo de conteúdo aceitam placeholders Mustache:
//   "Paciente: {{patient.full_name}}"
// Resolvidos contra um root context que combina filled_data + metadata
// extra (patient, professional, generated_at, etc).

export type PdfStyle = Record<string, string | number>;

/**
 * Visibilidade simples: nó só renderiza se a expressão for truthy.
 * Aceita path (ex: "perfil.alergias_nega") ou comparação básica.
 */
export type VisibleWhen =
  | { bind: string; equals?: unknown; notEquals?: unknown; in?: unknown[]; notEmpty?: boolean }
  | { all: VisibleWhen[] }
  | { any: VisibleWhen[] };

export interface NodeBase {
  visibleWhen?: VisibleWhen;
  /** Estilo react-pdf (flex, padding, color, fontSize, ...). */
  style?: PdfStyle;
}

export interface DocumentNode extends NodeBase {
  type: "Document";
  children: PageNode[];
}

export interface PageNode extends NodeBase {
  type: "Page";
  size?: "A4" | "LETTER" | "LEGAL" | "A3" | "A5";
  orientation?: "portrait" | "landscape";
  children: LayoutNode[];
}

export interface ViewNode extends NodeBase {
  type: "View";
  children?: LayoutNode[];
}

/**
 * Texto. children pode ser:
 *   - string (com placeholders Mustache)
 *   - array de runs (texto + Text aninhados pra estilo inline)
 */
export interface TextNode extends NodeBase {
  type: "Text";
  children?: string | LayoutNode[];
}

export interface ImageNode extends NodeBase {
  type: "Image";
  /** URL absoluta ou data URL ou placeholder Mustache. */
  src: string;
}

/**
 * Loop: pra cada item em `bind` (que deve resolver a um array),
 * renderiza `children` com o item disponível no contexto como `itemAs`.
 *
 * Ex: bind="perfil.medicamentos", itemAs="med"
 * Dentro dos children: "{{med.nome}}", "{{med.dose}}"
 */
export interface EachNode extends NodeBase {
  type: "Each";
  bind: string;
  itemAs: string;
  children: LayoutNode[];
  /** Opcional: separador entre items (View entre cada). */
  separator?: ViewNode;
  /** Opcional: render se array vazio. */
  empty?: LayoutNode[];
}

/**
 * Conditional: renderiza children só se `when` for truthy.
 * Atalho pro padrão visibleWhen (mais explícito quando o nó é um wrapper).
 */
export interface IfNode extends NodeBase {
  type: "If";
  when: VisibleWhen;
  children: LayoutNode[];
  /** Opcional: render se falsy (else branch). */
  otherwise?: LayoutNode[];
}

/**
 * Checklist visual: marca [x] ou [ ] baseado em condição.
 * Atalho semântico — alternativa é dois Text encadeados num View.
 */
export interface CheckboxNode extends NodeBase {
  type: "Checkbox";
  /** Path pro valor. Marcado se true / array contendo `whenContains` / equals. */
  bind: string;
  whenContains?: unknown;
  equals?: unknown;
  /** Texto à direita da caixinha. */
  label: string;
}

export type LayoutNode =
  | DocumentNode
  | PageNode
  | ViewNode
  | TextNode
  | ImageNode
  | EachNode
  | IfNode
  | CheckboxNode;
