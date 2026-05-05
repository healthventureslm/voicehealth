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
          patient:patients(id, full_name, medical_record, current_ward_id, bed),
          ward:wards(id, name, ward_type),
          template:report_templates(id, name),
          hospital:hospitals(id, name, logo_url)
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
// Retorna todo report relacionado à consulta:
//   1. consultation_id = id          (consulta clássica com template)
//   2. id ∈ source_consultation_ids  (doc gerado de N notas que inclui esta)
export function useClinicalReports(consultationId: string | undefined) {
  return useQuery({
    queryKey: ["clinical_reports", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_reports")
        .select("*")
        .or(`consultation_id.eq.${consultationId},source_consultation_ids.cs.{${consultationId}}`)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Patient timeline (notas + documentos) ──────────────────────────
// Tudo que existe sobre o paciente em ordem cronológica reversa:
// - consultations (gravações: nota livre quando template_id IS NULL,
//   ou consulta com template clássica)
// - clinical_reports gerados de múltiplas notas (consultation_id IS NULL)
export function usePatientTimeline(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient_timeline", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const [consultsRes, reportsRes] = await Promise.all([
        supabase
          .from("consultations")
          .select(`
            id, patient_id, template_id, status, created_at, completed_at, locked_at,
            edited_transcription, raw_transcription, audio_duration_seconds,
            template:report_templates(id, name),
            ward:wards(id, name, ward_type)
          `)
          .eq("patient_id", patientId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("clinical_reports")
          .select(`
            id, patient_id, consultation_id, source_consultation_ids,
            template_id, version, content, format, generated_at,
            template:report_templates(id, name)
          `)
          .eq("patient_id", patientId!)
          .is("consultation_id", null)
          .order("generated_at", { ascending: false }),
      ]);
      if (consultsRes.error) throw consultsRes.error;
      if (reportsRes.error) throw reportsRes.error;

      type TimelineItem =
        | { kind: "note"; id: string; createdAt: string; payload: any }
        | { kind: "consultation"; id: string; createdAt: string; payload: any }
        | { kind: "document"; id: string; createdAt: string; payload: any };

      const items: TimelineItem[] = [];
      for (const c of consultsRes.data ?? []) {
        items.push({
          kind: c.template_id ? "consultation" : "note",
          id: c.id,
          createdAt: c.created_at,
          payload: c,
        });
      }
      for (const r of reportsRes.data ?? []) {
        items.push({
          kind: "document",
          id: r.id,
          createdAt: r.generated_at,
          payload: r,
        });
      }
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return items;
    },
  });
}

/**
 * TODOS os clinical_reports do paciente — independente de origem
 * (relatórios gerados de uma consulta com template OU documentos
 * multi-fonte gerados de notas).
 *
 * Diferente do timeline (que mostra a CONSULTA com seu relatório embutido),
 * isso aqui é a lista pura dos artefatos pra acesso rápido.
 */
export function usePatientDocuments(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient_documents", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_reports")
        .select(`
          id, patient_id, consultation_id, source_consultation_ids,
          template_id, version, content, format, generated_at,
          template:report_templates(id, name)
        `)
        .eq("patient_id", patientId!)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Notas (consultations sem template) recentes do paciente — usadas como fonte
 * pro fluxo "Gerar documento".
 */
export function usePatientNotes(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient_notes", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select(`
          id, patient_id, professional_id, status, created_at, completed_at,
          edited_transcription, raw_transcription, audio_duration_seconds
        `)
        .eq("patient_id", patientId!)
        .is("template_id", null)
        .not("edited_transcription", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Cria um clinical_report sintético — sem consultation_id, com source_consultation_ids
 * apontando pras notas usadas. O conteúdo já vem renderizado pela edge function.
 */
export function useCreateDocumentFromNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      patient_id: string;
      template_id: string;
      source_consultation_ids: string[];
      content: string;
      format?: "markdown" | "html" | "plaintext";
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("clinical_reports")
        .insert({
          patient_id: input.patient_id,
          template_id: input.template_id,
          source_consultation_ids: input.source_consultation_ids,
          content: input.content,
          format: input.format ?? "markdown",
          generated_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["patient_timeline", vars.patient_id] });
    },
  });
}
