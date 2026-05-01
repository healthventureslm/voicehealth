import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePatients, useCreatePatient, useMyWards } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function Patients() {
  const navigate = useNavigate();
  const { user, hospitalIds } = useAuth();
  const { data: patients, isLoading } = usePatients();
  const { data: myWards } = useMyWards(user?.id);
  const createPatient = useCreatePatient();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    medical_record: "",
    bed: "",
    date_of_birth: "",
    current_ward_id: "",
  });

  const filtered = (patients ?? []).filter((p) =>
    [p.full_name, p.medical_record, p.bed]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  async function handleCreate() {
    if (!form.full_name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (!form.current_ward_id) {
      toast.error("Selecione um setor");
      return;
    }
    if (!hospitalIds[0]) {
      toast.error("Você não está vinculado a nenhum hospital");
      return;
    }
    try {
      await createPatient.mutateAsync({
        hospital_id: hospitalIds[0],
        full_name: form.full_name.trim(),
        medical_record: form.medical_record.trim() || null,
        bed: form.bed.trim() || null,
        date_of_birth: form.date_of_birth || null,
        current_ward_id: form.current_ward_id,
        created_by: user?.id ?? null,
      });
      toast.success("Paciente cadastrado");
      setOpen(false);
      setForm({ full_name: "", medical_record: "", bed: "", date_of_birth: "", current_ward_id: "" });
    } catch (e: any) {
      toast.error(`Erro ao criar paciente: ${e?.message ?? e}`);
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Pacientes</h1>
            <p className="text-sm text-muted-foreground">
              Pacientes nos seus setores ({(myWards ?? []).length} setor{(myWards ?? []).length !== 1 ? "es" : ""}).
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Novo paciente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar paciente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome completo *</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prontuário</Label>
                    <Input
                      value={form.medical_record}
                      onChange={(e) => setForm((p) => ({ ...p, medical_record: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Leito</Label>
                    <Input
                      value={form.bed}
                      onChange={(e) => setForm((p) => ({ ...p, bed: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Setor *</Label>
                  <Select
                    value={form.current_ward_id}
                    onValueChange={(v) => setForm((p) => ({ ...p, current_ward_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(myWards ?? []).map((w: any) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={createPatient.isPending}>
                  {createPatient.isPending ? "Salvando…" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, prontuário, leito..."
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
              {search ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado nos seus setores."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/patients/${p.id}/history`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCircle2 className="w-5 h-5 text-primary" />
                    {p.full_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {p.medical_record && <div>Prontuário: {p.medical_record}</div>}
                  {p.bed && <div>Leito: {p.bed}</div>}
                  {p.current_ward && (
                    <Badge variant="outline" className="mt-2">
                      {p.current_ward.name}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
