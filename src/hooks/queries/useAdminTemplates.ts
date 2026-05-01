import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 * Lista templates visíveis ao admin.
 * - hospitalId definido: globais + do hospital dele
 * - hospitalId undefined: todos os globais (super_admin) — RLS restringe pra
 *   super_admin ver tudo, hospital_admin sem hospitalId não vê nada útil aqui.
 */
export function useAdminTemplates(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["admin_templates", hospitalId ?? "global"],
    queryFn: async () => {
      let q = supabase.from("report_templates").select("*");
      if (hospitalId) {
        q = q.or(`hospital_id.is.null,hospital_id.eq.${hospitalId}`);
      }
      // Sem hospitalId, RLS de super_admin retorna todos; outros não veem nada.
      const { data, error } = await q
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
