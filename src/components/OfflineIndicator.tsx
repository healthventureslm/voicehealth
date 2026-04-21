import { WifiOff, CloudUpload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
}

export function OfflineIndicator({ isOnline, pendingCount, isSyncing }: OfflineIndicatorProps) {
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      {!isOnline && (
        <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300">
          <WifiOff className="w-3 h-3" />
          <span className="hidden sm:inline">Offline</span>
        </div>
      )}
      {isSyncing && (
        <div className="flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="hidden sm:inline">Sincronizando...</span>
        </div>
      )}
      {pendingCount > 0 && !isSyncing && (
        <div className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-300">
          <CloudUpload className="w-3 h-3" />
          <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
            {pendingCount}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function OfflineBanner({ isOnline, pendingCount }: { isOnline: boolean; pendingCount: number }) {
  if (isOnline && pendingCount === 0) return null;

  if (!isOnline) {
    return (
      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
        <WifiOff className="w-4 h-4 flex-shrink-0" />
        Sem conexão — gravações serão salvas localmente e sincronizadas automaticamente quando a internet voltar.
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-300 flex items-center gap-2">
        <CloudUpload className="w-4 h-4 flex-shrink-0" />
        {pendingCount} gravação(ões) pendente(s) aguardando sincronização.
      </div>
    );
  }

  return null;
}
