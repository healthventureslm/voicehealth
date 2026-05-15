import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Header padrão de página (v2 — Inter, sentence case).
 *
 * - `variant="greeting"` → 30px (Dashboard).
 * - `variant="page"` (default) → 24px (telas internas).
 * - Eyebrow: Inter 12px Medium, sentence case (não mono uppercase).
 *
 * Uso:
 *   <PageHeader title="Pacientes" />
 *   <PageHeader variant="greeting" eyebrow="Hoje · Quinta-feira, 7 de maio" title="Olá, Marco" />
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  back,
  backTo,
  variant = "page",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  back?: boolean;
  backTo?: string;
  variant?: "page" | "greeting";
}) {
  const navigate = useNavigate();
  const titleClass = variant === "greeting" ? "text-greeting" : "heading-page";

  return (
    <div className="space-y-4">
      {back && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="-ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className="text-[12px] font-medium mb-[6px]"
              style={{ color: "var(--text-muted)" }}
            >
              {eyebrow}
            </p>
          )}
          <h1 className={`${titleClass} flex items-center gap-3`}>
            {icon && <span className="text-enf">{icon}</span>}
            {title}
          </h1>
          {subtitle && (
            <div
              className="text-sm mt-1"
              style={{ color: "var(--text-soft)" }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
