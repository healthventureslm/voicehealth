import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Container padrão de TODAS as páginas autenticadas.
 *
 * Lista/dashboard/admin: width="wide" (max-w-5xl)   ← default
 * Detalhe/form/edit:     width="narrow" (max-w-4xl)
 *
 * Sempre p-6 + space-y-6 + mx-auto. Se quiser quebrar isso,
 * estamos fazendo errado.
 */
export function PageContainer({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: "wide" | "narrow";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-6 mx-auto space-y-6",
        width === "wide" ? "max-w-5xl" : "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
