import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateHospital, useSendInvitation } from "@/hooks/queries";
import { Plus, Copy, Check } from "lucide-react";
import { toast } from "sonner";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateHospitalDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("demo");
  const [adminEmail, setAdminEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createHospital = useCreateHospital();
  const sendInvite = useSendInvitation();

  function reset() {
    setName("");
    setSlug("");
    setPlan("demo");
    setAdminEmail("");
    setGeneratedLink(null);
    setCopied(false);
  }

  function handleClose(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setTimeout(reset, 200);
  }

  function handleNameChange(v: string) {
    setName(v);
    // só auto-preenche o slug se o usuário ainda não digitou nada manualmente
    if (slug === "" || slug === slugify(name)) {
      setSlug(slugify(v));
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Nome do hospital é obrigatório");
      return;
    }
    const finalSlug = slug.trim() || slugify(name);
    if (!/^[a-z0-9-]+$/.test(finalSlug)) {
      toast.error("Slug deve conter só letras minúsculas, números e hífens");
      return;
    }
    if (!adminEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      toast.error("E-mail do admin inicial inválido");
      return;
    }

    try {
      // 1) Cria o hospital
      const hospital = await createHospital.mutateAsync({
        name: name.trim(),
        slug: finalSlug,
        plan,
        is_active: true,
      });

      // 2) Envia convite pra hospital_admin
      const inv = await sendInvite.mutateAsync({
        email: adminEmail.trim().toLowerCase(),
        role: "hospital_admin",
        hospitalId: hospital.id,
        wardIds: [],
      });

      const url = `${window.location.origin}/signup?token=${inv.token}`;
      setGeneratedLink(url);
      toast.success("Hospital criado e convite enviado");
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

  const submitting = createHospital.isPending || sendInvite.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Novo hospital
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {generatedLink ? "Hospital criado" : "Cadastrar novo hospital"}
          </DialogTitle>
          <DialogDescription>
            {generatedLink
              ? "Copie o link abaixo e mande para o futuro admin do hospital."
              : "Cria o hospital + envia convite pro primeiro hospital_admin."}
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <div className="font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">slug: {slug}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Link de convite pra {adminEmail}:
            </div>
            <div className="p-3 bg-muted rounded-md text-xs break-all font-mono">
              {generatedLink}
            </div>
            <Button onClick={handleCopy} className="w-full gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Expira em 7 dias. O admin precisa criar conta com este e-mail
              exatamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Nome do hospital *</Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Hospital São Lucas — Unidade Centro"
              />
            </div>
            <div>
              <Label>Slug (identificador interno)</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="hospital-sao-lucas-centro"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Único no sistema, usado em URLs/integrações futuras.
              </p>
            </div>
            <div>
              <Label>Plano</Label>
              <Input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="demo / starter / pro"
              />
            </div>
            <div>
              <Label>E-mail do admin inicial *</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="diretor@hospital.com.br"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Esta pessoa receberá o link de convite e virará hospital_admin
                ao aceitar.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedLink ? (
            <Button onClick={() => handleClose(false)} className="w-full">
              Concluir
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Criando…" : "Criar hospital + convidar admin"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
