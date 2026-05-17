// Constrói o contexto enriquecido pra renderização do PDF:
//   - filled_data (dados que a IA preencheu da gravação) no nível raiz
//   - _patient, _hospital, _ward, _consultation, _professional (metadata)
//   - Campos derivados pré-computados (idade, datas formatadas)
//
// O layout do template usa {{path}} pra acessar qualquer um desses.
// Centralizar essa construção evita que cada caller tenha que saber
// o shape exato + permite adicionar derivados novos sem mexer em N lugares.

import type { Ctx } from "./interpolate";

interface BuildContextInput {
  filled_data: Record<string, unknown> | null | undefined;
  patient?: {
    full_name?: string | null;
    social_name?: string | null;
    medical_record?: string | null;
    registration?: string | null;
    matricula?: string | null;
    bed?: string | null;
    cpf?: string | null;
    birth_date?: string | null;
    date_of_birth?: string | null;
    age?: string | null;
    sex?: string | null;
    plan?: string | null;
    admission_at?: string | null;
    attendance_type?: string | null;
    [k: string]: unknown;
  } | null;
  hospital?: {
    name?: string | null;
    logo_url?: string | null;
    [k: string]: unknown;
  } | null;
  ward?: {
    name?: string | null;
    [k: string]: unknown;
  } | null;
  consultation?: {
    created_at?: string | null;
    completed_at?: string | null;
    [k: string]: unknown;
  } | null;
  professional?: {
    full_name?: string | null;
    registration?: string | null;
    [k: string]: unknown;
  } | null;
}

export function buildPdfContext(input: BuildContextInput): Ctx {
  return {
    ...(input.filled_data ?? {}),
    _patient: enrichPatient(input.patient),
    _hospital: input.hospital ?? {},
    _ward: input.ward ?? {},
    _consultation: enrichConsultation(input.consultation),
    _professional: input.professional ?? {},
    _now: new Date().toISOString(),
    _now_display: formatDateTimeBR(new Date()),
  };
}

function enrichPatient(p: BuildContextInput["patient"]): Record<string, unknown> {
  if (!p) return {};
  const birthDate = p.birth_date || p.date_of_birth || null;
  const age_display = birthDate ? computeAgeDisplay(birthDate) : (p.age ?? "");
  const birth_display = birthDate ? formatDateBR(birthDate) : "";

  return {
    ...p,
    age_display,
    birth_display,
  };
}

function enrichConsultation(
  c: BuildContextInput["consultation"],
): Record<string, unknown> {
  if (!c) return {};
  return {
    ...c,
    created_display: c.created_at ? formatDateTimeBR(c.created_at) : "",
    completed_display: c.completed_at ? formatDateTimeBR(c.completed_at) : "",
  };
}

/**
 * Calcula idade em formato "79a 1m 7d" (anos, meses, dias).
 * Padrão Rede D'Or que vimos nos PDFs originais.
 */
export function computeAgeDisplay(birthDate: string): string {
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  let days = now.getDate() - b.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return `${years}a ${months}m ${days}d`;
}

export function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTimeBR(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const date = formatDateBR(d.toISOString());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mi}`;
}
