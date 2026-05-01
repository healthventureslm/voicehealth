import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Lista todos os templates visíveis ao admin: globais + do hospital dele.
 */
export function useAdminTemplates(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["admin_templates", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .or(`hospital_id.is.null,hospital_id.eq.${hospitalId}`)
        .order("hospital_id", { nullsFirst: true })
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"report_templates">) => {
      const { data, error } = await supabase
        .from("report_templates")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_templates"] });
      qc.invalidateQueries({ queryKey: ["report_templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, patch,
    }: {
      id: string;
      patch: TablesUpdate<"report_templates">;
    }) => {
      const { data, error } = await supabase
        .from("report_templates")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_templates"] });
      qc.invalidateQueries({ queryKey: ["report_templates"] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_templates"] });
      qc.invalidateQueries({ queryKey: ["report_templates"] });
    },
  });
}
