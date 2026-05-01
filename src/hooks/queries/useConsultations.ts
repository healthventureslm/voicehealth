import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Consultation = Tables<"consultations">;

/**
 * Lista consultas visíveis (RLS aplica: próprias + do ward atual + admin/auditor).
 */
export function useConsultations(filters?: { patientId?: string; mineOnly?: boolean }) {
  return useQuery({
    queryKey: ["consultations", filters],
    queryFn: async () => {
      let q = supabase
        .from("consultations")
        .select(`
          id, patient_id, ward_id, professional_id, status, created_at, completed_at, locked_at,
          template_id, audio_duration_seconds,
          patient:patients(id, full_name, medical_record),
          ward:wards(id, name, ward_type)
        `)
        .order("created_at", { ascending: false });

      if (filters?.patientId) q = q.eq("patient_id", filters.patientId);
      if (filters?.mineOnly) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) q = q.eq("professional_id", user.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ["consultation", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select(`
          *,
          patient:patients(id, full_name, medical_record, current_ward_id),
          ward:wards(id, name, ward_type),
          template:report_templates(id, name)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"consultations">) => {
      const { data, error } = await supabase
        .from("consultations")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Consultation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
    },
  });
}

export function useUpdateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"consultations"> }) => {
      const { data, error } = await supabase
        .from("consultations")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["consultations"] });
      qc.invalidateQueries({ queryKey: ["consultation", vars.id] });
    },
  });
}

// ─── Addenda ─────────────────────────────────────────────────────────
// Como author_id referencia auth.users (não profiles), fazemos 2 queries
// e juntamos em JS — PostgREST não consegue inferir o join indireto.
export function useAddenda(consultationId: string | undefined) {
  return useQuery({
    queryKey: ["addenda", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      const { data: addenda, error } = await supabase
        .from("consultation_addenda")
        .select("*")
        .eq("consultation_id", consultationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!addenda || addenda.length === 0) return [];

      const authorIds = Array.from(new Set(addenda.map((a) => a.author_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);

      const nameByUser = new Map(
        (profiles ?? []).map((p) => [p.user_id, p.full_name]),
      );

      return addenda.map((a) => ({
        ...a,
        author: { full_name: nameByUser.get(a.author_id) ?? "—" },
      }));
    },
  });
}

export function useCreateAddendum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      consultationId,
      content,
      authorRole,
    }: {
      consultationId: string;
      content: string;
      authorRole: Tables<"consultation_addenda">["author_role_at_time"];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("consultation_addenda")
        .insert({
          consultation_id: consultationId,
          author_id: user.id,
          author_role_at_time: authorRole,
          content,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["addenda", vars.consultationId] });
    },
  });
}

// ─── Clinical reports ────────────────────────────────────────────────
export function useClinicalReports(consultationId: string | undefined) {
  return useQuery({
    queryKey: ["clinical_reports", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_reports")
        .select("*")
        .eq("consultation_id", consultationId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
