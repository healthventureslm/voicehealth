import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, History, Mic, ArrowRightLeft, LogOut as LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Tables as DbTables } from "@/integrations/supabase/types";

type Patient = DbTables<"patients">;
type Ward = DbTables<"wards">;

export default function Patients() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deptFilter = searchParams.get("department");
  const deptName = searchParams.get("department_name");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", initials: "", medical_record: "", bed: "", date_of_birth: "", encounter_number: "", notes: "", current_ward_id: "" });

  // Discharge confirmation
  const [dischargePatient, setDischargePatient] = useState<Patient | null>(null);

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPatient, setTransferPatient] = useState<Patient | null>(null);
  const [transferWardId, setTransferWardId] = useState("");

  const fetchData = async () => {
    let query = supabase.from("patients").select("*").order("full_name");
    if (deptFilter) query = query.eq("department_id", deptFilter);
    const [{ data: pData }, { data: wData }] = await Promise.all([
      query,
      supabase.from("wards").select("*").eq("is_active", true).order("name"),
    ]);
    setPatients(pData || []);
    setWards(wData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.department_id, deptFilter]);

  const wardName = (wardId: string | null) => {
    if (!wardId) return "—";
    return wards.find((w) => w.id === wardId)?.name || "—";
  };

  const handleCreate = async () => {
    if (!form.full_name || !profile?.department_id) return;
    const insertData: any = {
      full_name: form.full_name,
      initials: form.initials,
      medical_record: form.medical_record || null,
      bed: form.bed,
      date_of_birth: form.date_of_birth || null,
      encounter_number: form.encounter_number || null,
      notes: form.notes,
      department_id: profile.department_id,
      created_by: user?.id,
    };
    if (form.current_ward_id) insertData.current_ward_id = form.current_ward_id;

    const { data: newPatient, error } = await supabase.from("patients").insert(insertData).select().single();
    if (error) { toast.error("Erro ao cadastrar paciente"); return; }

    // Create initial ward history
    if (form.current_ward_id && newPatient) {
      await supabase.from("patient_ward_history").insert({
        patient_id: newPatient.id,
        ward_id: form.current_ward_id,
      });
    }

    toast.success("Paciente cadastrado!");
    setDialogOpen(false);
    setForm({ full_name: "", initials: "", medical_record: "", bed: "", date_of_birth: "", encounter_number: "", notes: "", current_ward_id: "" });
    fetchData();
  };

  const handleTransfer = async () => {
    if (!transferPatient || !transferWardId || !user) return;

    // Close old history record
    await supabase.from("patient_ward_history")
      .update({ discharged_at: new Date().toISOString(), discharged_by: user.id, reason: "transferência" })
      .eq("patient_id", transferPatient.id)
      .is("discharged_at", null);

    // Update patient
    await supabase.from("patients")
      .update({ current_ward_id: transferWardId, admission_status: "internado" })
      .eq("id", transferPatient.id);

    // Open new history record
    await supabase.from("patient_ward_history").insert({
      patient_id: transferPatient.id,
      ward_id: transferWardId,
    });

    toast.success("Paciente transferido!");
    setTransferOpen(false);
    setTransferPatient(null);
    setTransferWardId("");
    fetchData();
  };

  const handleDischarge = async (patient: Patient) => {
    if (!user) return;
    await supabase.from("patient_ward_history")
      .update({ discharged_at: new Date().toISOString(), discharged_by: user.id, reason: "alta" })
      .eq("patient_id", patient.id)
      .is("discharged_at", null);

    await supabase.from("patients")
      .update({ admission_status: "alta", current_ward_id: null })
      .eq("id", patient.id);

    toast.success("Alta registrada!");
    fetchData();
  };

  const statusBadge = (status: string) => {
    if (status === "alta") return <Badge variant="secondary">Alta</Badge>;
    if (status === "transferido") return <Badge variant="outline">Transferido</Badge>;
    return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300">Internado</Badge>;
  };

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.medical_record?.toLowerCase().includes(search.toLowerCase()) ||
    p.bed?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {deptName ? `Pacientes — ${deptName}` : "Pacientes"}
            </h1>
            <p className="text-muted-foreground">
              {deptName ? (
                <span>
                  Pacientes alocados no setor {deptName}.{" "}
                  <button className="underline text-primary" onClick={() => setSearchParams({})}>Ver todos</button>
                </span>
              ) : "Gerencie os pacientes do seu departamento"}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Paciente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Paciente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome Completo *</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "") })}
                    placeholder="Somente letras"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Iniciais</Label><Input value={form.initials} onChange={(e) => setForm({ ...form, initials: e.target.value.replace(/[^a-zA-ZÀ-ÿ]/g, "") })} placeholder="Ex: MAS" /></div>
                  <div>
                    <Label>Prontuário</Label>
                    <Input
                      value={form.medical_record}
                      onChange={(e) => setForm({ ...form, medical_record: e.target.value.replace(/\D/g, "") })}
                      placeholder="Somente números"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nº Atendimento</Label>
                    <Input
                      value={form.encounter_number}
                      onChange={(e) => setForm({ ...form, encounter_number: e.target.value.replace(/\D/g, "") })}
                      placeholder="Somente números"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Leito</Label><Input value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} placeholder="Ex: UTI-05" /></div>
                  <div>
                    <Label>Setor</Label>
                    <Select value={form.current_ward_id} onValueChange={(v) => setForm({ ...form, current_ward_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleCreate} className="w-full">Cadastrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, prontuário ou leito..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{loading ? "Carregando..." : "Nenhum paciente encontrado"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Prontuário</TableHead>
                    <TableHead>Leito</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" role="link" tabIndex={0} onClick={() => navigate(`/patients/${p.id}/history`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/patients/${p.id}/history`); } }}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>{p.medical_record || "—"}</TableCell>
                      <TableCell>{p.bed || "—"}</TableCell>
                      <TableCell>{wardName((p as any).current_ward_id)}</TableCell>
                      <TableCell>{statusBadge((p as any).admission_status || "internado")}</TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider delayDuration={300}>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="default" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/consultations/new?patient=${p.id}`); }}>
                                  <Mic className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Gravar atendimento</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => {
                                  e.stopPropagation();
                                  setTransferPatient(p);
                                  setTransferWardId("");
                                  setTransferOpen(true);
                                }}>
                                  <ArrowRightLeft className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Transferir setor</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDischargePatient(p); }}>
                                  <LogOutIcon className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Dar alta</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/patients/${p.id}/history`); }}>
                                  <History className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Histórico</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transfer Dialog */}
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Transferir Paciente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Transferindo: <strong>{transferPatient?.full_name}</strong></p>
              <div>
                <Label>Novo Setor *</Label>
                <Select value={transferWardId} onValueChange={setTransferWardId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleTransfer} disabled={!transferWardId} className="w-full">Confirmar Transferência</Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Discharge Confirmation */}
        <AlertDialog open={!!dischargePatient} onOpenChange={(open) => { if (!open) setDischargePatient(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Alta</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja dar alta ao paciente <strong>{dischargePatient?.full_name}</strong>? Esta acao nao pode ser desfeita facilmente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (dischargePatient) { handleDischarge(dischargePatient); setDischargePatient(null); } }}>
                Confirmar Alta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
