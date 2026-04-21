import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicy() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade — LGPD</h1>
        <p className="text-muted-foreground">Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</p>

        <Card>
          <CardContent className="prose prose-sm max-w-none p-6 text-foreground space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Controlador dos Dados</h2>
              <p>O VoiceHealth é o controlador dos dados pessoais tratados nesta plataforma, nos termos do Art. 5º, VI da LGPD. Qualquer dúvida ou solicitação sobre o tratamento de dados deve ser direcionada ao Encarregado de Proteção de Dados (DPO) através dos canais disponíveis na plataforma.</p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">2. Dados Pessoais Coletados</h2>
              <p>Coletamos e tratamos os seguintes dados:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Dados de identificação:</strong> nome completo, e-mail, foto do perfil (via Google OAuth)</li>
                <li><strong>Dados profissionais:</strong> função/cargo, departamento, especialidade</li>
                <li><strong>Dados de pacientes:</strong> nome, iniciais, prontuário, leito, setor, data de nascimento, histórico de movimentação</li>
                <li><strong>Dados clínicos:</strong> gravações de áudio, transcrições, relatórios clínicos, alertas clínicos</li>
                <li><strong>Dados de uso:</strong> logs de acesso, ações realizadas, timestamps</li>
                <li><strong>Dados técnicos:</strong> endereço IP, user-agent do navegador</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">3. Finalidades do Tratamento (Art. 7º)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Execução de procedimentos de saúde (Art. 7º, VIII):</strong> registro e documentação de atendimentos clínicos</li>
                <li><strong>Tutela da saúde (Art. 7º, VIII):</strong> monitoramento de indicadores de qualidade e segurança do paciente</li>
                <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> conformidade com regulamentações do setor de saúde</li>
                <li><strong>Legítimo interesse (Art. 7º, IX):</strong> melhoria contínua dos processos assistenciais</li>
                <li><strong>Consentimento (Art. 7º, I):</strong> para tratamentos não cobertos pelas bases legais acima</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">4. Dados Sensíveis (Art. 11)</h2>
              <p>Os dados de saúde são considerados dados pessoais sensíveis pela LGPD. O tratamento destes dados é realizado com base no Art. 11, II, "f" — tutela da saúde, exclusivamente, em procedimento realizado por profissionais de saúde, serviços de saúde ou autoridade sanitária.</p>
              <p>Medidas adicionais de proteção incluem:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Criptografia em trânsito e em repouso</li>
                <li>Controle de acesso baseado em funções (RBAC)</li>
                <li>Isolamento por departamento (multi-tenant)</li>
                <li>Logs de auditoria de todos os acessos</li>
                <li>Anonimização de dados quando aplicável</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">5. Direitos do Titular (Art. 18)</h2>
              <p>Todo titular de dados tem direito a:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Confirmação e acesso:</strong> saber se seus dados são tratados e acessá-los</li>
                <li><strong>Correção:</strong> solicitar correção de dados incompletos ou desatualizados</li>
                <li><strong>Anonimização/bloqueio/eliminação:</strong> de dados desnecessários ou excessivos</li>
                <li><strong>Portabilidade:</strong> exportar seus dados em formato estruturado</li>
                <li><strong>Eliminação:</strong> solicitar exclusão de dados tratados com consentimento</li>
                <li><strong>Revogação do consentimento:</strong> a qualquer momento, via painel de privacidade</li>
                <li><strong>Informação sobre compartilhamento:</strong> saber com quais entidades os dados são compartilhados</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Estas solicitações podem ser feitas em <strong>Configurações → Privacidade & LGPD</strong> dentro da plataforma.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">6. Compartilhamento de Dados (Art. 26)</h2>
              <p>Os dados pessoais NÃO são vendidos ou compartilhados com terceiros para fins comerciais. O compartilhamento ocorre apenas:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Entre profissionais de saúde do mesmo departamento, para continuidade do cuidado</li>
                <li>Com provedores de infraestrutura tecnológica (processamento seguro)</li>
                <li>Quando exigido por ordem judicial ou obrigação legal</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">7. Retenção e Eliminação de Dados</h2>
              <p>Os dados são retidos pelo período necessário ao cumprimento das finalidades para as quais foram coletados, respeitando os prazos legais do setor de saúde (mínimo de 20 anos para prontuários médicos, conforme Resolução CFM nº 1.821/2007).</p>
              <p>Dados que não se enquadrem em obrigações legais de retenção serão anonimizados ou eliminados após o período definido na política de retenção.</p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">8. Segurança dos Dados (Art. 46)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Criptografia TLS/SSL em todas as comunicações</li>
                <li>Criptografia AES-256 para dados em repouso</li>
                <li>Autenticação OAuth 2.0 com Google</li>
                <li>Row-Level Security (RLS) no banco de dados</li>
                <li>Controle de acesso por função profissional</li>
                <li>Monitoramento e logs de auditoria</li>
                <li>Backups automáticos com retenção segura</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">9. Transferência Internacional (Art. 33)</h2>
              <p>Os dados podem ser processados em servidores localizados fora do Brasil. Nestes casos, garantimos que os provedores oferecem nível adequado de proteção de dados, em conformidade com o Art. 33 da LGPD.</p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">10. Incidentes de Segurança (Art. 48)</h2>
              <p>Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos à Autoridade Nacional de Proteção de Dados (ANPD) e aos titulares afetados, em prazo razoável, conforme Art. 48 da LGPD.</p>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold">11. Atualizações desta Política</h2>
              <p>Esta política pode ser atualizada periodicamente. Alterações significativas serão comunicadas aos usuários através da plataforma. A versão atualizada sempre estará disponível nesta página.</p>
              <p className="text-sm text-muted-foreground mt-2">Ultima atualizacao: 13/04/2026</p>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
