import { ReactNode, createContext, useContext } from "react";
import { AppSidebar, MobileSidebarTrigger } from "./AppSidebar";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

/**
 * Context que sinaliza se já existe um <AppLayout> montado acima na árvore.
 * Permite que páginas continuem usando <AppLayout>...</AppLayout> internamente
 * sem duplicar a shell quando o layout fica montado a nível de rota — elimina
 * o flicker de sidebar entre navegações.
 */
const AppLayoutMountedContext = createContext(false);

export function AppLayout({ children }: { children: ReactNode }) {
  const alreadyMounted = useContext(AppLayoutMountedContext);
  const { signOut } = useAuth();

  // Se já há um AppLayout pai (rota-shell), só renderiza children — assim a
  // sidebar não é remontada quando o usuário muda de página.
  if (alreadyMounted) return <>{children}</>;

  return (
    <AppLayoutMountedContext.Provider value={true}>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="flex items-center justify-between px-3 md:px-4 py-2 border-b bg-background flex-shrink-0">
            <MobileSidebarTrigger />
            <div className="md:flex-1" />
            <div className="flex items-center gap-1">
              <NotificationsBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Sair do sistema"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        </div>
      </div>
    </AppLayoutMountedContext.Provider>
  );
}
