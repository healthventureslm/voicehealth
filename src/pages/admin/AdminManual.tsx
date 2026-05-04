import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

interface Section {
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    title: "Como funciona o sistema",
    body: (
      <>
        <p>
          O VoiceHealth substitui a digitação manual de evoluções clínicas: o
          profissional grava a fala e a IA gera um documento estruturado
          on-demand. O fluxo padrão é:
        </p>
        <ol>
          <li>Cadastrar paciente no setor onde está internado</li>
          <li>Registrar uma <strong>Nova gravação</strong> sobre o paciente</li>
          <li>Falar normalmente (sinais vitais, queixas, conduta…)</li>
          <li>Quando precisar, gerar um <strong>documento estruturado</strong> a partir das gravações</li>
          <li>Revisar e, se necessário, editar o documento</li>
          <li>Adicionar adendos posteriormente quando houver atualização</li>
        </ol>
      </>
    ),
  },
  {
    title: "Papéis e permissões",
    body: (
      <ul>
        <li><strong>Admin do hospital</strong>: convida usuários, cria setores, edita templates e indicadores. Vê todos os pacientes do hospital.</li>
        <li><strong>Médico(a) / Enfermeiro(a)</strong>: opera no fluxo clínico. Vê pacientes apenas dos setores onde está atribuído.</li>
        <li><strong>Auditor(a)</strong>: acesso read-only de pacientes e gravações do hospital. Útil pra qualidade e compliance.</li>
        <li><strong>Super admin (Health Ventures)</strong>: cadastra novos hospitais e mantém templates globais. Não atende paciente.</li>
      </ul>
    ),
  },
  {
    title: "Convidar um novo usuário",
    body: (
      <ol>
        <li>Vá em <strong>Administração → Usuários</strong></li>
        <li>Clique em <strong>Convidar usuário</strong></li>
        <li>Digite o e-mail, escolha o papel (médico, enfermeiro, etc.) e marque os setores onde a pessoa vai atuar</li>
        <li>Após criar, copie o <strong>link de convite</strong> e envie pra pessoa por e-mail, WhatsApp ou outro meio</li>
        <li>A pessoa clica no link, cria a senha e cai no Dashboard com as permissões corretas</li>
      </ol>
    ),
  },
  {
    title: "Templates de relatório",
    body: (
      <>
        <p>
          Templates definem como a IA estrutura o relatório a partir da
          transcrição. Vêm em duas categorias:
        </p>
        <ul>
          <li>
            <strong>Globais</strong> (mantidos pela Health Ventures): aparecem
            em todos os hospitais, marcados como <em>read-only</em> com cadeado
          </li>
          <li>
            <strong>Do hospital</strong>: criados pelo admin local. Cada save
            gera nova versão, preservando histórico
          </li>
        </ul>
        <p>
          Configure quais setores e papéis cada template atende — assim quando
          a enfermeira da UTI for gravar, só aparecem templates aplicáveis ao
          contexto dela.
        </p>
      </>
    ),
  },
  {
    title: "Lock por transferência",
    body: (
      <p>
        Quando um paciente é transferido de setor, todas as consultas já
        registradas viram <strong>imutáveis</strong> — ninguém pode mais editar
        a transcrição ou o relatório. Adendos (observações posteriores)
        continuam permitidos pra qualquer profissional que tenha autoria
        original ou esteja no novo setor. Isso garante trilha auditável de
        quem disse o quê e quando.
      </p>
    ),
  },
  {
    title: "Gravação não funcionou — o que fazer?",
    body: (
      <ol>
        <li>Confirme que o microfone está funcionando (ícone do navegador deve ter permissão concedida)</li>
        <li>Se a transcrição falhar, use a aba <strong>Texto manual</strong> e digite a gravação</li>
        <li>Se o relatório não foi gerado, volte na consulta e clique em <strong>Editar → Regerar relatório</strong></li>
        <li>Persistindo, contate o suporte (cota de IA pode ter sido excedida)</li>
      </ol>
    ),
  },
  {
    title: "Privacidade e LGPD",
    body: (
      <>
        <p>
          O VoiceHealth segue os princípios da LGPD para dados de saúde
          (categoria sensível):
        </p>
        <ul>
          <li>Acesso a prontuário é registrado em log de auditoria</li>
          <li>Profissional só vê pacientes nos setores onde está alocado</li>
          <li>Áudios são armazenados criptografados em repouso</li>
          <li>Cada paciente deve ser informado/consentir com a documentação assistida por IA</li>
        </ul>
        <p>
          Política completa: <a href="/privacy" className="text-primary underline">/privacy</a>
        </p>
      </>
    ),
  },
];

export default function AdminManual() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          icon={<BookOpen className="w-6 h-6" />}
          title="Manual do administrador"
          subtitle="Guia rápido pra operar o VoiceHealth no seu hospital."
        />

        <div className="space-y-4">
          {SECTIONS.map((section, i) => (
            <Card key={i} className="hv-card">
              <CardContent className="p-6 space-y-3">
                <p className="hv-eyebrow">
                  {(i + 1).toString().padStart(2, "0")}
                </p>
                <h2 className="heading-section">{section.title}</h2>
                <article
                  className="prose prose-sm max-w-none dark:prose-invert
                    prose-p:leading-relaxed prose-p:text-muted-foreground
                    prose-li:text-muted-foreground prose-li:my-1
                    prose-strong:text-foreground prose-strong:font-medium
                    prose-a:text-primary"
                >
                  {section.body}
                </article>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Dúvidas que não estão aqui? Contate{" "}
          <a href="mailto:contato@healthventures.com.br" className="text-primary underline">
            contato@healthventures.com.br
          </a>
        </p>
      </PageContainer>
    </AppLayout>
  );
}
