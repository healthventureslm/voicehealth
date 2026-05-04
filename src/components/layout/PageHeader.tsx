import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Header padrão de página.
 *
 * Estrutura:
 * - Botão "Voltar" opcional (no topo, à esquerda)
 * - Eyebrow opcional (mono uppercase)
 * - h1 com .heading-page (Fraunces Light)
 * - Subtitle opcional (texto secundário)
 * - Slot `actions` à direita (botões/CTAs)
 *
 * Uso:
 *   <PageHeader title="Pacientes" />
 *   <PageHeader title="Pacientes" subtitle="Nos seus setores" actions={<Button>Novo</Button>} />
 *   <PageHeader title="Atendimento" eyebrow="Em andamento" back />
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  actions,
  back,
  backTo,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  back?: boolean;
  backTo?: string;
}) {
  const navigate = useNavigate();

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
          {eyebrow && <p className="hv-eyebrow mb-2">{eyebrow}</p>}
          <h1 className="heading-page flex items-center gap-3">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
