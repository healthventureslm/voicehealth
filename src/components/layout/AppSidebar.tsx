import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, FileText, Shield, LogOut,
  ClipboardList, Building2, Menu,
  Hospital, BookOpen, BarChart3, FileSignature,
  ChevronRight, PanelLeft, ListChecks, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { BrandLockup } from "./BrandLockup";
import { GradientAvatar } from "@/components/GradientAvatar";
import { NotificationsBell } from "@/components/NotificationsBell";

const dashboardItem = { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" };

const clinicalNavItems = [
  { label: "Novo atendimento", icon: Plus, path: "/atendimentos/new" },
  { label: "Gravações", icon: ClipboardList, path: "/consultations" },
  { label: "Pacientes", icon: Users, path: "/patients" },
  { label: "Gerar documento", icon: FileSignature, path: "/documents/new" },
];

const adminNavItems = [
  { label: "Usuários", icon: Shield, path: "/admin/users" },
  { label: "Setores", icon: Building2, path: "/admin/wards" },
  { label: "Templates", icon: FileText, path: "/admin/templates" },
  { label: "Roteiros", icon: ListChecks, path: "/admin/scripts" },
  { label: "Especialidades", icon: Hospital, path: "/admin/specialties" },
  { label: "Métricas de uso", icon: BarChart3, path: "/admin/analytics" },
  { label: "Manual do admin", icon: BookOpen, path: "/admin/manual" },
];

function NavButton({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: typeof dashboardItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  // Ícone fica sempre no MESMO X (px-3 + posição left do flex). Quando colapsa,
  // só o texto faz fade — o ícone não se move. A largura do <aside> anima e
  // o overflow-x:hidden corta o texto à direita conforme encolhe.
  const button = (
    <button
      onClick={onClick}
      aria-label={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-[10px] h-9 px-3 rounded-md transition-colors text-[14px] justify-start",
        isActive
          ? "bg-enf-soft text-enf-deep font-semibold"
          : "text-text-soft hover:bg-[var(--bg-card-hov)] hover:text-foreground font-medium",
      )}
      style={!isActive ? { color: "var(--text-soft)" } : undefined}
    >
      <item.icon
        className="w-4 h-4 flex-shrink-0 stroke-[2]"
        aria-hidden="true"
      />
      <span
        className={cn(
          "whitespace-nowrap transition-opacity duration-150",
          collapsed ? "opacity-0" : "opacity-100",
        )}
        aria-hidden={collapsed}
      >
        {item.label}
      </span>
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function SectionGroup({
  label,
  collapsed,
  children,
  defaultOpen = true,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
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
    <Collapsible open={collapsed ? true : open} onOpenChange={collapsed ? undefined : toggle}>
      <CollapsibleTrigger
        tabIndex={collapsed ? -1 : 0}
        aria-hidden={collapsed}
        className={cn(
          // `relative` posiciona o divisor (line) abaixo; quando colapsado,
          // a line vira a separação entre seções (cruz-fade com chevron+label).
          "relative flex items-center gap-1 w-full px-3 mb-1 mt-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enf rounded",
          collapsed && "pointer-events-none",
        )}
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-all duration-150",
            open && "rotate-90",
            collapsed && "opacity-0",
          )}
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-[11px] font-semibold leading-[1.4] tracking-normal transition-opacity duration-150",
            collapsed && "opacity-0",
          )}
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
        >
          {label}
        </span>
        {/* Linha divisória que aparece só quando colapsada.
            Ao colapsar: espera o slide do width terminar (delay-200) pra
            só então aparecer pequena. Ao expandir: some na hora (sem delay)
            pra não ficar visível "esticando" enquanto a sidebar abre. */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-3 right-3 top-1/2 -translate-y-1/2 h-px transition-opacity duration-150",
            collapsed ? "opacity-100 delay-200" : "opacity-0",
          )}
          style={{ background: "var(--border-color)" }}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarContent({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { user, profile, roles, isSuperAdmin, signOut } = useAuth();
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin") || isSuperAdmin;
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="flex flex-col h-full">
      {/*
        Header com altura fixa (min-h) — garante que os itens da nav abaixo
        ficam exatamente na mesma posição vertical em ambos os estados
        (expandido e colapsado). A altura é dimensionada pra caber o lockup
        completo (VoxFlow / Enfermagem / by HealthVentures).
      */}
      <div className="flex items-center pt-5 pb-4 px-[15px] gap-[10px] min-h-[79px]">
        {/*
          Ícone-logo SEMPRE no mesmo lugar — não muda de posição entre estados.
          Quando colapsado: o ícone vira a alça de "expandir" (hover-swap pra
          PanelLeft, estilo ChatGPT). Quando expandido: é decorativo (não tem
          ação porque o botão "Recolher menu" à direita cuida disso).
        */}
        {onToggleCollapse && collapsed ? (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                aria-label="Expandir menu"
                className="group relative w-[34px] h-[34px] rounded-[7px] overflow-hidden flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="absolute inset-0 flex items-center justify-center bg-enf shadow-sm transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="w-[18px] h-[18px] text-white"
                    aria-hidden="true"
                  >
                    <line x1="6" y1="9" x2="6" y2="15" />
                    <line x1="10" y1="6" x2="10" y2="18" />
                    <line x1="14" y1="4" x2="14" y2="20" />
                    <line x1="18" y1="9" x2="18" y2="15" />
                  </svg>
                </span>
                <span
                  className="absolute inset-0 flex items-center justify-center bg-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{ color: "var(--text)" }}
                >
                  <PanelLeft className="w-4 h-4" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>
        ) : (
          <div
            className="w-[34px] h-[34px] rounded-[7px] flex items-center justify-center flex-shrink-0 bg-enf shadow-sm"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="w-[18px] h-[18px] text-white"
            >
              <line x1="6" y1="9" x2="6" y2="15" />
              <line x1="10" y1="6" x2="10" y2="18" />
              <line x1="14" y1="4" x2="14" y2="20" />
              <line x1="18" y1="9" x2="18" y2="15" />
            </svg>
          </div>
        )}

        {/* Texto da marca — fade de opacidade, sem mudar layout */}
        <div
          className={cn(
            "flex flex-col leading-[1.05] flex-1 min-w-0 whitespace-nowrap transition-opacity duration-150",
            collapsed && "opacity-0",
          )}
          aria-hidden={collapsed}
        >
          <span
            className="font-extrabold text-[15px] tracking-[-0.02em] text-foreground"
            style={{ fontFamily: "var(--font-body)" }}
          >
            VoxFlow
          </span>
          <span
            className="text-[11px] font-medium mt-[2px]"
            style={{ color: "var(--text-soft)", fontFamily: "var(--font-body)" }}
          >
            Enfermagem
          </span>
          <span
            className="inline-flex items-baseline gap-1 text-[9px] font-bold tracking-[-0.01em] leading-none mt-[5px] whitespace-nowrap"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <span
              className="font-medium"
              style={{ color: "var(--text-muted)", letterSpacing: 0 }}
            >
              by
            </span>
            <span style={{ color: "var(--text)" }}>Health</span>
            <span className="hv-ventures-gradient">Ventures</span>
          </span>
        </div>

        {/* Botão "Recolher menu" — só ativo em expandido, fade junto */}
        {onToggleCollapse && (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={collapsed ? undefined : onToggleCollapse}
                tabIndex={collapsed ? -1 : 0}
                aria-hidden={collapsed}
                className={cn(
                  "h-7 w-7 flex-shrink-0 transition-opacity duration-150",
                  collapsed && "opacity-0 pointer-events-none",
                )}
                style={{ color: "var(--text-muted)" }}
                aria-label="Recolher menu"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Recolher menu</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Separator />

      <nav
        className={cn("flex-1 py-3 space-y-1 overflow-y-auto overflow-x-hidden", "px-2")}
        aria-label="Navegação principal"
      >
        <NavButton
          item={dashboardItem}
          isActive={isActive(dashboardItem.path)}
          collapsed={collapsed}
          onClick={() => handleNav(dashboardItem.path)}
        />

        <SectionGroup label="Clínica" collapsed={collapsed}>
          {clinicalNavItems.map((item) => (
            <NavButton
              key={item.path}
              item={item}
              isActive={isActive(item.path)}
              collapsed={collapsed}
              onClick={() => handleNav(item.path)}
            />
          ))}
        </SectionGroup>

        {isHospitalAdmin && (
          <SectionGroup label="Administração" collapsed={collapsed} defaultOpen={false}>
            {adminNavItems.map((item) => (
              <NavButton
                key={item.path}
                item={item}
                isActive={isActive(item.path)}
                collapsed={collapsed}
                onClick={() => handleNav(item.path)}
              />
            ))}
          </SectionGroup>
        )}
      </nav>

      <Separator />

      {collapsed ? (
        <div className="flex flex-col items-center gap-2 px-2 py-3">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNav("/profile")}
                className="rounded-md hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enf"
                aria-label="Ir para perfil"
              >
                <GradientAvatar name={profile?.full_name} isMe size="sm" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{profile?.full_name || "Usuário"}</TooltipContent>
          </Tooltip>
          <NotificationsBell />
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                style={{ color: "var(--text-muted)" }}
                className="hover:!text-destructive h-8 w-8"
                aria-label="Sair do sistema"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div className="flex items-center gap-1 px-2 py-3">
          <button
            onClick={() => handleNav("/profile")}
            className="flex items-center gap-[10px] flex-1 min-w-0 rounded-md hover:bg-[var(--bg-card-hov)] px-2 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enf"
            aria-label="Ir para perfil"
          >
            <GradientAvatar name={profile?.full_name} isMe size="sm" />
            <div className="flex-1 min-w-0 text-left">
              <p
                className="text-[13px] font-medium truncate"
                style={{ color: "var(--text)" }}
              >
                {profile?.full_name || "Usuário"}
              </p>
              <p
                className="text-[11px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {user?.email}
              </p>
            </div>
          </button>
          <NotificationsBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            style={{ color: "var(--text-muted)" }}
            className="hover:!text-destructive flex-shrink-0 h-8 w-8"
            aria-label="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem("sidebar-collapsed") === "true",
  );

  if (isMobile) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <aside
      role="navigation"
      aria-label="Navegação principal"
      className={cn(
        "hidden md:flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0 transition-[width] duration-200 overflow-x-hidden",
        collapsed ? "w-16" : "w-[244px]",
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}
