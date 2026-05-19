// Tela de escolha do modo de criação do template. Duas opções com card
// grande pra cada — chefe vai ver "IA em ação" claramente.

import { FileText, MessageCircle, Upload } from "lucide-react";

interface BuilderModeChoiceProps {
  onPick: (mode: "import" | "chat") => void;
}

export function BuilderModeChoice({ onPick }: BuilderModeChoiceProps) {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Como você quer criar este template?</h2>
        <p className="text-sm text-muted-foreground">
          A IA vai te ajudar nos dois caminhos. Você revisa e ajusta antes de salvar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChoiceCard
          icon={<Upload className="w-8 h-8" />}
          title="Importar documento ou tirar foto"
          subtitle="Tem o formulário em papel ou PDF?"
          description="Sobe a foto ou PDF — a IA extrai seções, campos, checkboxes e escalas automaticamente. Você revisa e ajusta os detalhes antes de salvar."
          highlight="Recomendado quando você já tem o documento"
          onClick={() => onPick("import")}
        />
        <ChoiceCard
          icon={<MessageCircle className="w-8 h-8" />}
          title="Conversar com IA"
          subtitle="Descreve, anexa, refina"
          description="Diga em texto livre o que quer ou anexe documento de referência. A IA monta o schema iterativamente — você refina por turnos de conversa com preview ao vivo."
          highlight="Bom pra criar do zero ou misturar com documento"
          onClick={() => onPick("chat")}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  subtitle,
  description,
  highlight,
  onClick,
  disabled,
  disabledReason,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  highlight: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group text-left p-6 rounded-xl border-2 transition-all relative ${
        disabled
          ? "opacity-60 cursor-not-allowed border-border bg-muted/20"
          : "border-border hover:border-enf hover:shadow-md cursor-pointer bg-card"
      }`}
    >
      <div className={`inline-flex p-3 rounded-lg mb-4 ${
        disabled ? "bg-muted text-muted-foreground" : "bg-enf/10 text-enf group-hover:bg-enf/15"
      }`}>
        {icon}
      </div>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
      <p className="text-sm leading-relaxed mb-3">{description}</p>
      <div className="text-xs font-medium text-enf">
        {disabled && disabledReason ? disabledReason : `→ ${highlight}`}
      </div>
    </button>
  );
}
