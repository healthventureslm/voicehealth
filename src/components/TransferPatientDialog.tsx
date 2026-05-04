import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWards, useTransferPatient } from "@/hooks/queries";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  patientId: string;
  patientName: string;
  currentWardId: string | null;
  hospitalId: string;
}

export function TransferPatientDialog({
  patientId, patientName, currentWardId, hospitalId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [targetWard, setTargetWard] = useState<string>("");
  const [reason, setReason] = useState("");
  const { data: wards } = useWards();
  const transfer = useTransferPatient();

  const eligibleWards = (wards ?? []).filter(
    (w) => w.hospital_id === hospitalId && w.id !== currentWardId,
  );

  async function handleTransfer() {
    if (!targetWard) {
      toast.error("Selecione o setor de destino");
      return;
    }
    try {
      await transfer.mutateAsync({
        patientId,
        newWardId: targetWard,
        reason: reason.trim() || undefined,
      });
      toast.success("Paciente transferido");
      setOpen(false);
      setTargetWard("");
      setReason("");
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ArrowRightLeft className="w-4 h-4" /> Transferir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir paciente</DialogTitle>
          <DialogDescription>
            <strong>{patientName}</strong> será movido para outro setor.
            Consultas anteriores ficarão <strong>bloqueadas para edição</strong>;
            os autores ainda poderão adicionar adendos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Novo setor *</Label>
            <Select value={targetWard} onValueChange={setTargetWard}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o destino" />
              </SelectTrigger>
              <SelectContent>
                {eligibleWards.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleWards.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nenhum setor de destino disponível.
              </p>
            )}
          </div>

          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: alta da UTI para enfermaria, paciente estável"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={transfer.isPending}>
            {transfer.isPending ? "Transferindo…" : "Confirmar transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
