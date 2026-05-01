import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConsultation, useUpdateConsultation } from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock } from "lucide-react";
import { toast } from "sonner";

export default function ConsultationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: consultation, isLoading } = useConsultation(id);
  const update = useUpdateConsultation();
  const [text, setText] = useState("");

  useEffect(() => {
    if (consultation) {
      setText(consultation.edited_transcription ?? consultation.raw_transcription ?? "");
    }
  }, [consultation]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">Carregando…</div>
      </AppLayout>
    );
  }
  if (!consultation) {
    return (
      <AppLayout>
        <div className="p-6">Atendimento não encontrado.</div>
      </AppLayout>
    );
  }

  if (consultation.locked_at) {
    return (
      <AppLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
              <div className="font-medium">Atendimento bloqueado</div>
              <div className="text-sm text-muted-foreground">
                Este atendimento foi bloqueado para edição (paciente transferido).
                Você ainda pode adicionar observações na tela de visualização.
              </div>
              <Button onClick={() => navigate(`/consultations/${id}/report`)}>
                Ir para visualização
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  async function handleSave() {
    try {
      await update.mutateAsync({
        id: id!,
        patch: { edited_transcription: text },
      });
      toast.success("Salvo");
      navigate(`/consultations/${id}/report`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Editar atendimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Transcrição / texto do atendimento</Label>
              <Textarea
                rows={16}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => navigate(`/consultations/${id}/report`)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={update.isPending}>
                {update.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
