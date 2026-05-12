import { ReactNode, createContext, useContext } from "react";
import { AppSidebar, MobileSidebarTrigger } from "./AppSidebar";

/**
 * Context que sinaliza se já existe um <AppLayout> montado acima na árvore.
 * Permite que páginas continuem usando <AppLayout>...</AppLayout> internamente
 * sem duplicar a shell quando o layout fica montado a nível de rota — elimina
 * o flicker de sidebar entre navegações.
 */
const AppLayoutMountedContext = createContext(false);

export function AppLayout({ children }: { children: ReactNode }) {
  const alreadyMounted = useContext(AppLayoutMountedContext);

  // Se já há um AppLayout pai (rota-shell), só renderiza children — assim a
  // sidebar não é remontada quando o usuário muda de página.
  if (alreadyMounted) return <>{children}</>;

  return (
    <AppLayoutMountedContext.Provider value={true}>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header só no mobile (hambúrguer pra abrir a sidebar drawer).
              No desktop a sidebar já está sempre visível. */}
          <header className="md:hidden flex items-center px-3 py-2 bg-background flex-shrink-0">
            <MobileSidebarTrigger />
          </header>
          <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        </div>
      </div>
    </AppLayoutMountedContext.Provider>
  );
}
