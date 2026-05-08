import { cn } from "@/lib/utils";
import { avatarTokensFor, type AvatarVariant, ME_VARIANT } from "@/lib/avatar";

interface GradientAvatarProps {
  name: string | null | undefined;
  /** Quando true, força a variante .av-me (usuário logado). */
  isMe?: boolean;
  /** Override manual da variante — usar só em casos especiais. */
  variant?: AvatarVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "w-7 h-7 text-[11px] rounded-md",
  md: "w-9 h-9 text-[13px] rounded-lg",
  lg: "w-12 h-12 text-base rounded-[10px]",
} as const;

/**
 * Avatar com inicial sobre gradiente colorido determinístico pelo nome.
 * Substitui o ícone genérico de pessoa em listas de pacientes/usuários.
 * Spec: Handoff Dev/05-componentes.md §4.
 */
export function GradientAvatar({
  name,
  isMe,
  variant,
  size = "md",
  className,
}: GradientAvatarProps) {
  const tokens = avatarTokensFor(name ?? "");
  const v: AvatarVariant = variant ?? (isMe ? ME_VARIANT : tokens.variant);
  return (
    <div
      className={cn(
        "flex items-center justify-center font-semibold text-white tracking-[0.01em] flex-shrink-0 select-none",
        SIZES[size],
        v,
        className,
      )}
      aria-hidden="true"
    >
      {tokens.initial}
    </div>
  );
}
