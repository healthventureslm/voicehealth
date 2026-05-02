import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, Mic, FileText, Shield, LogOut,
  ClipboardList, Building2, Menu,
  Hospital, BookOpen, BarChart3, User, Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight } from "lucide-react";

const dashboardItem = { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" };

const clinicalNavItems = [
  { label: "Nova Gravação", icon: Mic, path: "/consultations/new" },
  { label: "Minhas Gravações", icon: Archive, path: "/gravacoes" },
  { label: "Atendimentos", icon: ClipboardList, path: "/consultations" },
  { label: "Pacientes", icon: Users, path: "/patients" },
];

const adminNavItems = [
  { label: "Usuários", icon: Shield, path: "/admin/users" },
  { label: "Setores", icon: Building2, path: "/admin/wards" },
  { label: "Templates", icon: FileText, path: "/admin/templates" },
  { label: "Especialidades", icon: Hospital, path: "/admin/specialties" },
  { label: "Métricas de Uso", icon: BarChart3, path: "/admin/analytics" },
  { label: "Manual Admin", icon: BookOpen, path: "/admin/manual" },
];

const settingsNavItems = [
  { label: "Meu Perfil", icon: User, path: "/profile" },
];

function NavButton({ item, isActive, onClick }: { item: typeof dashboardItem; isActive: boolean; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-10 transition-all",
        isActive && "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary/90"
      )}
      onClick={onClick}
    >
      <item.icon className={cn("w-6 h-6 flex-shrink-0", isActive && "text-sidebar-primary-foreground")} />
      <span>{item.label}</span>
    </Button>
  );
}

function SectionGroup({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(`sidebar-${label}`);
    return stored !== null ? stored === "true" : defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`sidebar-${label}`, String(next));
  };

  return (
    <Collapsible open={open} onOpenChange={toggle}>
      <Separator className="bg-sidebar-border my-3" />
      <CollapsibleTrigger className="flex items-center gap-1 w-full px-3 mb-2 group">
        <ChevronRight className={cn("w-3 h-3 text-sidebar-foreground/40 transition-transform", open && "rotate-90")} />
        <span className="hv-eyebrow">{label}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, roles, isSuperAdmin, signOut } = useAuth();
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin") || isSuperAdmin;
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--hv-card)", border: "1px solid var(--hv-accent)" }}
        >
          <Mic className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="hv-wordmark text-lg">
            Voice<em>Health</em>
          </span>
          <span className="hv-byline mt-0.5">— by Health Ventures</span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <NavButton item={dashboardItem} isActive={isActive(dashboardItem.path)} onClick={() => handleNav(dashboardItem.path)} />

        <SectionGroup label="Clinica">
          {clinicalNavItems.map((item) => (
            <NavButton key={item.path} item={item} isActive={isActive(item.path)} onClick={() => handleNav(item.path)} />
          ))}
        </SectionGroup>

        <SectionGroup label="Configuracoes" defaultOpen={false}>
          {settingsNavItems.map((item) => (
            <NavButton key={item.path} item={item} isActive={isActive(item.path)} onClick={() => handleNav(item.path)} />
          ))}
        </SectionGroup>

        {isHospitalAdmin && (
          <SectionGroup label="Administracao" defaultOpen={false}>
            {adminNavItems.map((item) => (
              <NavButton key={item.path} item={item} isActive={isActive(item.path)} onClick={() => handleNav(item.path)} />
            ))}
          </SectionGroup>
        )}
      </nav>

      <Separator className="bg-sidebar-border" />

      <div className="flex items-center gap-3 px-3 py-4">
        <button onClick={() => handleNav("/profile")} className="flex items-center gap-3 flex-1 min-w-0 rounded-md hover:bg-sidebar-accent p-1 transition-colors" aria-label="Ir para perfil">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          </div>
        </button>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-sidebar-foreground/50 hover:text-destructive flex-shrink-0" aria-label="Sair do sistema">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu de navegacao">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 !bg-sidebar-background text-sidebar-foreground border-sidebar-border">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  if (isMobile) return null;

  return (
    <aside role="navigation" aria-label="Navegacao principal" className="hidden md:flex flex-col h-screen w-64 bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border flex-shrink-0">
      <SidebarContent />
    </aside>
  );
}
