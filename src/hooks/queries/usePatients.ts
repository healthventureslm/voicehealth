import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

/**
 * Lista pacientes visíveis ao usuário com dados completos (prontuário, leito,
 * etc). RLS de `patients` restringe: doctor/nurse só vê pacientes em setor
 * onde tem ward_assignment ativo; admin/auditor vê o hospital inteiro.
 */
export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*, current_ward:wards!patients_current_ward_id_fkey(id, name, ward_type)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<Patient & { current_ward: { id: string; name: string; ward_type: string } | null }>;
    },
  });
}

/**
 * Diretório leve de pacientes do hospital inteiro — só nome + setor + status.
 * Usado pra mostrar a listagem completa de pacientes do hospital pra qualquer
 * membro, sem expor dados clínicos sensíveis (prontuário, leito, DOB).
 *
 * Pacientes "fora do meu setor" só aparecem aqui — pra dados completos é
 * preciso estar no setor (RLS de `patients`).
 */
export type PatientDirectoryEntry = {
  id: string;
  hospital_id: string;
  full_name: string;
  current_ward_id: string | null;
  admission_status: "admitted" | "discharged" | "transferred";
  ward_name: string | null;
  ward_type: string | null;
  created_at: string;
};

export function usePatientsDirectory() {
  return useQuery({
    queryKey: ["patients_directory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_hospital_patients");
      if (error) throw error;
      return (data ?? []) as PatientDirectoryEntry[];
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
      qc.invalidateQueries({ queryKey: ["patients_directory"] });
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
      qc.invalidateQueries({ queryKey: ["patients_directory"] });
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
      qc.invalidateQueries({ queryKey: ["patients_directory"] });
      qc.invalidateQueries({ queryKey: ["consultations"] });
    },
  });
}

export function useDischargePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      reason,
      userId,
    }: {
      patientId: string;
      reason?: string;
      userId?: string;
    }) => {
      const { data, error } = await supabase
        .from("patients")
        .update({
          admission_status: "discharged",
          discharge_reason: reason?.trim() || null,
          discharged_by: userId ?? null,
        })
        .eq("id", patientId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patients_directory"] });
    },
  });
}

export function useReadmitPatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patientId: string) => {
      const { data, error } = await supabase
        .from("patients")
        .update({ admission_status: "admitted" })
        .eq("id", patientId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patients_directory"] });
      qc.invalidateQueries({ queryKey: ["patient", id] });
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
