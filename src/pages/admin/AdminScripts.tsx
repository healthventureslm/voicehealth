import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAdminScripts, useDeleteScript,
  type AdminScript,
} from "@/hooks/queries";
import { ScriptWizardDialog } from "@/components/admin/ScriptWizardDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WardChip } from "@/components/WardChip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ListChecks, Lock, Globe, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminScripts() {
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];

  const { data: scripts, isLoading } = useAdminScripts(hospitalId);
  const deleteScript = useDeleteScript();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<AdminScript | null>(null);

  function openNew() {
    setEditing(null);
    setWizardOpen(true);
  }
  function openEdit(s: AdminScript) {
    setEditing(s);
    setWizardOpen(true);
  }

  async function handleDelete(s: AdminScript) {
    try {
      await deleteScript.mutateAsync(s.id);
      toast.success("Roteiro excluído");
    } catch (e: any) {
      toast.error(`Não foi possível excluir: ${e?.message ?? e}`);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          icon={<ListChecks className="w-6 h-6" />}
          title="Roteiros"
          subtitle='Pontos que o teleprompter mostra durante a gravação. Cada roteiro pareia com um template de relatório pelo nome — quando o usuário escolhe o template, o roteiro correspondente aparece.'
          actions={
            <Button
              onClick={openNew}
              className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Novo roteiro
            </Button>
          }
        />

        <ScriptWizardDialog
          open={wizardOpen}
          onOpenChange={(o) => {
            setWizardOpen(o);
            if (!o) setEditing(null);
          }}
          editing={editing}
        />

        {isLoading ? (
          <EmptyState loading />
        ) : (scripts ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum roteiro"
            description='Use "Novo roteiro" e gere a partir de um template existente — a IA cria os pontos automaticamente.'
          />
        ) : (
          <div className="space-y-3">
            {(scripts ?? []).map((s) => {
              const isGlobal = s.hospital_id === null;
              const isMine = s.hospital_id === hospitalId;
              const requiredCount = s.fields.filter((f) => f.required).length;
              return (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="heading-card flex items-center gap-2 flex-wrap">
                          {s.name}
                          {!s.is_active && <Badge variant="secondary">inativo</Badge>}
                        </CardTitle>
                        {s.description && (
                          <CardDescription className="mt-1">{s.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isGlobal && (
                          <Badge variant="outline" className="gap-1">
                            <Globe className="w-3 h-3" /> global
                          </Badge>
                        )}
                        {isMine && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={`Editar ${s.name}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Excluir ${s.name}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir "{s.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Gravações em andamento que estão usando este roteiro
                                    continuam funcionando, mas o teleprompter não vai mais
                                    aparecer pra novas gravações com este template.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(s)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {!isMine && !isGlobal && (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 items-center text-xs">
                      <span
                        className="inline-flex items-center gap-1 font-medium"
                        style={{ color: "var(--text-soft)" }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {s.fields.length} {s.fields.length === 1 ? "ponto" : "pontos"}
                        {requiredCount > 0 && (
                          <span style={{ color: "var(--text-muted)" }}>
                            {" "}· {requiredCount} obrigatório{requiredCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                      {s.applicable_ward_types.length === 0 ? (
                        <span style={{ color: "var(--text-muted)" }}>
                          · qualquer setor
                        </span>
                      ) : (
                        <>
                          <span style={{ color: "var(--text-muted)" }}>·</span>
                          <div className="flex flex-wrap gap-1">
                            {s.applicable_ward_types.map((wt) => (
                              <WardChip key={wt} type={wt} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
