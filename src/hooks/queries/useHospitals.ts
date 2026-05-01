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
