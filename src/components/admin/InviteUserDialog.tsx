import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useWards, useSendInvitation } from "@/hooks/queries";
import { Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

interface Props {
  hospitalId: string;
}

const ROLES: Array<{ value: Enums<"app_role">; label: string }> = [
  { value: "hospital_admin", label: "Administrador do Hospital" },
  { value: "doctor",         label: "Médico(a)" },
  { value: "nurse",          label: "Enfermeiro(a)" },
  { value: "auditor",        label: "Auditor(a)" },
];

export function InviteUserDialog({ hospitalId }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Enums<"app_role">>("nurse");
  const [selectedWards, setSelectedWards] = useState<Set<string>>(new Set());
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: wards } = useWards();
  const send = useSendInvitation();

  const hospitalWards = (wards ?? []).filter((w) => w.hospital_id === hospitalId);

  function reset() {
    setEmail("");
    setRole("nurse");
    setSelectedWards(new Set());
    setGeneratedLink(null);
    setCopied(false);
  }

  function toggleWard(wardId: string) {
    setSelectedWards((prev) => {
      const next = new Set(prev);
      if (next.has(wardId)) next.delete(wardId);
      else next.add(wardId);
      return next;
    });
  }

  async function handleSend() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Digite um e-mail válido");
      return;
    }
    if (role !== "auditor" && role !== "hospital_admin" && selectedWards.size === 0) {
      toast.error("Selecione ao menos um setor (médicos e enfermeiros precisam de setor)");
      return;
    }
    try {
      const inv = await send.mutateAsync({
        email: email.trim().toLowerCase(),
        role,
        hospitalId,
        wardIds: Array.from(selectedWards),
      });

      const url = `${window.location.origin}/signup?token=${inv.token}`;
      setGeneratedLink(url);
      toast.success("Convite criado");
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  async function handleCopy() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // só reseta depois que fechou (animação)
      setTimeout(reset, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Convidar usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{generatedLink ? "Convite criado" : "Convidar novo usuário"}</DialogTitle>
          <DialogDescription>
            {generatedLink
              ? "Copie o link abaixo e envie pra pessoa por WhatsApp, e-mail ou outro meio."
              : "Crie um convite — uma vez aceito, o usuário entra direto no hospital com role e setores corretos."}
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-md text-xs break-all font-mono">
              {generatedLink}
            </div>
            <Button onClick={handleCopy} className="w-full gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O link expira em <strong>7 dias</strong>. A pessoa precisa criar a conta com o
              e-mail <strong>{email}</strong> exatamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="enfermeira@hospital.com.br"
              />
            </div>
            <div>
              <Label>Papel</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as Enums<"app_role">)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(role === "doctor" || role === "nurse") && (
              <div>
                <Label className="mb-2 block">Setores onde vai atuar *</Label>
                <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto">
                  {hospitalWards.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum setor cadastrado. Crie em /admin/wards primeiro.
                    </p>
                  ) : (
                    hospitalWards.map((w) => (
                      <div key={w.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`ward-${w.id}`}
                          checked={selectedWards.has(w.id)}
                          onCheckedChange={() => toggleWard(w.id)}
                        />
                        <Label htmlFor={`ward-${w.id}`} className="cursor-pointer text-sm font-normal">
                          {w.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pode selecionar múltiplos. Ex: enfermeiro de UTI + Enfermaria.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {generatedLink ? (
            <Button onClick={() => handleClose(false)} className="w-full">
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={send.isPending}>
                {send.isPending ? "Criando…" : "Criar convite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
