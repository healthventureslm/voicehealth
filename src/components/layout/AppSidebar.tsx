import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, FileText, Shield, LogOut,
  ClipboardList, Building2, Menu,
  Hospital, BookOpen, BarChart3, User, FileSignature,
  ChevronRight, PanelLeft,
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

const dashboardItem = { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" };

const clinicalNavItems = [
  { label: "Minhas gravações", icon: ClipboardList, path: "/consultations" },
  { label: "Pacientes", icon: Users, path: "/patients" },
  { label: "Gerar documento", icon: FileSignature, path: "/documents/new" },
];

const adminNavItems = [
  { label: "Usuários", icon: Shield, path: "/admin/users" },
  { label: "Setores", icon: Building2, path: "/admin/wards" },
  { label: "Templates", icon: FileText, path: "/admin/templates" },
  { label: "Especialidades", icon: Hospital, path: "/admin/specialties" },
  { label: "Métricas de uso", icon: BarChart3, path: "/admin/analytics" },
  { label: "Manual do admin", icon: BookOpen, path: "/admin/manual" },
];

const settingsNavItems = [
  { label: "Meu perfil", icon: User, path: "/profile" },
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
  const button = (
    <button
      onClick={onClick}
      aria-label={collapsed ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "w-full flex items-center gap-[10px] h-9 px-3 rounded-md transition-colors text-[14px]",
        collapsed ? "justify-center px-0" : "justify-start",
        isActive
          ? "bg-enf-soft text-enf-deep font-semibold"
          : "text-text-soft hover:bg-[var(--bg-card-hov)] hover:text-foreground font-medium",
      )}
      style={!isActive ? { color: "var(--text-soft)" } : undefined}
    >
      <item.icon
        className={cn("w-4 h-4 flex-shrink-0", "stroke-[2]")}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
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

  if (collapsed) {
    return (
      <>
        <Separator className="my-2" />
        <div className="space-y-1">{children}</div>
      </>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={toggle}>
      <CollapsibleTrigger
        className="flex items-center gap-1 w-full px-3 mb-1 mt-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enf rounded"
      >
        <ChevronRight
          className={cn(
            "w-3 h-3 transition-transform",
            open && "rotate-90",
          )}
          style={{ color: "var(--text-muted)" }}
          aria-hidden="true"
        />
        <span
          className="text-[11px] font-semibold leading-[1.4] tracking-normal"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
        >
          {label}
        </span>
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
      <div
        className={cn(
          "flex items-center pt-5 pb-4",
          collapsed ? "justify-center px-2" : "px-4 gap-2",
        )}
      >
        <BrandLockup collapsed={collapsed} className="flex-1 min-w-0" />
        {onToggleCollapse && !collapsed && (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-7 w-7 flex-shrink-0"
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

      {onToggleCollapse && collapsed && (
        <div className="flex justify-center pb-2">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-7 w-7"
                style={{ color: "var(--text-muted)" }}
                aria-label="Expandir menu"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expandir menu</TooltipContent>
          </Tooltip>
        </div>
      )}

      <Separator />

      <nav
        className={cn("flex-1 py-3 space-y-1 overflow-y-auto", "px-2")}
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

        <SectionGroup label="Configurações" collapsed={collapsed} defaultOpen={false}>
          {settingsNavItems.map((item) => (
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
        <div className="flex items-center gap-2 px-2 py-3">
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
        "hidden md:flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-shrink-0 transition-[width] duration-200",
        collapsed ? "w-16" : "w-[244px]",
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  );
}
