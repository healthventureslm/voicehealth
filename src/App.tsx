import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense, type ReactNode } from "react";

// Eager: critical login/onboarding flow
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import WaitingInvitation from "./pages/WaitingInvitation";
import NotFound from "./pages/NotFound";

// Lazy: everything else (code-split by route)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const NewConsultation = lazy(() => import("./pages/NewConsultation"));
const Consultations = lazy(() => import("./pages/Consultations"));
const ConsultationEdit = lazy(() => import("./pages/ConsultationEdit"));
const ConsultationReport = lazy(() => import("./pages/ConsultationReport"));
const PatientHistory = lazy(() => import("./pages/PatientHistory"));
const MyRecordings = lazy(() => import("./pages/MyRecordings"));
const GenerateDocument = lazy(() => import("./pages/GenerateDocument"));
const DocumentView = lazy(() => import("./pages/DocumentView"));

// Admin do hospital
const AdminTemplates = lazy(() => import("./pages/admin/AdminTemplates"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminWards = lazy(() => import("./pages/admin/AdminWards"));
const AdminSpecialties = lazy(() => import("./pages/admin/AdminSpecialties"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminManual = lazy(() => import("./pages/admin/AdminManual"));

// Diversos
const Profile = lazy(() => import("./pages/Profile"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

// Super admin (Health Ventures)
const SuperAdminHome = lazy(() => import("./pages/superadmin/SuperAdminHome"));
const SuperAdminHospitals = lazy(() => import("./pages/superadmin/SuperAdminHospitals"));
const SuperAdminHospitalDetail = lazy(() => import("./pages/superadmin/SuperAdminHospitalDetail"));
const SuperAdminTemplates = lazy(() => import("./pages/superadmin/SuperAdminTemplates"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

function HospitalAdminRoute({ children }: { children: ReactNode }) {
  const { roles, isSuperAdmin } = useAuth();
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin");
  if (!isHospitalAdmin && !isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
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
        <Route path="/privacy" element={<Lazy><PrivacyPolicy /></Lazy>} />
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
        <Route path="/superadmin" element={<Lazy><SuperAdminHome /></Lazy>} />
        <Route path="/superadmin/hospitals" element={<Lazy><SuperAdminHospitals /></Lazy>} />
        <Route path="/superadmin/hospitals/:id" element={<Lazy><SuperAdminHospitalDetail /></Lazy>} />
        <Route path="/superadmin/templates" element={<Lazy><SuperAdminTemplates /></Lazy>} />
        <Route path="/profile" element={<Lazy><Profile /></Lazy>} />
        <Route path="/privacy" element={<Lazy><PrivacyPolicy /></Lazy>} />
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    );
  }

  // 4) Usuário regular: hospital_admin / doctor / nurse / auditor
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Lazy><Dashboard /></Lazy>} />

      {/* Fluxo clínico */}
      <Route path="/patients" element={<Lazy><Patients /></Lazy>} />
      <Route path="/patients/:id/history" element={<Lazy><PatientHistory /></Lazy>} />
      <Route path="/consultations" element={<Lazy><Consultations /></Lazy>} />
      <Route path="/consultations/new" element={<Lazy><NewConsultation /></Lazy>} />
      <Route path="/consultations/:id/edit" element={<Lazy><ConsultationEdit /></Lazy>} />
      <Route path="/consultations/:id/report" element={<Lazy><ConsultationReport /></Lazy>} />
      <Route path="/documents/new" element={<Lazy><GenerateDocument /></Lazy>} />
      <Route path="/documents/:id" element={<Lazy><DocumentView /></Lazy>} />
      <Route path="/gravacoes" element={<Lazy><MyRecordings /></Lazy>} />

      {/* Admin do hospital */}
      <Route path="/admin/templates" element={<HospitalAdminRoute><Lazy><AdminTemplates /></Lazy></HospitalAdminRoute>} />
      <Route path="/admin/users" element={<HospitalAdminRoute><Lazy><AdminUsers /></Lazy></HospitalAdminRoute>} />
      <Route path="/admin/wards" element={<HospitalAdminRoute><Lazy><AdminWards /></Lazy></HospitalAdminRoute>} />
      <Route path="/admin/specialties" element={<HospitalAdminRoute><Lazy><AdminSpecialties /></Lazy></HospitalAdminRoute>} />
      <Route path="/admin/analytics" element={<HospitalAdminRoute><Lazy><AdminAnalytics /></Lazy></HospitalAdminRoute>} />
      <Route path="/admin/manual" element={<HospitalAdminRoute><Lazy><AdminManual /></Lazy></HospitalAdminRoute>} />

      <Route path="/profile" element={<Lazy><Profile /></Lazy>} />
      <Route path="/privacy" element={<Lazy><PrivacyPolicy /></Lazy>} />
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
