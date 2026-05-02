import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Stats consolidados pra Dashboard do profissional.
 * RLS já filtra: nurse/doctor só conta o que pode ver.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard_stats"],
    staleTime: 60_000, // 1 min
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { patients: 0, todayConsultations: 0, myInProgress: 0, myCompleted: 0 };
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const isoToday = startOfToday.toISOString();

      const [patientsRes, todayRes, inProgressRes, completedRes] = await Promise.all([
        // Pacientes visíveis (RLS filtra ward-scoped pra nurse/doctor)
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
        // Atendimentos criados hoje
        supabase
          .from("consultations")
          .select("id", { count: "exact", head: true })
          .gte("created_at", isoToday),
        // Meus rascunhos (não-completed)
        supabase
          .from("consultations")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", user.id)
          .neq("status", "completed"),
        // Meus completos
        supabase
          .from("consultations")
          .select("id", { count: "exact", head: true })
          .eq("professional_id", user.id)
          .eq("status", "completed"),
      ]);

      return {
        patients: patientsRes.count ?? 0,
        todayConsultations: todayRes.count ?? 0,
        myInProgress: inProgressRes.count ?? 0,
        myCompleted: completedRes.count ?? 0,
      };
    },
  });
}
