import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Users, Mic, FileText, TrendingUp, ShieldCheck, Lock,
  Hospital, Building2, Stethoscope, Calculator, ClipboardList,
  BarChart3, Settings, Network, AlertCircle
} from "lucide-react";

const sections = [
  {
    id: "overview",
    icon: BookOpen,
    title: "Visão Geral do Sistema",
    content: `O **VoiceHealth** é uma plataforma hospitalar que integra gravação de atendimentos com transcrição por IA, geração de documentos clínicos, indicadores de qualidade e conformidade com IPSG e LGPD.

**Módulos principais:**
- **Internação** — gravação e transcrição de atendimentos hospitalares
- **Ambulatório** — consultas ambulatoriais com geração de documentos
- **Indicadores** — monitoramento de indicadores de qualidade assistencial
- **IPSG** — auditorias de metas internacionais de segurança do paciente
- **Integração FHIR** — interoperabilidade com sistemas como Tasy e MV
- **LGPD** — gestão de consentimento e conformidade com a lei de proteção de dados`,
  },
  {
    id: "users",
    icon: Users,
    title: "Gerenciamento de Usuários",
    content: `Acesse **Administração → Usuários** para gerenciar a equipe.

**Roles disponíveis:**
- \`admin\` — acesso total ao sistema, incluindo configurações e gestão
- \`medico\` — acesso a gravações, relatórios e histórico de pacientes
- \`enfermeiro\` — atendimentos e auditorias IPSG
- \`tecnico\` — suporte a atendimentos e auditorias
- \`farmaceutico\` — visualização de medicamentos de alto risco
- \`auditor\` — auditorias IPSG, indicadores e planos de ação
- \`fisioterapeuta\`, \`nutricionista\`, \`fonoaudiologo\`, \`psicologo\`, \`assistente_social\` — acesso por especialidade

**Como atribuir roles:**
1. Acesse a página de Usuários
2. Localize o profissional na lista
3. Use o seletor "Adicionar Role" para atribuir
4. Clique no badge da role com ✕ para remover

**Departamentos:**
Cada usuário deve ser associado a um departamento. Isso controla o isolamento de dados — um profissional só vê pacientes e atendimentos do próprio departamento.`,
  },
  {
    id: "recording",
    icon: Mic,
    title: "Gravação e Transcrição",
    content: `**Fluxo de atendimento (Internação):**
1. Acesse **Internação → Nova Gravação**
2. Selecione ou cadastre o paciente
3. Escolha a especialidade médica e enfermaria (se aplicável)
4. Inicie a gravação — o áudio é enviado para transcrição por IA
5. Revise e edite a transcrição se necessário
6. Gere documentos clínicos a partir dos templates

**Modo Offline:**
O sistema suporta gravação offline. Quando a conexão é restabelecida, o áudio é sincronizado automaticamente.

**Ambulatório:**
O fluxo ambulatorial é similar, mas otimizado para consultas rápidas sem internação.`,
  },
  {
    id: "templates",
    icon: FileText,
    title: "Templates de Relatório",
    content: `Templates controlam como a IA estrutura os documentos clínicos gerados.

**Configuração:**
1. Acesse **Administração → Templates**
2. Crie ou edite um template
3. O campo **Prompt Template** define as instruções para a IA
4. Use variáveis como \`{transcription}\`, \`{patient_name}\`, \`{specialty}\`
5. Defina **Roles aplicáveis** para restringir quem pode usar cada template
6. Associe a um departamento ou deixe global (sem departamento)

**Dica:** Templates bem escritos melhoram significativamente a qualidade dos documentos gerados.`,
  },
  {
    id: "specialties",
    icon: Stethoscope,
    title: "Especialidades Médicas",
    content: `Especialidades configuram o prompt da IA para gerar documentos adequados a cada área.

**Configuração:**
1. Acesse **Administração → Especialidades**
2. Cada especialidade tem um **Output Prompt** que instrui a IA
3. Configure **variáveis de prompt** específicas (ex: escalas de avaliação)
4. Ative/desative especialidades conforme necessário

**Exemplos:** Clínica Médica, Cirurgia, Pediatria, Ortopedia, etc.`,
  },
  {
    id: "protocols",
    icon: Hospital,
    title: "Protocolos Clínicos",
    content: `Protocolos são documentos de referência que a IA utiliza para gerar alertas clínicos.

**Como funciona:**
1. Cadastre protocolos em **Administração → Protocolos**
2. Use **palavras-chave** para que o sistema identifique automaticamente quando um protocolo é relevante
3. Durante a geração de relatórios, a IA compara a transcrição com os protocolos e gera alertas
4. Os alertas aparecem no atendimento com severidade (info, warning, critical)`,
  },
  {
    id: "knowledge",
    icon: BookOpen,
    title: "Base de Conhecimento",
    content: `A base de conhecimento alimenta a IA com informações médicas atualizadas.

**Gerenciamento:**
1. Acesse **Administração → Base de Conhecimento**
2. Faça upload de documentos (guidelines, protocolos, artigos)
3. O sistema processa o conteúdo e cria embeddings para busca semântica
4. Durante a geração de documentos, a IA consulta a base para enriquecer o conteúdo

**Formatos suportados:** texto, markdown, PDF (via processamento)`,
  },
  {
    id: "indicators",
    icon: Calculator,
    title: "Indicadores de Qualidade",
    content: `O módulo de indicadores monitora métricas assistenciais automaticamente.

**Configuração:**
1. Acesse **Administração → Indicadores**
2. Crie indicadores com fórmula (numerador/denominador), meta e limiares de alerta
3. Configure **coleta automática** se desejado — o sistema calcula a partir dos dados do banco
4. Defina frequência (diária, semanal, mensal)

**Tipos de cálculo:**
- \`percentage\` — (numerador / denominador) × 100
- \`rate\` — taxa por mil ou similar
- \`count\` — contagem simples

**Alertas:**
Quando um indicador ultrapassa o limiar de warning ou critical, o sistema gera alertas automáticos.`,
  },
  {
    id: "ipsg",
    icon: ShieldCheck,
    title: "IPSG — Metas de Segurança",
    content: `O módulo IPSG implementa as Metas Internacionais de Segurança do Paciente (JCI 8ª edição).

**Funcionalidades:**
- **Dashboard** com taxa de conformidade por meta
- **Auditorias** com checklists configuráveis
- **Planos de ação** para não-conformidades

**Configuração de Checklists:**
1. Acesse **Administração → Config. IPSG**
2. Crie checklists para cada meta
3. Defina itens de verificação em formato JSON
4. Associe a tipos de enfermaria aplicáveis
5. Configure frequência de auditoria

**Roles para auditoria:**
- \`auditor\` e \`admin\` podem gerenciar auditorias e planos de ação
- \`enfermeiro\` e \`tecnico\` podem criar auditorias
- Todos podem visualizar resultados do departamento`,
  },
  {
    id: "wards",
    icon: Building2,
    title: "Enfermarias e Leitos",
    content: `Enfermarias organizam a estrutura física do hospital.

**Configuração:**
1. Acesse **Administração → Enfermarias**
2. Crie enfermarias com nome, tipo (UTI, enfermaria, etc.) e capacidade
3. Associe pacientes às enfermarias durante a internação
4. O histórico de movimentação é registrado automaticamente

**Tipos de enfermaria:** UTI, UCO, Enfermaria, Centro Cirúrgico, Ambulatório, etc.`,
  },
  {
    id: "fhir",
    icon: Network,
    title: "Integração FHIR (Interoperabilidade)",
    content: `O sistema suporta HL7 FHIR R4 para troca de dados com sistemas hospitalares.

**FHIR Server (Facade):**
O VoiceHealth expõe endpoints FHIR para que sistemas externos consultem dados:
- \`GET /Patient\` — pacientes
- \`GET /Encounter\` — atendimentos
- \`GET /DiagnosticReport\` — relatórios clínicos
- \`GET /metadata\` — CapabilityStatement

**FHIR Client:**
Para importar dados de sistemas como Tasy ou MV:
1. Acesse **Administração → Integração FHIR**
2. Configure uma conexão com URL base e credenciais
3. Teste a conexão (verifica CapabilityStatement)
4. Execute sincronização manual de pacientes

**Segurança:**
O token de API FHIR é configurado em \`app_settings\` (chave \`fhir_api_token\`).`,
  },
  {
    id: "signature",
    icon: FileText,
    title: "Assinatura Digital",
    content: `Documentos clínicos incluem assinatura eletrônica com validade legal (Lei 14.063/2020).

**Configuração por profissional:**
Cada profissional deve preencher seu registro no perfil:
- **Tipo:** CRM, COREN, CRP, CREFONO, CREFITO, CRESS
- **Número:** ex: "CRM 12345/SP"

**O bloco de assinatura no PDF inclui:**
- Nome completo do profissional
- Registro profissional
- Data/hora da geração
- Código de verificação (hash SHA-256)
- Referência à Lei 14.063/2020`,
  },
  {
    id: "lgpd",
    icon: Lock,
    title: "LGPD — Proteção de Dados",
    content: `O módulo LGPD garante conformidade com a Lei Geral de Proteção de Dados.

**Funcionalidades Admin:**
- **Consentimentos:** visualize todos os registros de consentimento
- **Solicitações:** gerencie pedidos de acesso, exclusão e portabilidade
- **Políticas de retenção:** configure tempo de retenção por tabela
- **Logs de auditoria:** rastreie todas as ações sobre dados pessoais

**Acesse em:** Administração → Gestão LGPD`,
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Métricas de Uso",
    content: `O dashboard de métricas mostra o uso da plataforma.

**Dados disponíveis:**
- Total de gravações por departamento
- Relatórios gerados (com custo estimado de IA)
- Consumo de transcrições
- Tendências ao longo do tempo

**Acesse em:** Administração → Métricas de Uso`,
  },
  {
    id: "departments",
    icon: Settings,
    title: "Departamentos",
    content: `Departamentos são a unidade de isolamento de dados no sistema.

**Regras importantes:**
- Cada usuário pertence a exatamente um departamento
- Pacientes, atendimentos e indicadores são isolados por departamento
- Admins podem ver dados de todos os departamentos
- Configure em **Administração → Departamentos**

**Campos:**
- Nome do departamento
- Hospital (para multi-hospital)
- Descrição`,
  },
  {
    id: "troubleshooting",
    icon: AlertCircle,
    title: "Solução de Problemas",
    content: `**Usuário não consegue acessar:**
- Verifique se tem um departamento atribuído
- Verifique se tem pelo menos uma role

**Gravação não funciona:**
- Verifique permissão de microfone no navegador
- Se offline, a gravação será sincronizada ao reconectar

**Documentos sem assinatura:**
- O profissional precisa preencher o registro (CRM/COREN) no perfil

**Indicadores sem dados:**
- Verifique se a coleta automática está ativa
- Verifique os logs de coleta em **Administração → Logs de Coleta**

**FHIR não conecta:**
- Verifique URL base e credenciais
- Use o botão "Testar Conexão" no painel FHIR
- Verifique se o \`fhir_api_token\` está configurado em app_settings`,
  },
];

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) parts.push(<strong key={key++}>{match[1]}</strong>);
    else if (match[2]) parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs">{match[2]}</code>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function AdminManual() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Manual do Administrador</h1>
              <p className="text-muted-foreground">Guia completo de configuração e operação do VoiceHealth</p>
            </div>
          </div>
          <Badge variant="secondary" className="mt-2">Acesso restrito a administradores</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Índice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors p-2 rounded-md hover:bg-muted"
                >
                  <s.icon className="w-4 h-4 flex-shrink-0" />
                  {s.title}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-3">
          {sections.map((s) => (
            <AccordionItem key={s.id} value={s.id} id={s.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <s.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="font-semibold text-left">{s.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="prose prose-sm dark:prose-invert max-w-none pt-2 pb-4 whitespace-pre-line">
                  {s.content.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <br key={i} />;

                    // Bold headers
                    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
                    if (boldMatch) return <p key={i} className="font-semibold mt-3 mb-1">{boldMatch[1]}</p>;

                    // List items
                    if (trimmed.startsWith('- ')) {
                      const text = trimmed.slice(2);
                      return (
                        <div key={i} className="flex gap-2 ml-2 my-0.5">
                          <span className="text-muted-foreground">•</span>
                          <span>{renderInlineMarkdown(text)}</span>
                        </div>
                      );
                    }

                    // Numbered items
                    const numMatch = trimmed.match(/^(\d+)\.\s(.+)/);
                    if (numMatch) {
                      return (
                        <div key={i} className="flex gap-2 ml-2 my-0.5">
                          <span className="text-muted-foreground font-medium">{numMatch[1]}.</span>
                          <span>{renderInlineMarkdown(numMatch[2])}</span>
                        </div>
                      );
                    }

                    return (
                      <p key={i} className="my-1">{renderInlineMarkdown(trimmed)}</p>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </AppLayout>
  );
}
