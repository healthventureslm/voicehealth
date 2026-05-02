import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { useHospitals, useUpdateHospital } from "@/hooks/queries";
import { CreateHospitalDialog } from "@/components/superadmin/CreateHospitalDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Pencil, Power, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export default function SuperAdminHospitals() {
  const navigate = useNavigate();
  const { data: hospitals, isLoading } = useHospitals();
  const update = useUpdateHospital();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Tables<"hospitals"> | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", plan: "demo" });

  const filtered = (hospitals ?? []).filter((h) =>
    [h.name, h.slug, h.plan].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  function openEdit(h: Tables<"hospitals">) {
    setEditing(h);
    setForm({ name: h.name, slug: h.slug, plan: h.plan });
  }

  async function handleSave() {
    if (!editing) return;
    try {
      await update.mutateAsync({
        id: editing.id,
        patch: {
          name: form.name.trim(),
          slug: form.slug.trim(),
          plan: form.plan.trim(),
        },
      });
      toast.success("Hospital atualizado");
      setEditing(null);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  async function toggleActive(h: Tables<"hospitals">) {
    try {
      await update.mutateAsync({
        id: h.id,
        patch: { is_active: !h.is_active },
      });
      toast.success(`Hospital ${h.is_active ? "desativado" : "ativado"}`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  return (
    <SuperAdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="heading-page flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Hospitais
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cada hospital é um tenant isolado. Cadastre + convide o primeiro
              admin do hospital pra ele se virar dali.
            </p>
          </div>
          <CreateHospitalDialog />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, slug ou plano..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando…</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              {search ? "Nenhum hospital encontrado" : "Nenhum hospital cadastrado"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((h) => (
              <Card
                key={h.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/superadmin/hospitals/${h.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {h.name}
                      {!h.is_active && <Badge variant="secondary">inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">slug: {h.slug}</Badge>
                      <Badge variant="outline">plano: {h.plan}</Badge>
                      <span>criado {new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(h)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(h)}
                      className={h.is_active ? "text-yellow-600" : "text-green-600"}
                      title={h.is_active ? "Desativar" : "Ativar"}
                    >
                      <Power className="w-4 h-4" />
                    </Button>
                    <ArrowRight className="w-4 h-4 text-muted-foreground ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar hospital</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: e.target.value.toLowerCase() }))
                  }
                />
              </div>
              <div>
                <Label>Plano</Label>
                <Input
                  value={form.plan}
                  onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={update.isPending}>
                {update.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminLayout>
  );
}
