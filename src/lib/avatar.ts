/**
 * Util de avatar — inicial + classe de gradiente determinística por nome.
 * Spec em Handoff Dev/03-cores.md (.av-1 a .av-6 + .av-me).
 */

export type AvatarVariant =
  | "av-1" | "av-2" | "av-3" | "av-4" | "av-5" | "av-6" | "av-me";

export interface AvatarTokens {
  initial: string;
  variant: AvatarVariant;
}

const VARIANTS: AvatarVariant[] = ["av-1", "av-2", "av-3", "av-4", "av-5", "av-6"];

/** Inicial do nome — até 2 caracteres, prioriza nome+sobrenome. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Hash determinístico → av-1..6 (mesmo nome sempre cai na mesma cor). */
export function avatarVariantFor(name: string | null | undefined): AvatarVariant {
  if (!name) return "av-1";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return VARIANTS[Math.abs(hash) % VARIANTS.length];
}

/** Atalho — devolve inicial + variante de uma vez. */
export function avatarTokensFor(name: string | null | undefined): AvatarTokens {
  return {
    initial: initialsOf(name),
    variant: avatarVariantFor(name),
  };
}

/** Avatar do usuário logado — sempre .av-me (roxo→ciano, marca família). */
export const ME_VARIANT: AvatarVariant = "av-me";
