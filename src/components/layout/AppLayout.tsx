import { ReactNode } from "react";
import { AppSidebar, MobileSidebarTrigger } from "./AppSidebar";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LgpdConsentBanner } from "@/components/lgpd/LgpdConsentBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between px-3 md:px-4 py-2 border-b bg-background flex-shrink-0">
          <MobileSidebarTrigger />
          <div className="md:flex-1" />
          <div className="flex items-center gap-1">
            <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />
            <NotificationsBell />
            <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive" aria-label="Sair do sistema">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
      <LgpdConsentBanner />
    </div>
  );
}
