import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCUMENT_PROMPTS: Record<string, (details: any, transcription: string, patientHistory?: string) => string> = {
  exam_request: (details, transcription) => {
    const examList = details.exam_list as string[] | undefined;
    const category = details.exam_category || "laboratorial";
    const hasMultiple = examList && examList.length > 1;

    if (hasMultiple && category === "laboratorial") {
      return `Gere um PEDIDO DE EXAMES LABORATORIAIS médico profissional e completo em português.

Exames solicitados:
${examList.map((e: string, i: number) => `${i + 1}. ${e}`).join("\n")}

Indicação clínica: ${details.indication || "extrair da transcrição"}

Transcrição do atendimento:
${transcription}

Formato do pedido:
1. SOLICITAÇÃO DE EXAMES LABORATORIAIS
2. Lista de exames solicitados (todos numerados)
3. Indicação clínica: [justificativa baseada na história do paciente]
4. Informações clínicas relevantes: [dados relevantes da transcrição]
5. Urgência: [rotina/urgente - inferir do contexto]
6. Material: [sangue/urina/fezes conforme aplicável]

Gere apenas o conteúdo do pedido consolidado, profissional e pronto para impressão.`;
    }

    return `Gere um PEDIDO DE EXAME médico profissional e completo em português.

Exame solicitado: ${details.name || (examList?.[0]) || "não especificado"}
Indicação clínica extraída: ${details.indication || "extrair da transcrição"}

Transcrição do atendimento:
${transcription}

Formato do pedido:
1. SOLICITAÇÃO DE EXAME
2. Exame: [nome completo do exame]
3. Indicação clínica: [justificativa baseada na história do paciente]
4. Informações clínicas relevantes: [dados relevantes da transcrição]
5. Urgência: [rotina/urgente - inferir do contexto]

Gere apenas o conteúdo do pedido, profissional e pronto para impressão.`;
  },

  prescription: (details, transcription) => `Gere uma RECEITA MÉDICA profissional e completa em português.

Medicamento: ${details.name || "não especificado"}
Dose informada: ${details.dose || "NÃO ESPECIFICADA - SUGERIR dose padrão para adulto com base em referências farmacológicas"}
Posologia: ${details.frequency || "NÃO ESPECIFICADA - sugerir padrão"}
Via: ${details.route || "inferir a mais comum para este medicamento"}
Duração: ${details.duration || "a critério médico"}

${details.suggest_dose ? "⚠️ DOSE NÃO ESPECIFICADA PELO MÉDICO: Sugerir dose padrão com base em referências, indicando claramente que é DOSE SUGERIDA para revisão." : ""}
${details.is_controlled ? "⚠️ MEDICAMENTO CONTROLADO: Incluir alerta de medicamento controlado." : ""}

Transcrição do atendimento:
${transcription}

Formato da receita:
- Medicamento (nome genérico + classe terapêutica)
- Concentração/Dose
- Via de administração
- Posologia
- Duração
- Orientações ao paciente
${details.suggest_dose ? "- ⚠️ DOSE SUGERIDA - Revisar antes de prescrever" : ""}
${details.is_controlled ? "- ⚠️ MEDICAMENTO CONTROLADO - Receita especial necessária" : ""}

Gere apenas o conteúdo da receita, profissional e pronto para impressão.`,

  hospitalization: (details, transcription) => `Gere um PEDIDO DE INTERNAÇÃO médico completo e estruturado em português.

CID-10 inferido: ${details.cid || "inferir da transcrição"}
Justificativa: ${details.justification || "extrair da transcrição"}
Tipo de leito: ${details.bed_type || "enfermaria (inferir se UTI/semi-intensiva necessária)"}

Transcrição do atendimento:
${transcription}

Formato estruturado:
1. SOLICITAÇÃO DE INTERNAÇÃO HOSPITALAR
2. Diagnóstico principal (com CID-10)
3. Diagnósticos secundários (se aplicável)
4. Justificativa clínica para internação
5. Tipo de leito solicitado
6. Procedimentos previstos
7. Tempo estimado de internação
8. Condição clínica atual do paciente

Gere conteúdo profissional e completo, pronto para uso.`,

  high_cost_med: (details, transcription) => `Gere um documento de JUSTIFICATIVA DE MEDICAMENTO DE ALTO CUSTO / LME em português.

Medicamento: ${details.name || "não especificado"}
Indicação: ${details.indication || "extrair da transcrição"}
CID-10: ${details.cid || "inferir da transcrição"}

Transcrição do atendimento:
${transcription}

Gerar DOIS formatos:

### JUSTIFICATIVA TÉCNICA (Texto Livre)
- Diagnóstico detalhado
- História da doença
- Tratamentos prévios e seus resultados
- Justificativa para uso do medicamento de alto custo
- Evidências científicas resumidas
- Benefício esperado

### CAMPOS LME (Estruturados)
- CID-10 principal:
- Diagnóstico:
- Anamnese resumida:
- Medicamentos já utilizados:
- Justificativa para o medicamento solicitado:
- Posologia e duração prevista:

Gere conteúdo profissional, completo e baseado nas informações da transcrição.`,

  transfer: (details, transcription) => `Gere um FORMULÁRIO DE TRANSFERÊNCIA HOSPITALAR em português.

Destino mencionado: ${details.destination || "não especificado - deixar campo para preenchimento"}

Transcrição do atendimento:
${transcription}

Formato:
1. SOLICITAÇÃO DE TRANSFERÊNCIA
2. Setor de origem: [extrair do contexto]
3. Setor de destino: ${details.destination || "[A DEFINIR]"}
4. Motivo da transferência: [extrair da transcrição]
5. Condição clínica atual: [resumo do estado do paciente]
6. Diagnóstico principal:
7. Procedimentos/cuidados em andamento:
8. Necessidades especiais de transporte:
9. Informações relevantes para o setor receptor:

Gere conteúdo profissional e completo.`,

  discharge: (details, transcription, patientHistory) => `Gere um SUMÁRIO DE ALTA completo em português.

Transcrição do atendimento atual:
${transcription}

${patientHistory ? `Histórico de atendimentos do paciente:\n${patientHistory}` : ""}

Formato do sumário:
1. SUMÁRIO DE ALTA HOSPITALAR
2. Diagnóstico principal (com CID-10)
3. Diagnósticos secundários
4. Resumo da internação/atendimento (IA resume baseado no histórico)
5. Procedimentos realizados
6. Evolução clínica
7. Condição na alta
8. Prescrição de alta (medicamentos para casa)
9. Orientações ao paciente
10. Retorno / Acompanhamento ambulatorial
11. Sinais de alerta para retorno à emergência

Gere um sumário completo e profissional baseado em todas as informações disponíveis.`,

  // ---- Nursing intents ----
  nursing_note: (details, transcription) => `Gere uma ANOTAÇÃO DE ENFERMAGEM profissional e completa em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. ANOTAÇÃO DE ENFERMAGEM
2. Data/Hora: [atual]
3. Estado geral do paciente
4. Cuidados realizados
5. Intercorrências (se houver)
6. Balanço hídrico (se mencionado)
7. Orientações dadas ao paciente/acompanhante
8. Observações relevantes

Gere conteúdo profissional no padrão de anotação de enfermagem.`,

  nursing_evolution: (details, transcription) => `Gere uma EVOLUÇÃO DE ENFERMAGEM no formato SOAPIE em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato SOAPIE:
- S (Subjetivo): queixas e relatos do paciente
- O (Objetivo): dados objetivos, sinais vitais, exame físico
- A (Avaliação): diagnósticos de enfermagem identificados
- P (Planejamento): plano de cuidados
- I (Implementação): intervenções realizadas
- E (Evolução): resultados observados

Gere conteúdo profissional e completo.`,

  vital_signs: (details, transcription) => `Gere um REGISTRO DE SINAIS VITAIS estruturado em português.

${details.summary ? `Dados: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. REGISTRO DE SINAIS VITAIS
2. PA (Pressão Arterial):
3. FC (Frequência Cardíaca):
4. FR (Frequência Respiratória):
5. Temperatura:
6. SpO2 (Saturação):
7. Glicemia capilar (se mencionada):
8. Dor (escala EVA, se mencionada):
9. Glasgow (se aplicável):
10. Observações:

Extraia os valores mencionados na transcrição. Deixe em branco os não mencionados.`,

  // ---- Multidisciplinary intents ----
  diet_prescription: (details, transcription) => `Gere uma PRESCRIÇÃO DIETÉTICA / AVALIAÇÃO NUTRICIONAL profissional em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. PRESCRIÇÃO DIETÉTICA
2. Diagnóstico nutricional
3. Estado nutricional atual
4. Necessidades calóricas estimadas
5. Dieta prescrita (tipo, consistência, restrições)
6. Suplementação (se indicada)
7. Via de administração (oral, enteral, parenteral)
8. Orientações nutricionais ao paciente/acompanhante
9. Reavaliação programada

Gere conteúdo profissional e completo.`,

  rehab_evolution: (details, transcription) => `Gere uma EVOLUÇÃO FISIOTERAPÊUTICA profissional em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. EVOLUÇÃO FISIOTERAPÊUTICA
2. Diagnóstico cinético-funcional
3. Avaliação funcional atual
4. Condutas realizadas
5. Resposta do paciente ao tratamento
6. Plano terapêutico
7. Metas a curto e longo prazo
8. Orientações ao paciente
9. Observações

Gere conteúdo profissional e completo.`,

  speech_eval: (details, transcription) => `Gere uma AVALIAÇÃO / EVOLUÇÃO FONOAUDIOLÓGICA profissional em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. AVALIAÇÃO FONOAUDIOLÓGICA
2. Queixa principal
3. Avaliação de linguagem/fala/voz/deglutição (conforme aplicável)
4. Achados clínicos
5. Hipótese diagnóstica fonoaudiológica
6. Condutas realizadas
7. Plano terapêutico
8. Orientações ao paciente/acompanhante
9. Observações

Gere conteúdo profissional e completo.`,

  psych_eval: (details, transcription) => `Gere uma AVALIAÇÃO / EVOLUÇÃO PSICOLÓGICA profissional em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. AVALIAÇÃO PSICOLÓGICA
2. Demanda/queixa
3. Estado emocional e cognitivo atual
4. Aspectos observados na entrevista
5. Hipótese diagnóstica (se aplicável)
6. Intervenções realizadas
7. Plano de acompanhamento
8. Orientações ao paciente/família
9. Observações

Gere conteúdo profissional e completo, respeitando o sigilo ético.`,

  social_report: (details, transcription) => `Gere um RELATÓRIO SOCIAL / EVOLUÇÃO DO SERVIÇO SOCIAL profissional em português.

${details.summary ? `Resumo: ${details.summary}` : ""}

Transcrição do atendimento:
${transcription}

Formato:
1. RELATÓRIO SOCIAL
2. Identificação socioeconômica
3. Composição familiar
4. Situação habitacional
5. Situação de trabalho/renda
6. Rede de apoio
7. Demandas identificadas
8. Encaminhamentos realizados
9. Plano de acompanhamento social
10. Observações

Gere conteúdo profissional e completo.`,

  // ---- NEW: Medical evolution (SOAP) ----
  medical_evolution: (details, transcription) => `Gere uma EVOLUÇÃO MÉDICA DIÁRIA no formato SOAP em português.

Setor: ${details.sector || "internação"}
CID-10 inferido: ${details.cid || "inferir da transcrição"}

Transcrição do atendimento:
${transcription}

--- EXEMPLO 1 ---
S: Paciente refere melhora da dispneia, sem febre há 24h. Aceitando dieta oral.
O: Bom estado geral. PA 130/80 mmHg, FC 78 bpm, FR 18 irpm, T 36.5°C, SpO2 97% aa. Ausculta pulmonar com MV presente, sem ruídos adventícios. Abdome flácido, indolor.
A: Pneumonia bacteriana (J18.9) em regressão. Hemodinamicamente estável.
P: Manter antibioticoterapia em curso. Alta hospitalar prevista para amanhã se evolução favorável. Orientar retorno ambulatorial em 7 dias.
--- FIM EXEMPLO 1 ---

--- EXEMPLO 2 ---
S: Paciente com dor em região lombar 7/10, sem irradiação. Nega febre.
O: Regular estado geral. PA 145/92 mmHg, FC 88 bpm, T 36.8°C. Punho-percussão lombar positivo à direita. Edema MMII ++/4+.
A: Crise hipertensiva (I10) + suspeita de pielonefrite (N10). Aguardando resultado de urocultura.
P: Ajuste de anti-hipertensivo. Iniciar antibiótico empírico. Solicitar USG renal.
--- FIM EXEMPLO 2 ---

Formato SOAP obrigatório:
**S (Subjetivo):** queixas e sintomas relatados pelo paciente
**O (Objetivo):** sinais vitais, exame físico, dados laboratoriais mencionados
**A (Avaliação):** diagnóstico(s) com CID-10, situação clínica atual
**P (Plano):** condutas, ajustes terapêuticos, próximos passos

Use [NÃO INFORMADO] para campos ausentes na transcrição. Gere conteúdo completo e profissional.`,

  // ---- NEW: ICU evolution ----
  icu_evolution: (details, transcription) => `Gere uma EVOLUÇÃO DE UTI completa e estruturada em português.

Transcrição do atendimento:
${transcription}

--- EXEMPLO ---
Data: 13/04/2026 08:00 | UTI Adulto | Leito 5
Diagnóstico: Sepse de foco abdominal (A41.9) + IRA (N17.9)
Sedoanalgesia: Midazolam 5 mg/h + Fentanil 50 mcg/h | RASS: -2 | CAM-ICU: negativo
VM: Modo VCV | FiO2 45% | PEEP 8 | VC 420 mL | FR 14 irpm | SpO2 98%
Hemodinâmica: PA 108/64 mmHg | FC 92 bpm | Noradrenalina 0.15 mcg/kg/min (reduzindo)
Balanço Hídrico 24h: Entrada 3.200 mL | Saída 2.100 mL | Balanço +1.100 mL (acumulado +4.800 mL)
Função renal: Ureia 98 | Creatinina 3.2 | Diurese 0.4 mL/kg/h | TCRR em curso
Glasgow: Sedado (E1V1M5 sob sedação)
SOFA Score: 11 pontos
Culturas: Hemocultura 48h — negativa. Cultura de secreção traqueal — aguardando.
S: Paciente sedado, sem resposta a estímulos verbais.
O: (dados acima)
A: Sepse controlando. Desmame de vasopressor em progresso. IRA em diálise.
P: Reduzir sedação progressivamente. Fisioterapia motora precoce. Manter dieta enteral.
--- FIM EXEMPLO ---

Formato obrigatório para evolução UTI:
**Data/Hora | Setor | Leito:**
**Diagnóstico Principal (CID-10):**
**Sedoanalgesia:** agente, dose, RASS, CAM-ICU
**Suporte Ventilatório:** modo, parâmetros, SpO2 (se em VM; "em ar ambiente" se não)
**Hemodinâmica:** PA, FC, drogas vasoativas (dose e tendência)
**Balanço Hídrico 24h:** entrada / saída / balanço / acumulado
**Função Renal:** ureia, creatinina, diurese, TRS se aplicável
**Neurológico:** Glasgow (ou sedação), CAM-ICU, pupilas
**Escores:** SOFA / APACHE II (se disponíveis)
**Microbiologia:** culturas e resultados
**S/O/A/P:** evolução SOAP completa
**Pendências/Plano:** próximas 24h

Use [NÃO INFORMADO] para campos ausentes. Gere conteúdo completo.`,

  // ---- NEW: Surgical note ----
  surgical_note: (details, transcription) => `Gere uma NOTA OPERATÓRIA / DESCRIÇÃO CIRÚRGICA profissional e completa em português.

Procedimento: ${details.procedure || "extrair da transcrição"}
CID-10: ${details.cid || "inferir da transcrição"}

Transcrição do atendimento:
${transcription}

--- EXEMPLO ---
NOTA OPERATÓRIA
Data: 13/04/2026 | Início: 09:15 | Término: 11:30 | Duração: 2h15min
Cirurgião: Dr. [Nome] | Auxiliar: Dr. [Nome] | Anestesista: Dr. [Nome]
Anestesia: Geral inalatória
Diagnóstico pré-operatório: Colecistite aguda calculosa (K81.0)
Diagnóstico pós-operatório: Colecistite aguda calculosa com empiema (K81.0)
Procedimento: Colecistectomia videolaparoscópica
Achados intraoperatórios: Vesícula biliar distendida com conteúdo purulento, múltiplos cálculos, aderências ao omento. Ducto cístico e artéria cística identificados e clipados sem intercorrências.
Técnica: Acesso laparoscópico com 4 trocateres. Dissecção do triângulo de Calot. Clipagem dupla do ducto cístico e artéria cística. Dissecção da vesícula do leito hepático com bisturi harmônico. Hemostasia com bisturi. Peça enviada à anatomopatológico.
Intercorrências: Nenhuma.
Sangramento estimado: 50 mL. Hemotransfusão: Não.
Drenos/Cateteres: Dreno de Blake em leito hepático (saída de 20 mL seroso).
Condição ao final: Estável, extubado em sala.
--- FIM EXEMPLO ---

Formato obrigatório:
**NOTA OPERATÓRIA**
**Data | Horário início/término | Duração:**
**Equipe:** cirurgião, auxiliar(es), anestesista
**Tipo de Anestesia:**
**Diagnóstico Pré-operatório (CID-10):**
**Diagnóstico Pós-operatório:**
**Procedimento Realizado:**
**Achados Intraoperatórios:**
**Descrição da Técnica Cirúrgica:**
**Intercorrências:**
**Sangramento Estimado / Hemotransfusão:**
**Material Enviado (anatomopatológico/cultura):**
**Drenos/Cateteres:**
**Condição do Paciente ao Final:**
**Plano Pós-operatório:**

Use [NÃO INFORMADO] onde dados não estiverem disponíveis. Gere conteúdo profissional.`,

  // ---- NEW: Interconsultation ----
  interconsult: (details, transcription) => `Gere uma SOLICITAÇÃO DE INTERCONSULTA médica profissional e completa em português.

Especialidade solicitada: ${details.specialty || "extrair da transcrição"}
Urgência: ${details.urgency || "inferir do contexto (rotina/urgente/emergência)"}
CID-10: ${details.cid || "inferir da transcrição"}

Transcrição do atendimento:
${transcription}

--- EXEMPLO 1 ---
SOLICITAÇÃO DE INTERCONSULTA
De: Clínica Médica — Enfermaria 3 — Leito 12
Para: Cardiologia
Urgência: Rotina (resposta em até 24h)
Diagnóstico principal: Fibrilação atrial de início recente (I48.0)
Motivo da solicitação: Paciente de 68 anos, HAS, DM2, internado por descompensação de ICC. Desenvolveu FA de início indeterminado ao ECG de controle. Sem instabilidade hemodinâmica. Solicito avaliação para estratégia de controle de ritmo vs frequência e anticoagulação.
História resumida: ICC FE reduzida (FE 35%), em uso de carvedilol, enalapril, furosemida. Sem uso de anticoagulante prévio. Cr 1.4. CHA₂DS₂-VASc: 4.
Exames relevantes: ECG: FA com resposta ventricular 95 bpm. ECO: FE 35%, VE dilatado. TSH normal.
Pergunta ao especialista: Avaliar melhor estratégia terapêutica e necessidade de cardioversão.
--- FIM EXEMPLO 1 ---

--- EXEMPLO 2 ---
SOLICITAÇÃO DE INTERCONSULTA
De: UTI — Leito 3
Para: Infectologia
Urgência: Urgente (resposta em até 4h)
Diagnóstico principal: Sepse de foco pulmonar (A41.9)
Motivo: Paciente em VM, sepse grave, sem resposta após 72h de meropenem + vancomicina. Febre persistente, procalcitonina em elevação. Solicito avaliação para ampliação do espectro antimicrobiano.
--- FIM EXEMPLO 2 ---

Formato obrigatório:
**SOLICITAÇÃO DE INTERCONSULTA**
**De (setor/serviço):** → **Para (especialidade):**
**Urgência:** Rotina (24h) / Urgente (4h) / Emergência (imediata)
**Diagnóstico Principal (CID-10):**
**Motivo Detalhado da Solicitação:**
**Resumo da História Clínica:**
**Exames e Dados Clínicos Relevantes:**
**Medicações Atuais:**
**Pergunta Específica ao Especialista:**

Use [NÃO INFORMADO] para campos ausentes. Gere conteúdo profissional e objetivo.`,

  // ---- NEW: Handoff ISBAR ----
  handoff_isbar: (details, transcription) => `Gere uma PASSAGEM DE PLANTÃO no formato ISBAR completa e estruturada em português.

Transcrição do atendimento:
${transcription}

--- EXEMPLO ---
PASSAGEM DE PLANTÃO — ISBAR
Data: 13/04/2026 | Plantão: 07h → 19h | Setor: UTI Adulto

**I — IDENTIFICAÇÃO**
Paciente: João da Silva, 72 anos, masculino | Leito: UTI 4
Internação: 08/04/2026 (5º dia) | CID-10: Sepse de foco urinário (A41.9)
Responsável atual: Dr. Ana Lima | Passando para: Dr. Carlos Melo

**S — SITUAÇÃO ATUAL**
Paciente em desmame ventilatório, extubado ontem às 15h. Em cateter nasal 3L/min, SpO2 96%. Hemodinamicamente estável, sem vasopressor há 18h. Diurese adequada.

**B — BACKGROUND (Histórico)**
Sepse urinária por E. coli ESBL. Antibiótico em uso: Meropenem (D5 de 10). HAS, DM2, IRC leve (Cr basal 1.3). Internado inicialmente em FMO (renal + pulmonar).

**A — AVALIAÇÃO**
Evolução favorável. Critérios de alta da UTI em 24-48h se mantiver estabilidade. Preocupação: glicemia em flutuação (100-280 mg/dL nas últimas 12h).

**R — RECOMENDAÇÕES**
1. Manter meropenem até completar 10 dias
2. Ajuste de insulina sliding scale — chamar endocrinologia se glicemia > 250 em 2 medições
3. Iniciar fisioterapia motora a partir de amanhã
4. Solicitar urocultura de controle em 48h
5. Discutir alta UTI com família hoje à tarde
--- FIM EXEMPLO ---

Formato ISBAR obrigatório:
**PASSAGEM DE PLANTÃO — ISBAR**
**Data | Turno | Setor:**

**I — IDENTIFICAÇÃO**
Paciente (nome, idade, sexo), leito, data de internação, CID-10, médico atual e receptor

**S — SITUAÇÃO ATUAL**
Estado clínico presente, intercorrências das últimas horas, sinais vitais, suportes em uso

**B — BACKGROUND**
Diagnóstico principal, comorbidades, medicações relevantes, procedimentos recentes, evolução geral da internação

**A — AVALIAÇÃO**
Situação geral, tendência (melhora/piora/estável), problemas ativos e preocupações

**R — RECOMENDAÇÕES**
Lista numerada: ações pendentes, ajustes de conduta, alertas, próximos passos prioritários

Use [NÃO INFORMADO] para dados ausentes. Gere passagem objetiva, segura e completa.`,
};

const TITLE_MAP: Record<string, (details: any) => string> = {
  exam_request: (d) => {
    const examList = d?.exam_list as string[] | undefined;
    if (examList && examList.length > 1 && (d?.exam_category || "laboratorial") === "laboratorial") {
      return `Pedido de Exames Laboratoriais (${examList.length} exames)`;
    }
    return `Pedido de Exame: ${d?.name || examList?.[0] || "Exame"}`;
  },
  prescription: (d) => `Receita: ${d?.name || "Medicamento"}`,
  hospitalization: () => "Pedido de Internação",
  high_cost_med: (d) => `Justificativa Alto Custo: ${d?.name || "Medicamento"}`,
  transfer: (d) => `Transferência: ${d?.destination || "Setor"}`,
  discharge: () => "Sumário de Alta",
  nursing_note: () => "Anotação de Enfermagem",
  nursing_evolution: () => "Evolução de Enfermagem",
  vital_signs: () => "Registro de Sinais Vitais",
  diet_prescription: () => "Prescrição Dietética",
  rehab_evolution: () => "Evolução Fisioterapêutica",
  speech_eval: () => "Avaliação Fonoaudiológica",
  psych_eval: () => "Avaliação Psicológica",
  social_report: () => "Relatório Social",
  medical_evolution: (d) => `Evolução Médica${d?.sector ? ` — ${d.sector}` : ""}`,
  icu_evolution: () => "Evolução UTI",
  surgical_note: (d) => `Nota Operatória${d?.procedure ? `: ${d.procedure}` : ""}`,
  interconsult: (d) => `Interconsulta${d?.specialty ? `: ${d.specialty}` : ""}`,
  handoff_isbar: () => "Passagem de Plantão (ISBAR)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { consultation_id, patient_id, intents, transcription } = await req.json();

    if (!consultation_id || !intents || !Array.isArray(intents) || intents.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use the user's auth token from the request for RLS-aware queries
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get patient history for discharge summaries
    let patientHistory = "";
    if (patient_id && intents.some((i: any) => i.type === "discharge")) {
      const { data: consultations } = await supabase
        .from("consultations")
        .select("raw_transcription, edited_transcription, created_at, status")
        .eq("patient_id", patient_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (consultations?.length) {
        patientHistory = consultations
          .filter((c) => c.edited_transcription || c.raw_transcription)
          .map((c) => `[${new Date(c.created_at).toLocaleDateString("pt-BR")}] ${c.edited_transcription || c.raw_transcription}`)
          .join("\n\n");
      }
    }

    // Get auth user from the already-authenticated supabase client
    let userId = null;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    userId = authUser?.id;

    // Generate documents in parallel
    const documentPromises = intents.map(async (intent: any, index: number) => {
      const promptFn = DOCUMENT_PROMPTS[intent.type];
      if (!promptFn) return null;

      const prompt = promptFn(intent.details || {}, transcription || "", patientHistory);
      const titleFn = TITLE_MAP[intent.type];
      const title = titleFn ? titleFn(intent.details) : intent.type;

      try {
        const { content } = await aiCompleteJson({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Você é um assistente de saúde especializado em gerar documentos clínicos profissionais. Gere documentos completos, bem formatados e prontos para uso em português brasileiro.",
            },
            { role: "user", content: prompt },
          ],
        });

        // Save to clinical_reports
        const { data: report, error: insertError } = await supabase
          .from("clinical_reports")
          .insert({
            consultation_id,
            template_type: title,
            content,
            generated_by: userId,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to save document:", insertError.message);
        }

        return {
          id: report?.id || crypto.randomUUID(),
          type: intent.type,
          title,
          content,
          details: intent.details,
          is_controlled: intent.details?.is_controlled || false,
          suggest_dose: intent.details?.suggest_dose || false,
        };
      } catch (err) {
        console.error(`Error generating document for intent ${index}:`, err);
        return null;
      }
    });

    const results = await Promise.all(documentPromises);
    const documents = results.filter(Boolean);

    // Update consultation status
    await supabase.from("consultations").update({ status: "completed" }).eq("id", consultation_id);

    return new Response(JSON.stringify({ success: true, documents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-clinical-documents error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
