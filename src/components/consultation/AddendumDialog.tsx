import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateAddendum } from "@/hooks/queries";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Props {
  consultationId: string;
}

export function AddendumDialog({ consultationId }: Props) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const { roles } = useAuth();
  const createAddendum = useCreateAddendum();

  const role = roles[0]?.role ?? "doctor";

  async function handleSubmit() {
    if (!content.trim()) {
      toast.error("Escreva o conteúdo do adendo");
      return;
    }
    try {
      await createAddendum.mutateAsync({
        consultationId,
        content: content.trim(),
        authorRole: role,
      });
      toast.success("Adendo registrado");
      setContent("");
      setOpen(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar observação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova observação (adendo)</DialogTitle>
          <DialogDescription>
            Adendos são append-only — ficam permanentemente registrados com seu nome,
            papel e timestamp. Não podem ser editados depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="addendum">Conteúdo</Label>
          <Textarea
            id="addendum"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ex: paciente apresentou febre 38,2 às 14h, comunicado plantonista..."
            rows={6}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createAddendum.isPending}>
            {createAddendum.isPending ? "Salvando…" : "Salvar adendo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
