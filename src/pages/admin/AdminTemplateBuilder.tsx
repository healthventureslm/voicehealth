// Página de criação de template via IA (importar documento ou conversar).
// Substituiu o TemplateWizardDialog modal — agora é página dedicada pra
// dar espaço pro preview ao vivo + chat (futuro).
//
// Fluxo (state machine):
//   choice → (import|chat) → review → salva → /admin/templates

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { BuilderModeChoice } from "@/components/admin/TemplateBuilder/BuilderModeChoice";
import { ImportDocumentStep } from "@/components/admin/TemplateBuilder/ImportDocumentStep";
import { TemplateReviewStep } from "@/components/admin/TemplateBuilder/TemplateReviewStep";
import type { TemplateSchema } from "@/templates/types";

type Step = "choice" | "import" | "chat" | "review";

export default function AdminTemplateBuilder() {
  const [step, setStep] = useState<Step>("choice");
  const [draftSchema, setDraftSchema] = useState<TemplateSchema | null>(null);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          back
          backTo="/admin/templates"
          title="Novo template"
          subtitle="Crie um template estruturado com ajuda da IA. Você revisa antes de salvar."
        />

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
          <div className="max-w-2xl mx-auto py-8 text-center text-muted-foreground">
            <p>Modo "Conversar com IA" em construção.</p>
          </div>
        )}

        {step === "review" && draftSchema && (
          <TemplateReviewStep
            initialSchema={draftSchema}
            onBack={() => setStep("choice")}
          />
        )}
      </PageContainer>
    </AppLayout>
  );
}
