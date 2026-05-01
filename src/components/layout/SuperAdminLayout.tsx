import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Building2, FileText, LayoutDashboard, LogOut, Menu, Mic, Moon, Shield, Sun, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Visão Geral",       icon: LayoutDashboard, path: "/superadmin" },
  { label: "Hospitais",         icon: Building2,        path: "/superadmin/hospitals" },
  { label: "Templates Globais", icon: FileText,         path: "/superadmin/templates" },
];

const settingsItems = [
  { label: "Meu Perfil", icon: User, path: "/profile" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const isActive = (path: string) =>
    path === "/superadmin"
      ? location.pathname === "/superadmin"
      : location.pathname.startsWith(path);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm tracking-tight font-['Space_Grotesk']">
            Health Ventures
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Super Admin
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-xs uppercase text-sidebar-foreground/60 tracking-wider font-medium">
          Operação
        </div>
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-10",
              isActive(item.path) &&
                "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary/90",
            )}
            onClick={() => handleNav(item.path)}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Button>
        ))}

        <Separator className="bg-sidebar-border my-3" />

        <div className="px-3 mb-2 text-xs uppercase text-sidebar-foreground/60 tracking-wider font-medium">
          Conta
        </div>
        {settingsItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-10",
              isActive(item.path) &&
                "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary/90",
            )}
            onClick={() => handleNav(item.path)}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Button>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="flex items-center gap-3 px-3 py-4">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={profile?.avatar_url || ""} />
          <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{profile?.full_name || "—"}</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-sidebar-foreground/50"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          className="text-sidebar-foreground/50 hover:text-destructive"
          aria-label="Sair"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 !bg-sidebar-background text-sidebar-foreground border-sidebar-border">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && (
        <aside
          role="navigation"
          aria-label="Navegação super admin"
          className="hidden md:flex flex-col h-screen w-64 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border flex-shrink-0"
        >
          <SidebarContent />
        </aside>
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center gap-3 px-3 md:px-4 py-2 border-b bg-background flex-shrink-0">
          <MobileSidebarTrigger />
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-semibold">Health Ventures</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Painel global</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
