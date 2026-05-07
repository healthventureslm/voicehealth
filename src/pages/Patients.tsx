import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { usePatients, useCreatePatient, useMyWards, useWards } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradientAvatar } from "@/components/GradientAvatar";
import { WardChip } from "@/components/WardChip";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export default function Patients() {
  const navigate = useNavigate();
  const { user, hospitalIds, wardIds, roles, isSuperAdmin } = useAuth();
  const { data: patients, isLoading } = usePatients();
  const { data: myWards } = useMyWards(user?.id);
  const { data: allWards } = useWards();
  const createPatient = useCreatePatient();

  const [search, setSearch] = useState("");
  const [wardFilter, setWardFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    medical_record: "",
    bed: "",
    date_of_birth: "",
    current_ward_id: "",
  });

  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin");

  // Apenas pacientes nos setores ATUAIS do usuário (pra doctor/nurse).
  // Pacientes que ele atendeu antes mas foram transferidos pra fora ficam
  // disponíveis em /gravacoes — esta listagem é "operacional do dia".
  const inMyScope = (patients ?? []).filter((p) => {
    if (isSuperAdmin || isHospitalAdmin) return true;
    return !!p.current_ward_id && wardIds.includes(p.current_ward_id);
  });

  const filtered = inMyScope.filter((p) => {
    const matchesSearch =
      !search ||
      [p.full_name, p.medical_record, p.bed]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(search.toLowerCase()));
    const matchesWard = wardFilter === "all" || p.current_ward_id === wardFilter;
    const matchesStatus = statusFilter === "all" || p.admission_status === statusFilter;
    return matchesSearch && matchesWard && matchesStatus;
  });

  // Wards visíveis pra filtrar (do hospital do usuário)
  const visibleWards = (allWards ?? []).filter((w) =>
    hospitalIds.includes(w.hospital_id),
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
      <PageContainer>
        <PageHeader
          title="Pacientes"
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px] gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, prontuário, leito..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={wardFilter} onValueChange={setWardFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os setores</SelectItem>
              {visibleWards.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="admitted">Internado</SelectItem>
              <SelectItem value="discharged">Alta</SelectItem>
              <SelectItem value="transferred">Transferido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <EmptyState loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            description={search ? "Tente ajustar os filtros." : "Cadastre o primeiro paciente nos seus setores."}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} paciente{filtered.length !== 1 && "s"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-md hover:border-[var(--border-hov)] transition-all"
                onClick={() => navigate(`/patients/${p.id}/history`)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <GradientAvatar name={p.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold truncate">{p.full_name}</div>
                    <div
                      className="text-[12px] mt-1 flex items-center gap-1.5 flex-wrap"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.medical_record && <span>PRT {p.medical_record}</span>}
                      {p.medical_record && p.bed && <span>·</span>}
                      {p.bed && <span>Leito {p.bed}</span>}
                    </div>
                    {p.current_ward?.type && (
                      <div className="mt-2">
                        <WardChip type={p.current_ward.type} label={p.current_ward.name ?? undefined} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
