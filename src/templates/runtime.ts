// Helpers de runtime do renderer estruturado.
// Pure functions — sem React, sem side effects.

import type {
  Field,
  TemplateSchema,
  VisibilityRule,
  ScoredScaleField,
  ComputedField,
} from "./types";

// ─── Visibilidade ───
// Avalia uma regra contra os valores correntes da seção (campos vizinhos).
// Suporta operadores simples (equals/notEquals/in/contains/notEmpty) e
// combinadores (all/any).
export function evaluateVisibility(
  rule: VisibilityRule | undefined,
  sectionValues: Record<string, unknown>,
): boolean {
  if (!rule) return true;

  if ("all" in rule) {
    return rule.all.every((r) => evaluateVisibility(r, sectionValues));
  }
  if ("any" in rule) {
    return rule.any.some((r) => evaluateVisibility(r, sectionValues));
  }

  const target = sectionValues[rule.field];

  if (rule.equals !== undefined) return deepEqual(target, rule.equals);
  if (rule.notEquals !== undefined) return !deepEqual(target, rule.notEquals);
  if (rule.in !== undefined) return rule.in.some((v) => deepEqual(v, target));
  if (rule.contains !== undefined) {
    if (Array.isArray(target)) return target.some((v) => deepEqual(v, rule.contains));
    if (typeof target === "string") return target.includes(String(rule.contains));
    return false;
  }
  if (rule.notEmpty !== undefined) {
    const isEmpty =
      target === null ||
      target === undefined ||
      target === "" ||
      (Array.isArray(target) && target.length === 0);
    return rule.notEmpty ? !isEmpty : isEmpty;
  }
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// ─── Escala pontuada ───
// Soma os valores selecionados; retorna total e classification (faixa).
export function computeScoredScale(
  field: ScoredScaleField,
  value: Record<string, number> | undefined | null,
): { total: number; classification: { label: string; color?: string } | null } {
  if (!value) return { total: 0, classification: null };
  const total = field.items.reduce((sum, item) => {
    const v = value[item.id];
    return typeof v === "number" ? sum + v : sum;
  }, 0);
  const cls = field.classification?.find((c) => total >= c.min && total <= c.max) ?? null;
  return {
    total,
    classification: cls ? { label: cls.label, color: cls.color } : null,
  };
}

// ─── Campo computado ───
// Suporta "sum" (soma de outros campos numéricos da mesma seção) e
// "expression" (uma sub-linguagem simples: peso, altura, +, -, *, /, ^, parens).
// Não usamos eval — parser próprio resolve só essas operações.
export function computeFieldValue(
  field: ComputedField,
  sectionValues: Record<string, unknown>,
): number | null {
  const { formula } = field;
  if (formula.kind === "sum") {
    let sum = 0;
    let hasAny = false;
    for (const id of formula.fields) {
      const v = sectionValues[id];
      if (typeof v === "number" && !isNaN(v)) {
        sum += v;
        hasAny = true;
      }
    }
    return hasAny ? sum : null;
  }
  if (formula.kind === "expression") {
    try {
      const result = evaluateExpression(formula.expr, sectionValues);
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Mini-parser de expressão. Tokens: identifiers, números, + - * / ^ ( ).
// Suficiente pra fórmulas tipo IMC = peso / ((altura / 100) ^ 2).
function evaluateExpression(expr: string, scope: Record<string, unknown>): number {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens, scope);
  return parser.parseExpression();
}

type Token = { type: "num" | "id" | "op" | "lparen" | "rparen"; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(") { tokens.push({ type: "lparen", value: c }); i++; continue; }
    if (c === ")") { tokens.push({ type: "rparen", value: c }); i++; continue; }
    if ("+-*/^".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      let s = "";
      while (i < input.length && /[0-9.]/.test(input[i])) s += input[i++];
      tokens.push({ type: "num", value: s });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let s = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) s += input[i++];
      tokens.push({ type: "id", value: s });
      continue;
    }
    throw new Error(`unexpected char: ${c}`);
  }
  return tokens;
}

class Parser {
  pos = 0;
  constructor(private tokens: Token[], private scope: Record<string, unknown>) {}
  peek() { return this.tokens[this.pos]; }
  next() { return this.tokens[this.pos++]; }

  parseExpression(): number { return this.parseAdditive(); }
  parseAdditive(): number {
    let left = this.parseMultiplicative();
    while (this.peek()?.type === "op" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }
  parseMultiplicative(): number {
    let left = this.parsePower();
    while (this.peek()?.type === "op" && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.next().value;
      const right = this.parsePower();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }
  parsePower(): number {
    const base = this.parseUnary();
    if (this.peek()?.type === "op" && this.peek().value === "^") {
      this.next();
      return Math.pow(base, this.parsePower());
    }
    return base;
  }
  parseUnary(): number {
    if (this.peek()?.type === "op" && this.peek().value === "-") {
      this.next();
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }
  parsePrimary(): number {
    const t = this.next();
    if (!t) throw new Error("unexpected end");
    if (t.type === "num") return parseFloat(t.value);
    if (t.type === "id") {
      const v = this.scope[t.value];
      return typeof v === "number" ? v : NaN;
    }
    if (t.type === "lparen") {
      const inner = this.parseExpression();
      const close = this.next();
      if (!close || close.type !== "rparen") throw new Error("missing )");
      return inner;
    }
    throw new Error(`unexpected token: ${t.value}`);
  }
}

// ─── Validação rasa ───
// Retorna lista de campos required vazios (visíveis), pra feedback ao salvar.
export function findMissingRequired(
  schema: TemplateSchema,
  values: Record<string, Record<string, unknown>>,
): { sectionId: string; fieldId: string; label: string }[] {
  const missing: { sectionId: string; fieldId: string; label: string }[] = [];
  for (const section of schema.sections) {
    const sectionValues = values[section.id] ?? {};
    if (!evaluateVisibility(section.visibleWhen, sectionValues)) continue;
    for (const field of section.fields) {
      if (!field.required) continue;
      if (!evaluateVisibility(field.visibleWhen, sectionValues)) continue;
      const v = sectionValues[field.id];
      const isEmpty =
        v === null || v === undefined || v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (isEmpty) {
        missing.push({ sectionId: section.id, fieldId: field.id, label: field.label });
      }
    }
  }
  return missing;
}

// Type guard útil pros renderers
export function getFieldByType<T extends Field["type"]>(
  field: Field,
  type: T,
): Extract<Field, { type: T }> | null {
  return field.type === type ? (field as Extract<Field, { type: T }>) : null;
}
