import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

export function usePatients(departmentId?: string | null) {
  return useQuery({
    queryKey: ["patients", departmentId ?? "all"],
    queryFn: async () => {
      let query = supabase.from("patients").select("*").order("full_name");
      if (departmentId) query = query.eq("department_id", departmentId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
  });
}

export function useWards() {
  return useQuery({
    queryKey: ["wards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wards")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patient: Partial<Patient> & { full_name: string; department_id: string }) => {
      const { data, error } = await supabase
        .from("patients")
        .insert(patient)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Patient> & { id: string }) => {
      const { data, error } = await supabase
        .from("patients")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
