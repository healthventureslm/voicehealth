import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Lista todos os hospitais — RLS deixa super_admin ver tudo,
 * outros só veem o(s) seu(s).
 */
export function useHospitals() {
  return useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Tables<"hospitals">[];
    },
  });
}

export function useCreateHospital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"hospitals">) => {
      const { data, error } = await supabase
        .from("hospitals")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });
}

export function useUpdateHospital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"hospitals"> }) => {
      const { data, error } = await supabase
        .from("hospitals")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospitals"] });
    },
  });
}

/**
 * Detalhes de UM hospital: info + stats + listas resumidas.
 * Usado pelo super_admin pra drill-down em cada cliente.
 */
export function useHospitalDetail(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["hospital_detail", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      if (!hospitalId) throw new Error("missing hospitalId");

      const [hospital, wardsRes, rolesRes, patientsRes, consultationsRes] =
        await Promise.all([
          supabase.from("hospitals").select("*").eq("id", hospitalId).maybeSingle(),
          supabase
            .from("wards")
            .select("id, name, ward_type, bed_count, is_active")
            .eq("hospital_id", hospitalId)
            .order("name"),
          supabase
            .from("user_roles")
            .select("user_id, role")
            .eq("hospital_id", hospitalId),
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("hospital_id", hospitalId)
            .is("deleted_at", null),
          supabase
            .from("consultations")
            .select("id", { count: "exact", head: true })
            .eq("hospital_id", hospitalId),
        ]);

      const userIds = Array.from(new Set((rolesRes.data ?? []).map((r) => r.user_id)));
      const profilesRes = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, professional_role")
            .in("user_id", userIds)
        : { data: [] as any[] };

      const rolesByUser = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      const profileById = new Map(
        (profilesRes.data ?? []).map((p: any) => [p.user_id, p]),
      );

      const users = userIds.map((uid) => ({
        user_id: uid,
        full_name: profileById.get(uid)?.full_name ?? null,
        professional_role: profileById.get(uid)?.professional_role ?? null,
        roles: rolesByUser.get(uid) ?? [],
      }));

      return {
        hospital: hospital.data,
        wards: wardsRes.data ?? [],
        users,
        stats: {
          users_count: userIds.length,
          wards_count: (wardsRes.data ?? []).length,
          patients_count: patientsRes.count ?? 0,
          consultations_count: consultationsRes.count ?? 0,
        },
      };
    },
  });
}

/**
 * Estatísticas globais: contagem de hospitais, usuários, pacientes,
 * consultas, etc. — só super_admin consegue ler tudo via RLS.
 */
export function useGlobalStats() {
  return useQuery({
    queryKey: ["global_stats"],
    queryFn: async () => {
      const [hospitals, users, patients, consultations] = await Promise.all([
        supabase.from("hospitals").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }),
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("consultations").select("id", { count: "exact", head: true }),
      ]);
      return {
        hospitals: hospitals.count ?? 0,
        userRoles: users.count ?? 0,
        patients: patients.count ?? 0,
        consultations: consultations.count ?? 0,
      };
    },
  });
}
