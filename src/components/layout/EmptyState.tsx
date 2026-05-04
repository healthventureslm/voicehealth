import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/**
 * Empty/loading state padrão.
 * Cobre 3 casos:
 *  - loading: spinner + "Carregando…"
 *  - empty:   ícone (opcional) + título + descrição (opcional) + ação (opcional)
 *  - filtered: variante de empty quando filtros não retornaram
 *
 * Sempre dentro de Card pra manter consistência visual com o resto da página.
 */
export function EmptyState({
  loading,
  icon,
  title,
  description,
  action,
}: {
  loading?: boolean;
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center text-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-sm">Carregando…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-12 flex flex-col items-center text-center gap-3 text-muted-foreground">
        {icon && <div className="opacity-70">{icon}</div>}
        {title && <p className="text-sm font-medium">{title}</p>}
        {description && <p className="text-xs">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
