import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { lazy, Suspense, type ReactNode } from "react";

// Eager: login/onboarding (já era)
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import WaitingInvitation from "./pages/WaitingInvitation";
import NotFound from "./pages/NotFound";

// Eager: fluxo clínico — navegação entre essas páginas precisa ser INSTANTÂNEA.
// Total ~100KB extra no bundle inicial; ganho de UX no dia-a-dia compensa.
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import NewAttendance from "./pages/NewAttendance";
import NewConsultation from "./pages/NewConsultation";
import Consultations from "./pages/Consultations";
import ConsultationEdit from "./pages/ConsultationEdit";
import ConsultationReport from "./pages/ConsultationReport";
import PatientHistory from "./pages/PatientHistory";
import MyRecordings from "./pages/MyRecordings";
import GenerateDocument from "./pages/GenerateDocument";
import DocumentView from "./pages/DocumentView";
import Profile from "./pages/Profile";

// Lazy: páginas raras (admin/superadmin/legal) — code-split mantém bundle enxuto.
const AdminTemplates = lazy(() => import("./pages/admin/AdminTemplates"));
const AdminScripts = lazy(() => import("./pages/admin/AdminScripts"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminWards = lazy(() => import("./pages/admin/AdminWards"));
const AdminSpecialties = lazy(() => import("./pages/admin/AdminSpecialties"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminManual = lazy(() => import("./pages/admin/AdminManual"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

const SuperAdminHome = lazy(() => import("./pages/superadmin/SuperAdminHome"));
const SuperAdminHospitals = lazy(() => import("./pages/superadmin/SuperAdminHospitals"));
const SuperAdminHospitalDetail = lazy(() => import("./pages/superadmin/SuperAdminHospitalDetail"));
const SuperAdminTemplates = lazy(() => import("./pages/superadmin/SuperAdminTemplates"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function HospitalAdminRoute({ children }: { children: ReactNode }) {
  const { roles, isSuperAdmin } = useAuth();
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin");
  if (!isHospitalAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * Shell de rota pra usuário regular: monta AppLayout uma vez e renderiza
 * a página filha via Outlet. Isso mantém sidebar/header estáveis durante
 * navegação — só a área de conteúdo entra em Suspense quando o chunk da
 * próxima página ainda não chegou.
 */
function AppShellRoute() {
  return (
    <AppLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppLayout>
  );
}

function SuperAdminShellRoute() {
  return (
    <SuperAdminLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </SuperAdminLayout>
  );
}

function AppRoutes() {
  const { user, roles, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 1) Não autenticado: telas públicas
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={
          <Suspense fallback={<PageSkeleton />}><PrivacyPolicy /></Suspense>
        } />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // 2) Autenticado mas SEM role: aguardando convite
  if (roles.length === 0) {
    return (
      <Routes>
        <Route path="*" element={<WaitingInvitation />} />
      </Routes>
    );
  }

  // 3) Super admin: painel /superadmin/* exclusivo
  // Catch-all redireciona pra /superadmin (super_admin não tem /dashboard,
  // /patients etc — qualquer URL desconhecida vai pro home dele)
  if (isSuperAdmin) {
    return (
      <Routes>
        <Route element={<SuperAdminShellRoute />}>
          <Route path="/superadmin" element={<SuperAdminHome />} />
          <Route path="/superadmin/hospitals" element={<SuperAdminHospitals />} />
          <Route path="/superadmin/hospitals/:id" element={<SuperAdminHospitalDetail />} />
          <Route path="/superadmin/templates" element={<SuperAdminTemplates />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Route>
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    );
  }

  // 4) Usuário regular: hospital_admin / doctor / nurse / auditor
  return (
    <Routes>
      {/* Landing — sem AppLayout */}
      <Route path="/" element={<Index />} />

      {/* Tudo que tem AppLayout entra pelo shell — sidebar/header não remontam */}
      <Route element={<AppShellRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Fluxo clínico */}
        <Route path="/atendimentos/new" element={<NewAttendance />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id/history" element={<PatientHistory />} />
        <Route path="/consultations" element={<Consultations />} />
        <Route path="/consultations/new" element={<NewConsultation />} />
        <Route path="/consultations/:id/edit" element={<ConsultationEdit />} />
        <Route path="/consultations/:id/report" element={<ConsultationReport />} />
        <Route path="/documents/new" element={<GenerateDocument />} />
        <Route path="/documents/:id" element={<DocumentView />} />
        <Route path="/gravacoes" element={<MyRecordings />} />

        {/* Admin do hospital */}
        <Route path="/admin/templates" element={<HospitalAdminRoute><AdminTemplates /></HospitalAdminRoute>} />
        <Route path="/admin/scripts" element={<HospitalAdminRoute><AdminScripts /></HospitalAdminRoute>} />
        <Route path="/admin/users" element={<HospitalAdminRoute><AdminUsers /></HospitalAdminRoute>} />
        <Route path="/admin/wards" element={<HospitalAdminRoute><AdminWards /></HospitalAdminRoute>} />
        <Route path="/admin/specialties" element={<HospitalAdminRoute><AdminSpecialties /></HospitalAdminRoute>} />
        <Route path="/admin/analytics" element={<HospitalAdminRoute><AdminAnalytics /></HospitalAdminRoute>} />
        <Route path="/admin/manual" element={<HospitalAdminRoute><AdminManual /></HospitalAdminRoute>} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Route>

      {/* Rotas de auth — usuário já logado, manda pro Dashboard */}
      <Route path="/login"           element={<Navigate to="/dashboard" replace />} />
      <Route path="/signup"          element={<Navigate to="/dashboard" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/dashboard" replace />} />
      <Route path="/reset-password"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
