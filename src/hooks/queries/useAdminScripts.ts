import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import type { ScriptField } from "@/hooks/useScriptMatching";

/**
 * Linha completa de consultation_scripts pra uso no admin (inclui inativos
 * e o is_active flag).
 */
export interface AdminScript {
  id: string;
  hospital_id: string | null;
  name: string;
  description: string | null;
  fields: ScriptField[];
  applicable_ward_types: Enums<"ward_type">[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function parseFields(raw: unknown): ScriptField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? ""),
      label: String(f.label ?? ""),
      required: Boolean(f.required),
      keywords: Array.isArray(f.keywords) ? f.keywords.map(String) : [],
    }))
    .filter((f) => f.id && f.label);
}

function toAdminScript(row: any): AdminScript {
  return {
    id: row.id,
    hospital_id: row.hospital_id,
    name: row.name,
    description: row.description,
    fields: parseFields(row.fields),
    applicable_ward_types: row.applicable_ward_types ?? [],
    is_active: !!row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Lista scripts visíveis ao admin (globais + do hospital), inclui inativos.
 */
export function useAdminScripts(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["admin_scripts", hospitalId ?? "global"],
    queryFn: async () => {
      let q = supabase.from("consultation_scripts").select("*");
      if (hospitalId) {
        q = q.or(`hospital_id.is.null,hospital_id.eq.${hospitalId}`);
      }
      const { data, error } = await q
        .order("hospital_id", { nullsFirst: true })
        .order("name");
      if (error) throw error;
      return (data ?? []).map(toAdminScript);
    },
  });
}

export interface CreateScriptInput {
  hospital_id: string | null;
  name: string;
  description: string | null;
  fields: ScriptField[];
  applicable_ward_types: Enums<"ward_type">[];
  is_active: boolean;
  created_by?: string | null;
}

export function useCreateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScriptInput) => {
      const { data, error } = await supabase
        .from("consultation_scripts")
        .insert({
          hospital_id: input.hospital_id,
          name: input.name,
          description: input.description,
          fields: input.fields as any, // jsonb
          applicable_ward_types: input.applicable_ward_types,
          is_active: input.is_active,
          created_by: input.created_by ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return toAdminScript(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_scripts"] });
      qc.invalidateQueries({ queryKey: ["consultation_scripts"] });
    },
  });
}

export interface UpdateScriptInput {
  id: string;
  patch: Partial<{
    name: string;
    description: string | null;
    fields: ScriptField[];
    applicable_ward_types: Enums<"ward_type">[];
    is_active: boolean;
  }>;
}

export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateScriptInput) => {
      const dbPatch: Record<string, unknown> = { ...patch };
      if (patch.fields !== undefined) dbPatch.fields = patch.fields as any;
      const { data, error } = await supabase
        .from("consultation_scripts")
        .update(dbPatch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return toAdminScript(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_scripts"] });
      qc.invalidateQueries({ queryKey: ["consultation_scripts"] });
    },
  });
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consultation_scripts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_scripts"] });
      qc.invalidateQueries({ queryKey: ["consultation_scripts"] });
    },
  });
}
