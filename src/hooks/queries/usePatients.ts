import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

/**
 * Lista pacientes visíveis ao usuário.
 * RLS já filtra automaticamente: ward-scoped pra doctor/nurse,
 * hospital inteiro pra hospital_admin/auditor.
 */
export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*, current_ward:wards!patients_current_ward_id_fkey(id, name, ward_type)")
        .is("deleted_at", null)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<Patient & { current_ward: { id: string; name: string; ward_type: string } | null }>;
    },
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patient", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*, current_ward:wards!patients_current_ward_id_fkey(id, name, ward_type, hospital_id)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"patients">) => {
      const { data, error } = await supabase
        .from("patients")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"patients"> }) => {
      const { data, error } = await supabase
        .from("patients")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", vars.id] });
    },
  });
}

export function useTransferPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientId, newWardId, reason }: { patientId: string; newWardId: string; reason?: string }) => {
      const { data, error } = await supabase
        .from("patients")
        .update({ current_ward_id: newWardId, admission_status: "admitted" })
        .eq("id", patientId)
        .select()
        .single();
      if (error) throw error;
      // patient_ward_history é atualizada via trigger record_ward_transfer no banco
      // consultations antigas viram locked_at via trigger lock_consultations_on_transfer
      // reason é opcional — pode ser usado em metadata futuramente
      void reason;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["consultations"] });
    },
  });
}

export function usePatientWardHistory(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient_ward_history", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_ward_history")
        .select("*, ward:wards(name, ward_type)")
        .eq("patient_id", patientId!)
        .order("admitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
