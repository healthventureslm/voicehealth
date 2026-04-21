import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  patients: number;
  consultations: number;
  todayConsultations: number;
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().split("T")[0];

  const [patientsRes, consultationsRes, todayRes] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase.from("consultations").select("id", { count: "exact", head: true }),
    supabase
      .from("consultations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today),
  ]);

  return {
    patients: patientsRes.count || 0,
    consultations: consultationsRes.count || 0,
    todayConsultations: todayRes.count || 0,
  };
}

export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    enabled,
    staleTime: 30 * 1000, // refresh every 30s — dashboard data changes moderately
  });
}

export function useRecentConsultations(enabled = true) {
  return useQuery({
    queryKey: ["recent-consultations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*, patients(full_name, bed)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled,
    staleTime: 30 * 1000, // refresh every 30s
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000, // departments rarely change
  });
}
