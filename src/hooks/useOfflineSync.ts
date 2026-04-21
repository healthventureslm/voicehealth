import { useState, useEffect, useCallback, useRef } from "react";
import {
  savePendingRecording,
  getAllPendingRecordings,
  deletePendingRecording,
  getPendingCount,
  type PendingRecording,
} from "@/lib/offlineDb";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  const syncPending = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const items = await getAllPendingRecordings();
      if (items.length === 0) { setIsSyncing(false); syncingRef.current = false; return; }

      toast.info(`Sincronizando ${items.length} gravação(ões) pendente(s)...`);

      for (const item of items) {
        try {
          const fileName = `${item.userId}/${Date.now()}-${item.id}.webm`;
          const { error: uploadError } = await supabase.storage
            .from("audio-recordings")
            .upload(fileName, item.audioBlob);
          if (uploadError) throw uploadError;

          const baseData = {
            patient_id: item.patientId,
            department_id: item.departmentId,
            professional_id: item.userId,
            audio_url: fileName,
            specialty_id: item.specialtyId,
            selected_template_id: item.templateId,
            ...(item.manualTranscription
              ? {
                  status: "transcribed" as const,
                  raw_transcription: item.manualTranscription,
                  edited_transcription: item.manualTranscription,
                }
              : { status: "transcribing" as const }),
          };

          const { data: consultation, error: consultError } = await supabase
            .from("consultations")
            .insert(baseData)
            .select()
            .single();
          if (consultError) throw consultError;

          if (!item.manualTranscription) {
            await supabase.functions.invoke("transcribe-audio", {
              body: {
                consultation_id: consultation.id,
                audio_path: fileName,
                template_id: item.templateId,
              },
            });
          } else {
            await supabase.functions.invoke("generate-report", {
              body: {
                consultation_id: consultation.id,
                template_id: item.templateId,
                transcription: item.manualTranscription,
              },
            });
          }

          await deletePendingRecording(item.id);
          toast.success(`Gravação de ${new Date(item.createdAt).toLocaleTimeString()} sincronizada!`);
        } catch (err: any) {
          console.error("Sync failed for item", item.id, err);
          toast.error(`Falha ao sincronizar gravação. Tentaremos novamente.`);
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      await refreshCount();
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [refreshCount]);

  const saveOffline = useCallback(
    async (data: Omit<PendingRecording, "id" | "createdAt">) => {
      const record: PendingRecording = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      await savePendingRecording(record);
      await refreshCount();
      toast.success("Gravação salva offline. Será enviada quando a internet voltar.");
    },
    [refreshCount]
  );

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncPending(); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    refreshCount();

    // Try sync on mount if online
    if (navigator.onLine) syncPending();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPending, refreshCount]);

  return { isOnline, pendingCount, isSyncing, saveOffline, syncPending };
}
