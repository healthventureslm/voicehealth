import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useWards, useCreateWard, useUpdateWard, useDeleteWard,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables, Enums } from "@/integrations/supabase/types";

const WARD_TYPES: Array<{ value: Enums<"ward_type">; label: string }> = [
  { value: "uti",              label: "UTI" },
  { value: "enfermaria",       label: "Enfermaria" },
  { value: "centro_cirurgico", label: "Centro Cirúrgico" },
  { value: "pronto_socorro",   label: "Pronto-Socorro" },
  { value: "ambulatorio",      label: "Ambulatório" },
];

export default function AdminWards() {
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];
  const { data: wards, isLoading } = useWards();
  const createWard = useCreateWard();
  const updateWard = useUpdateWard();
  const deleteWard = useDeleteWard();

  const myWards = (wards ?? []).filter((w) => w.hospital_id === hospitalId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"wards"> | null>(null);
  const [form, setForm] = useState<{
    name: string;
    ward_type: Enums<"ward_type">;
    bed_count: number;
    is_active: boolean;
  }>({
    name: "",
    ward_type: "enfermaria",
    bed_count: 0,
    is_active: true,
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", ward_type: "enfermaria", bed_count: 0, is_active: true });
    setOpen(true);
  }
  function openEdit(w: Tables<"wards">) {
    setEditing(w);
    setForm({
      name: w.name,
      ward_type: w.ward_type,
      bed_count: w.bed_count,
      is_active: w.is_active,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    try {
      if (editing) {
        await updateWard.mutateAsync({
          id: editing.id,
          patch: {
            name: form.name.trim(),
            ward_type: form.ward_type,
            bed_count: form.bed_count,
            is_active: form.is_active,
          },
        });
        toast.success("Setor atualizado");
      } else {
        if (!hospitalId) {
          toast.error("Você não está vinculado a um hospital");
          return;
        }
        await createWard.mutateAsync({
          hospital_id: hospitalId,
          name: form.name.trim(),
          ward_type: form.ward_type,
          bed_count: form.bed_count,
          is_active: form.is_active,
        });
        toast.success("Setor criado");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  async function handleDelete(w: Tables<"wards">) {
    try {
      await deleteWard.mutateAsync(w.id);
      toast.success(`"${w.name}" excluído`);
    } catch (e: any) {
      toast.error(
        `Não foi possível excluir: ${e?.message ?? e}. Talvez existam pacientes ou consultas vinculados.`,
      );
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="heading-page flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Setores do hospital
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crie e gerencie os setores onde os profissionais atuam.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gap-2">
                <Plus className="w-4 h-4" /> Novo setor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar setor" : "Novo setor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: UTI Adulto"
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={form.ward_type}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, ward_type: v as Enums<"ward_type"> }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WARD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nº de leitos</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.bed_count}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, bed_count: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_active: e.target.checked }))
                    }
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Ativo
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={createWard.isPending || updateWard.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando…</p>
        ) : myWards.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              Nenhum setor cadastrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myWards.map((w) => {
              const typeLabel = WARD_TYPES.find((t) => t.value === w.ward_type)?.label ?? w.ward_type;
              return (
                <Card key={w.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Badge variant="outline">{typeLabel}</Badge>
                        <span>{w.bed_count} leitos</span>
                        {!w.is_active && <Badge variant="secondary">inativo</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(w as any)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{w.name}" será apagado. Pacientes e consultas vinculados
                              continuarão existindo (referência ficará em branco).
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(w as any)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
