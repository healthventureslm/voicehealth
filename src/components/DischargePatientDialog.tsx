import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDischargePatient } from "@/hooks/queries";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

interface Props {
  patientId: string;
  patientName: string;
  /** Texto/ícone do trigger. Padrão: botão "Dar alta". */
  trigger?: React.ReactNode;
  /** Pré-preenche o motivo (ex.: alerta 48h, alta automática proposta). */
  defaultReason?: string;
  onDischarged?: () => void;
}

export function DischargePatientDialog({
  patientId, patientName, trigger, defaultReason, onDischarged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason ?? "");
  const { user } = useAuth();
  const discharge = useDischargePatient();

  async function handleDischarge() {
    try {
      await discharge.mutateAsync({
        patientId,
        reason: reason.trim() || undefined,
        userId: user?.id,
      });
      toast.success("Paciente recebeu alta");
      setOpen(false);
      setReason(defaultReason ?? "");
      onDischarged?.();
    } catch (e: any) {
      toast.error(`Erro ao dar alta: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" /> Dar alta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar alta ao paciente</DialogTitle>
          <DialogDescription>
            <strong>{patientName}</strong> será marcado como em alta. Os dados
            continuam acessíveis no histórico; novas gravações ficam
            desabilitadas até uma readmissão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: alta médica, paciente estável; encaminhamento ambulatorial"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDischarge} disabled={discharge.isPending}>
            {discharge.isPending ? "Registrando…" : "Confirmar alta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
