// Interpolação Mustache simples: "{{path.to.value}}" → valor do contexto.
//
// Sem helpers/blocks (que mustache.js suportaria) — pra isso a gente usa
// EachNode/IfNode do walker. Aqui é só substituição literal de placeholder.

export type Ctx = Record<string, unknown>;

/**
 * Resolve um path tipo "perfil.idade" ou "med.dose" no contexto.
 * Retorna undefined se algum nível não existir.
 */
export function getPath(ctx: Ctx, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Substitui todos os {{path}} de uma string pelos valores do contexto.
 * Valores undefined/null viram string vazia (não "undefined").
 */
export function interpolate(template: string, ctx: Ctx): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = getPath(ctx, path);
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

/**
 * Avalia uma condição visibleWhen contra o contexto.
 */
export function evaluateVisibility(
  rule: unknown,
  ctx: Ctx,
): boolean {
  if (!rule || typeof rule !== "object") return true;
  const r = rule as Record<string, unknown>;
  if (Array.isArray(r.all)) {
    return (r.all as unknown[]).every((sub) => evaluateVisibility(sub, ctx));
  }
  if (Array.isArray(r.any)) {
    return (r.any as unknown[]).some((sub) => evaluateVisibility(sub, ctx));
  }
  const bindPath = r.bind as string | undefined;
  if (!bindPath) return true;
  const target = getPath(ctx, bindPath);

  if (r.equals !== undefined) return deepEqual(target, r.equals);
  if (r.notEquals !== undefined) return !deepEqual(target, r.notEquals);
  if (Array.isArray(r.in)) return (r.in as unknown[]).some((v) => deepEqual(v, target));
  if (typeof r.notEmpty === "boolean") {
    const empty = target === null || target === undefined || target === "" ||
      (Array.isArray(target) && target.length === 0);
    return r.notEmpty ? !empty : empty;
  }
  // bind sem operador = truthy
  return Boolean(target);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
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
