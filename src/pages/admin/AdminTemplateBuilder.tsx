// Página de criar/editar template estruturado via IA.
// Rotas:
//   /admin/templates/new        → modo CRIAR (state machine começa em "choice")
//   /admin/templates/:id/edit   → modo EDITAR (carrega template, vai direto em "review")
//
// Fluxo (state machine):
//   choice → (import|chat) → review → salva → /admin/templates
//   (edit) → review → salva → /admin/templates

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { BuilderModeChoice } from "@/components/admin/TemplateBuilder/BuilderModeChoice";
import { ImportDocumentStep } from "@/components/admin/TemplateBuilder/ImportDocumentStep";
import { ChatBuilderStep } from "@/components/admin/TemplateBuilder/ChatBuilderStep";
import { TemplateReviewStep } from "@/components/admin/TemplateBuilder/TemplateReviewStep";
import { supabase } from "@/integrations/supabase/client";
import type { TemplateSchema } from "@/templates/types";

type Step = "choice" | "import" | "chat" | "review" | "loading-edit";

export default function AdminTemplateBuilder() {
  const { id: editingId } = useParams<{ id?: string }>();
  const isEditMode = !!editingId;

  const [step, setStep] = useState<Step>(isEditMode ? "loading-edit" : "choice");
  const [draftSchema, setDraftSchema] = useState<TemplateSchema | null>(null);

  // Em edit mode, busca o template e vai direto pra review.
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["edit_template", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("id", editingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing?.schema) {
      setDraftSchema(existing.schema as TemplateSchema);
      setStep("review");
    }
  }, [existing]);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          back
          backTo="/admin/templates"
          title={isEditMode ? "Editar template" : "Novo template"}
          subtitle={
            isEditMode
              ? "Ajuste os campos abaixo. As mudanças geram uma nova versão."
              : "Crie um template estruturado com ajuda da IA. Você revisa antes de salvar."
          }
        />

        {step === "loading-edit" && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {loadingExisting ? "Carregando template..." : "Template não encontrado."}
          </div>
        )}

        {step === "choice" && (
          <BuilderModeChoice
            onPick={(mode) => {
              if (mode === "import") setStep("import");
              else if (mode === "chat") setStep("chat");
            }}
          />
        )}

        {step === "import" && (
          <ImportDocumentStep
            onBack={() => setStep("choice")}
            onExtracted={(schema) => {
              setDraftSchema(schema);
              setStep("review");
            }}
          />
        )}

        {step === "chat" && (
          <ChatBuilderStep
            onBack={() => setStep("choice")}
            onProceed={(schema) => {
              setDraftSchema(schema);
              setStep("review");
            }}
          />
        )}

        {step === "review" && draftSchema && (
          <TemplateReviewStep
            initialSchema={draftSchema}
            editingTemplateId={isEditMode ? editingId : undefined}
            existingTemplate={existing}
            onBack={() => {
              if (isEditMode) {
                // Em edit, voltar volta pra lista (não tem etapa anterior)
                history.back();
              } else {
                setStep("choice");
              }
            }}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}
