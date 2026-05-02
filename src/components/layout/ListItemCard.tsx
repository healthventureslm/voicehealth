import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Item de lista clicável padronizado.
 * Encapsula:
 *  - Card + padding consistente (p-4)
 *  - hover:border-primary/50 + transition-colors
 *  - cursor-pointer
 *  - layout flex: conteúdo à esquerda + ações à direita
 *
 * Uso:
 *   <ListItemCard onClick={() => navigate(...)}>
 *     <ListItemContent title="João Silva" subtitle="Leito 303" />
 *     <ListItemActions><Badge>Concluída</Badge></ListItemActions>
 *   </ListItemCard>
 */
export function ListItemCard({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        onClick && "cursor-pointer hover:border-primary/50 transition-colors",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Conteúdo principal de um ListItemCard — título + subtítulo opcional.
 * Mantém typography consistente entre todas as listas do app.
 */
export function ListItemContent({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-medium truncate">{title}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Slot pra badges/botões à direita do ListItemCard.
 * Garante alinhamento e wrap consistente.
 */
export function ListItemActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 flex-shrink-0">{children}</div>;
}
