import { cn } from "@/lib/utils";
import {
  Activity, Scissors, Siren, Bed, Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

type WardType = Enums<"ward_type">;

interface WardConfig {
  /** Label legível pra leitores que não vêm a cor — daltonismo. */
  label: string;
  /** Ícone semântico (acessibilidade — não só cor). */
  icon: LucideIcon;
  /** Classes Tailwind do chip soft (bg + text). */
  className: string;
}

const WARD_CONFIG: Record<WardType, WardConfig> = {
  uti: {
    label: "UTI",
    icon: Activity,
    className: "bg-uti-soft text-uti-text",
  },
  centro_cirurgico: {
    label: "Centro Cirúrgico",
    icon: Scissors,
    className: "bg-cc-soft text-cc-text",
  },
  pronto_socorro: {
    label: "Pronto-Socorro",
    icon: Siren,
    className: "bg-ps-soft text-ps-text",
  },
  enfermaria: {
    label: "Enfermaria",
    icon: Bed,
    className: "bg-enfer-soft text-enfer-text",
  },
  ambulatorio: {
    label: "Ambulatório",
    icon: Stethoscope,
    className: "bg-amb-soft text-amb-text",
  },
};

interface WardChipProps {
  type: WardType | null | undefined;
  /** Override do label exibido (ex: nome custom do setor); o ícone segue o type. */
  label?: string;
  /** Não renderiza o ícone (usar com cautela — quebra acessibilidade). */
  hideIcon?: boolean;
  className?: string;
}

/**
 * Chip de setor com cor + ícone + texto (acessibilidade WCAG — nunca só cor).
 * Spec: Handoff Dev/03-cores.md §2.5 e 05-componentes.md §3.
 */
export function WardChip({ type, label, hideIcon, className }: WardChipProps) {
  if (!type) return null;
  const cfg = WARD_CONFIG[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-[3px] rounded-md whitespace-nowrap",
        "text-[11px] font-semibold leading-none",
        cfg.className,
        className,
      )}
    >
      {!hideIcon && <Icon className="w-3 h-3 stroke-[2]" aria-hidden="true" />}
      {label ?? cfg.label}
    </span>
  );
}
