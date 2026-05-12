import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePatients,
  usePatientsDirectory,
  useCreatePatient,
  useMyWards,
  useWards,
} from "@/hooks/queries";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Plus, Search, Lock } from "lucide-react";
import { toast } from "sonner";

// Persiste filtros entre navegações (sidebar, voltar de um paciente, refresh).
// Reset só quando o usuário muda explicitamente.
function usePersistedState<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (stored as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue];
}

export default function Patients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hospitalIds, wardIds, roles, isSuperAdmin } = useAuth();
  const isHospitalAdmin = roles.some((r) => r.role === "hospital_admin");
  const canPickAnyWard = isSuperAdmin || isHospitalAdmin;
  const { data: fullPatients } = usePatients();
  const { data: directory, isLoading } = usePatientsDirectory();
  const { data: myWards } = useMyWards(user?.id);
  const { data: allWards } = useWards();
  const createPatient = useCreatePatient();

  const [search, setSearch] = usePersistedState("patients.filter.search", "");
  // Default: meus setores. "mine" = só onde tenho ward_assignment ativo.
  const [wardFilter, setWardFilter] = usePersistedState<string>("patients.filter.ward", "mine");
  const [statusFilter, setStatusFilter] = usePersistedState<string>("patients.filter.status", "all");
  const [open, setOpen] = useState(false);

  // Quando chega via /patients?new=1 (do hub "Novo atendimento"), abre o dialog
  // automaticamente e remove o param da URL pra não reabrir em refresh.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [form, setForm] = useState({
    full_name: "",
    medical_record: "",
    bed: "",
    date_of_birth: "",
    current_ward_id: "",
  });

  // Indexa os pacientes com dados completos por id, pra mesclar com o diretório.
  const fullById = useMemo(() => {
    const m = new Map<string, NonNullable<typeof fullPatients>[number]>();
    for (const p of fullPatients ?? []) m.set(p.id, p);
    return m;
  }, [fullPatients]);

  const wardIdSet = useMemo(() => new Set(wardIds), [wardIds]);

  // Aplica filtros sobre o diretório (lista completa do hospital).
  const filtered = useMemo(() => {
    return (directory ?? []).filter((p) => {
      const inMyWards = !!p.current_ward_id && wardIdSet.has(p.current_ward_id);
      if (wardFilter === "mine" && !inMyWards) return false;
      if (wardFilter !== "mine" && wardFilter !== "all" && p.current_ward_id !== wardFilter) {
        return false;
      }
      if (statusFilter !== "all" && p.admission_status !== statusFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const full = fullById.get(p.id);
        const matches =
          p.full_name.toLowerCase().includes(needle)
          || (full?.medical_record?.toLowerCase().includes(needle) ?? false)
          || (full?.bed?.toLowerCase().includes(needle) ?? false);
        if (!matches) return false;
      }
      return true;
    });
  }, [directory, wardFilter, statusFilter, search, wardIdSet, fullById]);

  // Setores visíveis no filtro: só os do(s) hospital(is) do usuário.
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
                      {(canPickAnyWard ? visibleWards : (myWards ?? [])).map((w: any) => (
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
              <SelectItem value="mine">Meus setores</SelectItem>
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
            title={search ? "Nenhum paciente encontrado" : "Nenhum paciente nesta visualização"}
            description={
              search
                ? "Tente ajustar os filtros."
                : wardFilter === "mine"
                  ? 'Não há pacientes nos seus setores. Mude o filtro para "Todos os setores" pra ver os outros.'
                  : "Cadastre o primeiro paciente."
            }
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} paciente{filtered.length !== 1 && "s"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((p) => {
                const full = fullById.get(p.id);
                const inMyWards = !!p.current_ward_id && wardIdSet.has(p.current_ward_id);
                const hasClinicalAccess = !!full || inMyWards;

                if (!hasClinicalAccess) {
                  return (
                    <Tooltip key={p.id} delayDuration={150}>
                      <TooltipTrigger asChild>
                        <Card
                          className="cursor-not-allowed opacity-70 border-dashed"
                          aria-disabled
                        >
                          <CardContent className="p-4 flex items-start gap-3">
                            <GradientAvatar name={p.full_name} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-semibold truncate flex items-center gap-2">
                                {p.full_name}
                                <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              </div>
                              {p.ward_type && (
                                <div className="mt-2">
                                  <WardChip
                                    type={p.ward_type as any}
                                    label={p.ward_name ?? undefined}
                                  />
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Fora dos seus setores — sem acesso ao prontuário.
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
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
                          {full?.medical_record && <span>PRT {full.medical_record}</span>}
                          {full?.medical_record && full?.bed && <span>·</span>}
                          {full?.bed && <span>Leito {full.bed}</span>}
                        </div>
                        {p.ward_type && (
                          <div className="mt-2">
                            <WardChip
                              type={p.ward_type as any}
                              label={p.ward_name ?? undefined}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
