import { cn } from "@/lib/utils";

interface BrandLockupProps {
  /** Quando true, mostra apenas o quadrado ciano (sidebar collapsed). */
  collapsed?: boolean;
  /** Mostra o sublogo "by HealthVentures" abaixo. Default: true. */
  showByline?: boolean;
  className?: string;
}

/**
 * Lockup canônico VoxFlow Enfermagem v2:
 * [□ Wave] VoxFlow / Enfermagem / by HealthVentures
 *
 * Spec em Handoff Dev/04-logos.md.
 * Usa SVG inline (não <img>) pra que cores sigam currentColor e não dependam
 * de fonte externa carregando antes do render.
 */
export function BrandLockup({ collapsed, showByline = true, className }: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-[10px]", className)}>
      <div
        className="w-[34px] h-[34px] rounded-[7px] flex items-center justify-center flex-shrink-0 bg-enf shadow-sm"
        aria-hidden={!collapsed}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="w-[18px] h-[18px] text-white"
          aria-hidden="true"
        >
          <line x1="6" y1="9" x2="6" y2="15" />
          <line x1="10" y1="6" x2="10" y2="18" />
          <line x1="14" y1="4" x2="14" y2="20" />
          <line x1="18" y1="9" x2="18" y2="15" />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col leading-[1.05] min-w-0">
          <span
            className="font-extrabold text-[15px] tracking-[-0.02em] text-foreground"
            style={{ fontFamily: "var(--font-body)" }}
          >
            VoxFlow
          </span>
          <span
            className="text-[11px] font-medium mt-[2px]"
            style={{ color: "var(--text-soft)", fontFamily: "var(--font-body)" }}
          >
            Enfermagem
          </span>
          {showByline && (
            <span
              className="inline-flex items-baseline gap-1 text-[9px] font-bold tracking-[-0.01em] leading-none mt-[5px] whitespace-nowrap"
              style={{ fontFamily: "var(--font-body)" }}
            >
              <span
                className="font-medium"
                style={{ color: "var(--text-muted)", letterSpacing: 0 }}
              >
                by
              </span>
              <span style={{ color: "var(--text)" }}>Health</span>
              <span className="hv-ventures-gradient">Ventures</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
