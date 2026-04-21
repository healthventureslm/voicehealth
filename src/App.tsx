import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense, type ReactNode } from "react";

// Eager: critical login flow (small, seen immediately)
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SelectDepartment from "./pages/SelectDepartment";
import NotFound from "./pages/NotFound";

// Lazy: everything else (code-split by route)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const NewConsultation = lazy(() => import("./pages/NewConsultation"));
const Consultations = lazy(() => import("./pages/Consultations"));
const ConsultationEdit = lazy(() => import("./pages/ConsultationEdit"));
const ConsultationReport = lazy(() => import("./pages/ConsultationReport"));
const PatientHistory = lazy(() => import("./pages/PatientHistory"));
const AmbulatoryDashboard = lazy(() => import("./pages/ambulatory/AmbulatoryDashboard"));
const AmbulatoryNewConsultation = lazy(() => import("./pages/ambulatory/AmbulatoryNewConsultation"));
const AdminTemplates = lazy(() => import("./pages/admin/AdminTemplates"));
const AdminProtocols = lazy(() => import("./pages/admin/AdminProtocols"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminDepartments = lazy(() => import("./pages/admin/AdminDepartments"));
const AdminIndicators = lazy(() => import("./pages/admin/AdminIndicators"));
const AdminWards = lazy(() => import("./pages/admin/AdminWards"));
const AdminIpsg = lazy(() => import("./pages/admin/AdminIpsg"));
const AdminSpecialties = lazy(() => import("./pages/admin/AdminSpecialties"));
const AdminKnowledge = lazy(() => import("./pages/admin/AdminKnowledge"));
const AdminCollectionLogs = lazy(() => import("./pages/admin/AdminCollectionLogs"));
const IndicatorsDashboard = lazy(() => import("./pages/IndicatorsDashboard"));
const IpsgDashboard = lazy(() => import("./pages/ipsg/IpsgDashboard"));
const IpsgAudits = lazy(() => import("./pages/ipsg/IpsgAudits"));
const IpsgNewAudit = lazy(() => import("./pages/ipsg/IpsgNewAudit"));
const IpsgAuditDetail = lazy(() => import("./pages/ipsg/IpsgAuditDetail"));
const IpsgActionPlans = lazy(() => import("./pages/ipsg/IpsgActionPlans"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const LgpdSettings = lazy(() => import("./pages/LgpdSettings"));
const AdminLgpd = lazy(() => import("./pages/admin/AdminLgpd"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminManual = lazy(() => import("./pages/admin/AdminManual"));
const AdminScripts = lazy(() => import("./pages/admin/AdminScripts"));
const Profile = lazy(() => import("./pages/Profile"));
const MyRecordings = lazy(() => import("./pages/MyRecordings"));
const AudioTestPage = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/AudioTestPage"))
  : null;

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

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!profile?.department_id) {
    return (
      <Routes>
        <Route path="*" element={<SelectDepartment />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Lazy><Dashboard /></Lazy>} />
      <Route path="/patients" element={<Lazy><Patients /></Lazy>} />
      <Route path="/consultations" element={<Lazy><Consultations /></Lazy>} />
      <Route path="/consultations/new" element={<Lazy><NewConsultation /></Lazy>} />
      <Route path="/consultations/:id/edit" element={<Lazy><ConsultationEdit /></Lazy>} />
      <Route path="/consultations/:id/report" element={<Lazy><ConsultationReport /></Lazy>} />
      <Route path="/patients/:id/history" element={<Lazy><PatientHistory /></Lazy>} />
      <Route path="/gravacoes" element={<Lazy><MyRecordings /></Lazy>} />
      <Route path="/ambulatory" element={<Lazy><AmbulatoryDashboard /></Lazy>} />
      <Route path="/ambulatory/new" element={<Lazy><AmbulatoryNewConsultation /></Lazy>} />
      <Route path="/admin/templates" element={<AdminRoute><Lazy><AdminTemplates /></Lazy></AdminRoute>} />
      <Route path="/admin/protocols" element={<AdminRoute><Lazy><AdminProtocols /></Lazy></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><Lazy><AdminUsers /></Lazy></AdminRoute>} />
      <Route path="/admin/departments" element={<AdminRoute><Lazy><AdminDepartments /></Lazy></AdminRoute>} />
      <Route path="/admin/indicators" element={<AdminRoute><Lazy><AdminIndicators /></Lazy></AdminRoute>} />
      <Route path="/admin/wards" element={<AdminRoute><Lazy><AdminWards /></Lazy></AdminRoute>} />
      <Route path="/admin/ipsg" element={<AdminRoute><Lazy><AdminIpsg /></Lazy></AdminRoute>} />
      <Route path="/admin/specialties" element={<AdminRoute><Lazy><AdminSpecialties /></Lazy></AdminRoute>} />
      <Route path="/admin/knowledge" element={<AdminRoute><Lazy><AdminKnowledge /></Lazy></AdminRoute>} />
      <Route path="/admin/collection-logs" element={<AdminRoute><Lazy><AdminCollectionLogs /></Lazy></AdminRoute>} />
      <Route path="/indicators" element={<Lazy><IndicatorsDashboard /></Lazy>} />
      <Route path="/ipsg" element={<Lazy><IpsgDashboard /></Lazy>} />
      <Route path="/ipsg/audits" element={<Lazy><IpsgAudits /></Lazy>} />
      <Route path="/ipsg/audit/new" element={<Lazy><IpsgNewAudit /></Lazy>} />
      <Route path="/ipsg/audit/:id" element={<Lazy><IpsgAuditDetail /></Lazy>} />
      <Route path="/ipsg/action-plans" element={<Lazy><IpsgActionPlans /></Lazy>} />
      <Route path="/privacy" element={<Lazy><PrivacyPolicy /></Lazy>} />
      <Route path="/profile" element={<Lazy><Profile /></Lazy>} />
      <Route path="/settings/lgpd" element={<Lazy><LgpdSettings /></Lazy>} />
      <Route path="/admin/lgpd" element={<AdminRoute><Lazy><AdminLgpd /></Lazy></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><Lazy><AdminAnalytics /></Lazy></AdminRoute>} />
      <Route path="/admin/manual" element={<AdminRoute><Lazy><AdminManual /></Lazy></AdminRoute>} />
      <Route path="/admin/scripts" element={<AdminRoute><Lazy><AdminScripts /></Lazy></AdminRoute>} />
      {import.meta.env.DEV && AudioTestPage && (
        <Route path="/dev/audio-test" element={<Lazy><AudioTestPage /></Lazy>} />
      )}
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
