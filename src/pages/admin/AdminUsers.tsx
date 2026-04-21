import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Send, Trash2, RefreshCw, Shield, Plus } from "lucide-react";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Department = Tables<"departments">;
type AppRole = Enums<"app_role">;

const roleLabels: Record<string, string> = {
  admin: "Administrador", medico: "Médico", enfermeiro: "Enfermeiro", tecnico: "Técnico", farmaceutico: "Farmacêutico",
  auditor: "Auditor", fisioterapeuta: "Fisioterapeuta", nutricionista: "Nutricionista", fonoaudiologo: "Fonoaudiólogo",
  psicologo: "Psicólogo", assistente_social: "Assistente Social",
};

const allRoles: AppRole[] = ["admin", "medico", "enfermeiro", "tecnico", "farmaceutico", "auditor", "fisioterapeuta", "nutricionista", "fonoaudiologo", "psicologo", "assistente_social"];

const statusLabels: Record<string, string> = { pending: "Pendente", accepted: "Aceito", expired: "Expirado" };
const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "outline", accepted: "default", expired: "destructive" };

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<(Profile & { roles: AppRole[] })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [whitelist, setWhitelist] = useState<{ id: string; email: string; created_at: string }[]>([]);

  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<AppRole | "">("");
  const [invDept, setInvDept] = useState("");
  const [invLoading, setInvLoading] = useState(false);

  const [wlEmail, setWlEmail] = useState("");
  const [wlLoading, setWlLoading] = useState(false);

  const fetchAll = async () => {
    const [profilesRes, rolesRes, deptsRes, invRes, wlRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("*"),
      supabase.from("departments").select("*").order("name"),
      supabase.from("invitations").select("*, department:departments(name)").order("created_at", { ascending: false }),
      supabase.from("admin_whitelist").select("*").order("created_at", { ascending: false }),
    ]);
    const roles = rolesRes.data || [];
    setProfiles(
      (profilesRes.data || []).map((p) => ({
        ...p,
        roles: roles.filter((r) => r.user_id === p.user_id).map((r) => r.role),
      }))
    );
    setDepartments(deptsRes.data || []);
    setInvitations(invRes.data || []);
    setWhitelist(wlRes.data || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const sendInvitation = async () => {
    if (!invEmail.trim() || !invRole) { toast.error("Preencha e-mail e role"); return; }
    setInvLoading(true);
    try {
      const res = await supabase.functions.invoke("send-invitation", {
        body: { email: invEmail.trim(), role: invRole, department_id: invDept || null },
      });
      if (res.error) { toast.error(res.error.message || "Erro ao enviar convite"); }
      else { toast.success("Convite criado com sucesso!"); setInvEmail(""); setInvRole(""); setInvDept(""); fetchAll(); }
    } catch { toast.error("Erro ao enviar convite"); }
    finally { setInvLoading(false); }
  };

  const copyInviteLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/signup?token=${token}`);
    toast.success("Link copiado!");
  };

  const revokeInvitation = async (id: string) => {
    await supabase.from("invitations").update({ status: "expired" }).eq("id", id);
    toast.success("Convite revogado"); fetchAll();
  };

  const assignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) { error.code === "23505" ? toast.info("Usuário já tem esta role") : toast.error("Erro ao atribuir role"); return; }
    toast.success("Role atribuída!"); fetchAll();
  };

  const removeRole = async (userId: string, role: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    toast.success("Role removida"); fetchAll();
  };

  const changeDepartment = async (userId: string, deptId: string) => {
    await supabase.from("profiles").update({ department_id: deptId }).eq("user_id", userId);
    toast.success("Departamento atualizado!"); fetchAll();
  };

  const addToWhitelist = async () => {
    if (!wlEmail.trim()) { toast.error("Digite um e-mail"); return; }
    setWlLoading(true);
    try {
      const { error } = await supabase.from("admin_whitelist").insert({ email: wlEmail.trim().toLowerCase() });
      if (error) {
        error.code === "23505" ? toast.info("E-mail já está na lista") : toast.error("Erro ao adicionar");
      } else {
        toast.success("E-mail adicionado à whitelist!"); setWlEmail(""); fetchAll();
      }
    } catch { toast.error("Erro ao adicionar"); }
    finally { setWlLoading(false); }
  };

  const removeFromWhitelist = async (id: string) => {
    await supabase.from("admin_whitelist").delete().eq("id", id);
    toast.success("E-mail removido da whitelist"); fetchAll();
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">Envie convites, gerencie roles e acesso direto de administradores</p>
        </div>

        {/* Admin Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Acesso Direto de Administradores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              E-mails nesta lista podem se cadastrar sem convite e recebem automaticamente a role de Administrador.
            </p>
            <div className="flex gap-2">
              <Input type="email" placeholder="admin@email.com" value={wlEmail} onChange={(e) => setWlEmail(e.target.value)} className="max-w-sm" />
              <Button onClick={addToWhitelist} disabled={wlLoading}>
                {wlLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Adicionar
              </Button>
            </div>
            {whitelist.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {whitelist.map((w) => (
                  <Badge key={w.id} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeFromWhitelist(w.id)}>
                    {w.email} ✕
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invitation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5" />
              Enviar Convite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="inv-email" className="sr-only">E-mail</Label>
                <Input id="inv-email" type="email" placeholder="email@exemplo.com" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
              </div>
              <div className="w-full sm:w-44">
                <Select value={invRole} onValueChange={(v) => setInvRole(v as AppRole)}>
                  <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                  <SelectContent>{allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Select value={invDept} onValueChange={setInvDept}>
                  <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={sendInvitation} disabled={invLoading} className="whitespace-nowrap">
                {invLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Convites</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead><TableHead>Role</TableHead><TableHead>Departamento</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="secondary">{roleLabels[inv.role] || inv.role}</Badge></TableCell>
                      <TableCell>{(inv.department as any)?.name || "—"}</TableCell>
                      <TableCell><Badge variant={statusVariants[inv.status] || "outline"}>{statusLabels[inv.status] || inv.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {inv.status === "pending" && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => copyInviteLink(inv.token)} title="Copiar link"><Copy className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => revokeInvitation(inv.id)} title="Revogar"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Existing Users */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Usuários Cadastrados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Departamento</TableHead><TableHead>Roles</TableHead><TableHead>Adicionar Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name || "Sem nome"}</TableCell>
                    <TableCell>
                      <Select value={p.department_id || ""} onValueChange={(v) => changeDepartment(p.user_id, v)}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeRole(p.user_id, r)}>
                            {roleLabels[r] || r} ✕
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select onValueChange={(v) => assignRole(p.user_id, v as AppRole)}>
                        <SelectTrigger className="w-36"><SelectValue placeholder="+ Role" /></SelectTrigger>
                        <SelectContent>{allRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
