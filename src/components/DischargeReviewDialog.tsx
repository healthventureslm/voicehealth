import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useDischargePatient,
  useMarkPatientReviewed,
  type PendingDischargeReview,
} from "@/hooks/queries";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  patient: PendingDischargeReview;
  trigger: React.ReactNode;
}

export function DischargeReviewDialog({ patient, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Após 48h sem nova gravação");
  const { user } = useAuth();
  const discharge = useDischargePatient();
  const mark = useMarkPatientReviewed();

  const hours = Math.floor(patient.hours_since);

  async function handleDischarge() {
    try {
      await discharge.mutateAsync({
        patientId: patient.id,
        reason: reason.trim() || undefined,
        userId: user?.id,
      });
      toast.success("Paciente recebeu alta");
      setOpen(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  async function handleKeep() {
    try {
      await mark.mutateAsync(patient.id);
      toast.success("Mantido internado — alerta adiado em 48h");
      setOpen(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Revisão de alta
          </DialogTitle>
          <DialogDescription>
            <strong>{patient.full_name}</strong> está sem gravação há cerca de{" "}
            <strong className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {hours}h
            </strong>
            . Pode dar alta agora ou manter internado por mais 48h.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label>Motivo da alta (caso confirme)</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={handleKeep}
            disabled={mark.isPending || discharge.isPending}
          >
            {mark.isPending ? "Adiando…" : "Manter internado"}
          </Button>
          <Button
            onClick={handleDischarge}
            disabled={discharge.isPending || mark.isPending}
          >
            {discharge.isPending ? "Registrando…" : "Confirmar alta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
