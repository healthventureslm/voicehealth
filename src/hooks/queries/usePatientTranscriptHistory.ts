import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Histórico de transcrições de todas as consultas (com áudio finalizado) de
 * um paciente. Usado pelo teleprompter pra pré-marcar pontos já cobertos em
 * gravações anteriores — não força o profissional a repetir info que já
 * está no prontuário.
 *
 * Estratégia: prioriza edited_transcription (versão final humana); cai pra
 * raw_transcription se não tiver editada. Devolve uma string única
 * concatenada — o teleprompter só precisa fazer keyword match.
 *
 * Pega só status "transcribed", "editing" ou "completed" (já tem texto).
 */
export function usePatientTranscriptHistory(patientId: string | undefined | null) {
  return useQuery({
    queryKey: ["patient_transcript_history", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("id, edited_transcription, raw_transcription, created_at")
        .eq("patient_id", patientId!)
        .in("status", ["transcribed", "editing", "completed"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const transcripts = (data ?? [])
        .map((c) => (c.edited_transcription || c.raw_transcription || "").trim())
        .filter(Boolean);

      return {
        consultationCount: transcripts.length,
        // Concatena com espaço — o matching só precisa de texto contínuo
        combined: transcripts.join(" "),
      };
    },
  });
}
