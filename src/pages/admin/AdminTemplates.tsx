import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAdminTemplates, useDeleteTemplate,
} from "@/hooks/queries";
import { TemplateWizardDialog } from "@/components/admin/TemplateWizardDialog";
import { GenerateScriptDialog } from "@/components/admin/GenerateScriptDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, FileText, Lock, Globe, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Tables, Enums } from "@/integrations/supabase/types";

const WARD_TYPES: Array<{ value: Enums<"ward_type">; label: string }> = [
  { value: "uti",              label: "UTI" },
  { value: "enfermaria",       label: "Enfermaria" },
  { value: "centro_cirurgico", label: "Centro Cirúrgico" },
  { value: "pronto_socorro",   label: "Pronto-Socorro" },
  { value: "ambulatorio",      label: "Ambulatório" },
];

const ROLES: Array<{ value: Enums<"app_role">; label: string }> = [
  { value: "doctor", label: "Médico(a)" },
  { value: "nurse",  label: "Enfermeiro(a)" },
];

export default function AdminTemplates() {
  const { hospitalIds } = useAuth();
  const hospitalId = hospitalIds[0];
  const navigate = useNavigate();

  const { data: templates, isLoading } = useAdminTemplates(hospitalId);
  const deleteTpl = useDeleteTemplate();

  // Wizard legacy (markdown) — usado só pra EDITAR templates antigos sem schema.
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"report_templates"> | null>(null);

  // Gerador de roteiro a partir do template
  const [scriptDialogTemplate, setScriptDialogTemplate] = useState<Tables<"report_templates"> | null>(null);

  function openNew() {
    // Novo template SEMPRE vai pela nova builder page (escolha + IA).
    navigate("/admin/templates/new");
  }
  function openEdit(t: Tables<"report_templates">) {
    // Templates estruturados (com schema JSON) → vão pro novo builder em
    // modo edição. Templates legados (só prompt markdown) ainda usam o
    // wizard antigo pra back-compat.
    if (t.schema) {
      navigate(`/admin/templates/${t.id}/edit`);
      return;
    }
    setEditing(t);
    setWizardOpen(true);
  }

  async function handleDelete(t: Tables<"report_templates">) {
    try {
      await deleteTpl.mutateAsync(t.id);
      toast.success("Template excluído");
    } catch (e: any) {
      toast.error(`Não foi possível excluir: ${e?.message ?? e}`);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          icon={<FileText className="w-6 h-6" />}
          title="Templates de relatório"
          subtitle="Defina como a IA deve estruturar os relatórios. Importe um documento existente ou crie do zero."
          actions={
            <Button
              onClick={openNew}
              className="gap-2 bg-enf hover:bg-enf-hover text-white shadow-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Novo template
            </Button>
          }
        />

        <TemplateWizardDialog
          open={wizardOpen}
          onOpenChange={(o) => {
            setWizardOpen(o);
            if (!o) setEditing(null);
          }}
          editing={editing}
        />

        {scriptDialogTemplate && (
          <GenerateScriptDialog
            open={!!scriptDialogTemplate}
            onOpenChange={(o) => {
              if (!o) setScriptDialogTemplate(null);
            }}
            template={scriptDialogTemplate}
          />
        )}

        {isLoading ? (
          <EmptyState loading />
        ) : (templates ?? []).length === 0 ? (
          <EmptyState
            title="Nenhum template"
            description="Crie templates próprios do hospital ou aproveite os globais."
          />
        ) : (
          <div className="space-y-3">
            {(templates ?? []).map((t) => {
              const isGlobal = t.hospital_id === null;
              const isMine = t.hospital_id === hospitalId;
              return (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="heading-card flex items-center gap-2">
                          {t.name}
                          {!t.is_active && <Badge variant="secondary">inativo</Badge>}
                        </CardTitle>
                        {t.description && (
                          <CardDescription className="mt-1">{t.description}</CardDescription>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setScriptDialogTemplate(t)}
                              title="Gerar roteiro de teleprompter"
                            >
                              <Sparkles className="w-4 h-4 text-enf" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
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
                                  <AlertDialogTitle>Excluir "{t.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Gravações existentes que usaram este template
                                    continuarão funcionando, mas novas gravações não
                                    poderão escolhê-lo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(t)}>
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
                    <div className="flex flex-wrap gap-1 text-xs">
                      {(t.applicable_ward_types ?? []).map((wt) => (
                        <Badge key={wt} variant="outline">
                          {WARD_TYPES.find((x) => x.value === wt)?.label ?? wt}
                        </Badge>
                      ))}
                      {(t.applicable_roles ?? []).map((r) => (
                        <Badge key={r} variant="secondary">
                          {ROLES.find((x) => x.value === r)?.label ?? r}
                        </Badge>
                      ))}
                      {(t.applicable_ward_types ?? []).length === 0 &&
                        (t.applicable_roles ?? []).length === 0 && (
                          <span className="text-muted-foreground">qualquer setor / qualquer papel</span>
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
