import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConsultations() {
  return useQuery({
    queryKey: ["consultations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*, patients(full_name, bed)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15 * 1000, // refresh every 15s — consultations change frequently
  });
}

export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ["consultation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*, patients(full_name, bed, medical_record)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 10 * 1000, // individual consultation — refresh every 10s
  });
}

export function useUpdateConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from("consultations")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      queryClient.invalidateQueries({ queryKey: ["consultation", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["recent-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
