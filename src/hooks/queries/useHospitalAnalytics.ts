import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsBucket {
  date: string;          // YYYY-MM-DD
  consultations: number;
}

/**
 * Métricas de uso de UM hospital (ou todos via super_admin).
 * RLS já filtra por hospital.
 */
export function useHospitalAnalytics(hospitalId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ["hospital_analytics", hospitalId, days],
    enabled: !!hospitalId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();

      const [consultationsRes, patientsRes, wardsRes, usersRes, byProRes] =
        await Promise.all([
          // Todas consultas do período (com data + ward + professional)
          supabase
            .from("consultations")
            .select("id, created_at, ward_id, professional_id, status")
            .eq("hospital_id", hospitalId!)
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: true }),
          // Total de pacientes ativos
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("hospital_id", hospitalId!)
            .is("deleted_at", null),
          // Wards do hospital
          supabase
            .from("wards")
            .select("id, name, ward_type")
            .eq("hospital_id", hospitalId!)
            .eq("is_active", true),
          // Roles (pra contar usuários únicos)
          supabase
            .from("user_roles")
            .select("user_id, role")
            .eq("hospital_id", hospitalId!),
          // Consultas por profissional pro top-5
          supabase.rpc("get_top_professionals" as any, {
            p_hospital_id: hospitalId,
            p_since: sinceIso,
          }).then(
            (r) => r,
            // Função RPC pode não existir — fallback silencioso
            () => ({ data: null }),
          ),
        ]);

      const consultations = consultationsRes.data ?? [];

      // Bucket por dia (YYYY-MM-DD)
      const buckets = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
      consultations.forEach((c) => {
        const key = (c.created_at as string).slice(0, 10);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
      const series: AnalyticsBucket[] = Array.from(buckets.entries()).map(
        ([date, n]) => ({ date, consultations: n }),
      );

      // Distribuição por ward
      const byWard = new Map<string, number>();
      consultations.forEach((c) => {
        if (c.ward_id) byWard.set(c.ward_id, (byWard.get(c.ward_id) ?? 0) + 1);
      });

      // Top profissionais (a partir das consultations carregadas, fallback caso RPC indisponível)
      const byPro = new Map<string, number>();
      consultations.forEach((c) => {
        byPro.set(c.professional_id, (byPro.get(c.professional_id) ?? 0) + 1);
      });
      const topProIds = Array.from(byPro.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([uid, count]) => ({ user_id: uid, count }));

      // Busca nomes
      const proNames = topProIds.length
        ? (await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", topProIds.map((p) => p.user_id))).data ?? []
        : [];
      const nameByUser = new Map(proNames.map((p) => [p.user_id, p.full_name]));
      const topPros = topProIds.map((p) => ({
        ...p,
        full_name: nameByUser.get(p.user_id) ?? "—",
      }));

      const userIds = Array.from(new Set((usersRes.data ?? []).map((r) => r.user_id)));

      return {
        series,
        totals: {
          consultations: consultations.length,
          patients: patientsRes.count ?? 0,
          wards: (wardsRes.data ?? []).length,
          users: userIds.length,
        },
        byWard: (wardsRes.data ?? []).map((w) => ({
          ward_id: w.id,
          name: w.name,
          ward_type: w.ward_type as string,
          count: byWard.get(w.id) ?? 0,
        })),
        topProfessionals: topPros,
        statusCounts: consultations.reduce<Record<string, number>>((acc, c) => {
          acc[c.status] = (acc[c.status] ?? 0) + 1;
          return acc;
        }, {}),
        // Não usado, mas mantido pro caso de RPC futuro:
        rpcData: byProRes.data,
      };
    },
  });
}
