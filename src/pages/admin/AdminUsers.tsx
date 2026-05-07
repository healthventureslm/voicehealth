import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHospitalUsers, useWards, useInvitations, useRevokeInvitation,
  useRemoveUserFromHospital,
} from "@/hooks/queries";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { EditUserDialog } from "@/components/admin/EditUserDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, UserMinus, ShieldAlert, Mail, Copy, Check, Search } from "lucide-react";
import { toast } from "sonner";
import type { HospitalUserRow } from "@/hooks/queries";
import { GradientAvatar } from "@/components/GradientAvatar";
import { WardChip } from "@/components/WardChip";

const ROLE_LABEL: Record<string, string> = {
  super_admin:    "Super Admin",
  hospital_admin: "Admin do Hospital",
  doctor:         "Médico(a)",
  nurse:          "Enfermeiro(a)",
  auditor:        "Auditor(a)",
};

export default function AdminUsers() {
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];

  const { data: users, isLoading } = useHospitalUsers(hospitalId);
  const { data: wards } = useWards();
  const { data: invitations } = useInvitations(hospitalId);
  const revoke = useRevokeInvitation();
  const removeUser = useRemoveUserFromHospital();

  const [editing, setEditing] = useState<HospitalUserRow | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const wardName = (id: string) => (wards ?? []).find((w) => w.id === id)?.name ?? id.slice(0, 6);
  const wardLookup = (id: string) => (wards ?? []).find((w) => w.id === id);

  // Filtra equipe por nome / role
  const filteredUsers = (users ?? []).filter((u) => {
    if (!search) return true;
    const haystack = [
      u.full_name,
      u.professional_role,
      ...u.roles.map((r) => ROLE_LABEL[r] ?? r),
      ...u.ward_ids.map((id) => wardName(id)),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/signup?token=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Link copiado");
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleRemove(user: HospitalUserRow) {
    if (!hospitalId) return;
    try {
      await removeUser.mutateAsync({ userId: user.user_id, hospitalId });
      toast.success(`${user.full_name ?? "Usuário"} removido do hospital`);
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  if (!hospitalId) {
    return (
      <AppLayout>
        <PageContainer width="narrow">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto" />
              <p>Você não está vinculado a nenhum hospital.</p>
            </CardContent>
          </Card>
        </PageContainer>
      </AppLayout>
    );
  }

  const pendingInvitations = (invitations ?? []).filter((i) => i.status === "pending");

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Usuários do hospital"
          subtitle="Convide profissionais e gerencie os papéis e setores onde atuam."
          actions={<InviteUserDialog hospitalId={hospitalId} />}
        />

        {/* Convites pendentes */}
        {pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="heading-card flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Convites pendentes ({pendingInvitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 p-3 border rounded-md"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <Badge variant="outline">{ROLE_LABEL[inv.role] ?? inv.role}</Badge>
                      {inv.ward_ids.length > 0 && (
                        <span>{inv.ward_ids.map((id) => wardName(id)).join(", ")}</span>
                      )}
                      <span>· expira {new Date(inv.expires_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInviteLink(inv.token)}
                      className="gap-1"
                    >
                      {copiedToken === inv.token ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Link
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Revogar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O link enviado pra <strong>{inv.email}</strong> deixará de funcionar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revoke.mutateAsync(inv.id)}>
                            Revogar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lista de usuários ativos */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <CardTitle className="heading-card">Equipe ativa</CardTitle>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                className="pl-10 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-6">Carregando…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                {search
                  ? "Nenhum usuário corresponde à busca."
                  : 'Nenhum usuário ativo. Use "Convidar usuário" pra começar.'}
              </p>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-[var(--bg-card-hov)] hover:border-[var(--border-hov)] transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <GradientAvatar name={u.full_name ?? ""} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[14px] truncate">{u.full_name ?? "—"}</div>
                      <div
                        className="text-[12px] flex items-center gap-1.5 mt-1 flex-wrap"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {u.roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center px-2 py-[2px] rounded-md text-[11px] font-semibold"
                            style={{
                              background: "var(--bg-card-hov)",
                              color: "var(--text-soft)",
                            }}
                          >
                            {ROLE_LABEL[r] ?? r}
                          </span>
                        ))}
                        {u.ward_ids.map((id) => {
                          const w = wardLookup(id);
                          return w ? (
                            <WardChip key={id} type={w.ward_type} label={w.name} />
                          ) : (
                            <span key={id} className="text-[11px]">{wardName(id)}</span>
                          );
                        })}
                        {u.ward_ids.length === 0 && (u.roles.includes("doctor") || u.roles.includes("nurse")) && (
                          <span className="text-[11px]" style={{ color: "var(--ps-text)" }}>⚠ sem setor</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover do hospital?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <strong>{u.full_name ?? u.user_id.slice(0, 8)}</strong> perderá
                            acesso ao hospital. As consultas que ele criou continuam preservadas.
                            A conta no sistema (login) <strong>não</strong> é apagada — só o
                            vínculo com este hospital.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemove(u)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <EditUserDialog
          user={editing}
          hospitalId={hospitalId}
          onClose={() => setEditing(null)}
        />
      </PageContainer>
    </AppLayout>
  );
}
