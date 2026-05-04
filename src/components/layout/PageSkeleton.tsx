import { PageContainer } from "./PageContainer";

/**
 * Placeholder visual mostrado enquanto o chunk de uma página carrega.
 * Imita PageHeader + 2 cards genéricos pra a transição parecer fluida em
 * vez de um spinner cheio que faz o conteúdo "piscar".
 *
 * Usado como Suspense fallback nas rotas autenticadas.
 */
export function PageSkeleton() {
  return (
    <PageContainer>
      {/* PageHeader stub */}
      <div className="space-y-3">
        <div className="h-3 w-24 bg-muted/40 rounded animate-pulse" />
        <div className="h-7 w-2/3 max-w-md bg-muted/50 rounded animate-pulse" />
        <div className="h-3 w-1/2 max-w-sm bg-muted/30 rounded animate-pulse" />
      </div>

      {/* Cards stub */}
      <SkeletonCard rows={3} />
      <SkeletonCard rows={5} />
    </PageContainer>
  );
}

function SkeletonCard({ rows }: { rows: number }) {
  return (
    <div className="border rounded-lg bg-card p-5 space-y-3">
      <div className="h-4 w-1/3 bg-muted/40 rounded animate-pulse" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-muted/30 rounded animate-pulse"
            style={{ width: `${85 - (i % 3) * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}
