import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, UserPlus, ArrowRight } from "lucide-react";

/**
 * "Hub" de novo atendimento — entrada visual única pra escolher entre
 * registrar uma gravação ou cadastrar um paciente novo. Inspirado no
 * "novo chat" do Claude: pergunta clara + dois grandes botões.
 *
 * Conteúdo centralizado vertical+horizontal na tela inteira (sem
 * PageContainer, que adiciona padding e empurra o conteúdo pra cima).
 */
export default function NewAttendance() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="min-h-full flex flex-col items-center justify-center px-4 sm:px-6 py-10 gap-10 text-center">
        <div className="space-y-3 max-w-xl">
          <h1 className="heading-page">Novo atendimento</h1>
          <p className="text-muted-foreground">
            O que você quer fazer agora?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          <ActionCard
            icon={<Mic className="w-8 h-8" />}
            title="Nova gravação"
            description="Registrar uma gravação de áudio pra um paciente existente."
            onClick={() => navigate("/consultations/new")}
          />
          <ActionCard
            icon={<UserPlus className="w-8 h-8" />}
            title="Novo paciente"
            description="Cadastrar um paciente novo nos seus setores."
            onClick={() => navigate("/patients?new=1")}
          />
        </div>
      </div>
    </AppLayout>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group hover:shadow-md hover:border-[var(--border-hov)] transition-all"
    >
      <CardContent className="p-8 flex flex-col items-start gap-4 text-left h-full">
        <div className="text-primary">{icon}</div>
        <div className="flex-1 space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground self-end group-hover:translate-x-1 transition-transform" />
      </CardContent>
    </Card>
  );
}
