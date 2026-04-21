-- Add sector column to report_templates for sector-aware filtering
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS sector TEXT CHECK (sector IN ('uti', 'emergencia', 'enfermaria', 'ambulatorio'));

-- =====================================================================
-- SEED: Sector-aware templates + Ambulatory specialty templates
-- All inserts are additive (ON CONFLICT DO NOTHING as a safety guard)
-- =====================================================================

-- Avoid duplicate inserts on re-run
DO $$
BEGIN

-- -----------------------------------------------------------------------
-- UTI
-- -----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Evolução UTI — SOAP + Escores') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Evolução UTI — SOAP + Escores',
    'Evolução completa de UTI com SOFA, Glasgow, balanço hídrico e parâmetros ventilatórios',
    'Você é um médico intensivista. Gere uma EVOLUÇÃO DE UTI completa baseada na transcrição.

Inclua obrigatoriamente:
- Data/Hora | Setor: UTI | Leito
- Diagnóstico Principal (CID-10)
- Sedoanalgesia: drogas, doses, RASS, CAM-ICU
- Suporte Ventilatório: modo, FiO2, PEEP, volume corrente, SpO2 (ou "em ar ambiente")
- Hemodinâmica: PA, FC, vasopressores com dose e tendência (em redução/aumento/estável)
- Balanço Hídrico 24h: entrada / saída / balanço / acumulado
- Função Renal: ureia, creatinina, diurese (mL/kg/h), TRS se aplicável
- Neurológico: Glasgow, CAM-ICU, pupilas
- Escores: SOFA / APACHE II se disponíveis
- Microbiologia: culturas, antibiograma, antibiótico em uso e D+ de tratamento
- SOAP completo (S/O/A/P)
- Plano das próximas 24h

Use [NÃO INFORMADO] onde dados não estiverem na transcrição.

Exemplo de saída esperada:
---
13/04/2026 07:30 | UTI Adulto | Leito 4
Diagnóstico: Sepse por pneumonia (A41.9) + IRA (N17.9)
Sedoanalgesia: Propofol 20 mg/h + Fentanil 25 mcg/h | RASS: -2 | CAM-ICU: não avaliável
VM: PSV | FiO2 35% | PEEP 6 | PS 12 cmH2O | SpO2 97%
Hemodinâmica: PA 118/72 | FC 84 | Noradrenalina 0.08 mcg/kg/min (reduzindo)
BH 24h: E 2.800 mL | S 2.200 mL | Balanço +600 mL | Acumulado +5.200 mL
FR: Ureia 82 | Cr 2.8 | Diurese 0.6 mL/kg/h | Sem TRS no momento
Glasgow: E2V1M5 (sob sedação) | Pupilas isocóricas fotorreativas
SOFA: 9 pontos
Microbiologia: Hemocultura D2 — negativa | Secreção traqueal: E. coli (sensível a meropenem) | Meropenem D5/10
S: Paciente sedado, sem estímulo verbal. Família refere piora progressiva há 10 dias.
O: Dados acima. Abdome com peristalse presente, tônus normal.
A: Sepse pulmonar em tratamento. Desmame de vasopressor em andamento. IRA em recuperação.
P: Reduzir propofol para testar responsividade. Manter meropenem. Fisioterapia às 09h.
---

Transcrição: {{transcription}}',
    '{medico}', 'uti', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Passagem de Plantão UTI — ISBAR') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Passagem de Plantão UTI — ISBAR',
    'Passagem de plantão estruturada no formato ISBAR para UTI',
    'Você é um médico ou enfermeiro de UTI. Gere uma PASSAGEM DE PLANTÃO no formato ISBAR.

**I — IDENTIFICAÇÃO**
Paciente (nome, idade, sexo), leito, data de admissão na UTI, diagnóstico principal, profissional passando e recebendo plantão.

**S — SITUAÇÃO ATUAL**
Estado clínico atual, intercorrências das últimas horas, suportes em uso (VM, vasopressores, drenos), sinais vitais mais recentes.

**B — BACKGROUND**
Diagnóstico(s), comorbidades relevantes, motivo da admissão, evolução geral, procedimentos realizados, antibióticos em uso.

**A — AVALIAÇÃO**
Tendência clínica (melhora/piora/estável), problemas ativos, preocupações e pontos de atenção.

**R — RECOMENDAÇÕES**
Lista numerada de ações pendentes, ajustes prescritos, alertas para o próximo plantão, família a ser contatada.

Use [NÃO INFORMADO] onde dados estiverem ausentes.

Transcrição: {{transcription}}',
    '{medico,enfermeiro}', 'uti', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Anotação de Enfermagem UTI') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Anotação de Enfermagem UTI',
    'Registro de enfermagem específico para UTI com sinais vitais, drenos e dispositivos',
    'Você é um enfermeiro ou técnico de UTI. Gere uma ANOTAÇÃO DE ENFERMAGEM para paciente internado na UTI.

Inclua:
- Horário e turno
- Estado geral e nível de consciência
- Sinais vitais: PA, FC, FR, Tax, SpO2, Glasgow
- Suporte ventilatório: modo e parâmetros (se em VM) ou cateter/máscara (se respiração espontânea)
- Drogas vasoativas: nome e dose
- Acesso venoso: periférico/central/PAI — localização e permeabilidade
- Drenos e dispositivos: sonda vesical (volume urinário), sonda nasoenteral (volume e resíduo), drenos (características e volume)
- Curativo: localização, aspecto, procedimento realizado
- Medicações administradas: nome, dose, via, horário
- Dieta: tipo, volume administrado, tolerância
- Eliminações: diurese (mL/h), evacuação
- Intercorrências e comunicados à equipe médica
- Pendências para o próximo turno

Transcrição: {{transcription}}',
    '{enfermeiro,tecnico}', 'uti', true
  );
END IF;

-- -----------------------------------------------------------------------
-- EMERGÊNCIA
-- -----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Atendimento de Emergência — ABCDE') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Atendimento de Emergência — ABCDE',
    'Nota de atendimento de emergência com abordagem ABCDE e Manchester',
    'Você é um médico emergencista. Gere uma NOTA DE ATENDIMENTO DE EMERGÊNCIA.

Inclua:
1. **Triagem:** Horário de chegada, classificação Manchester (cor/prioridade), queixa de entrada
2. **Identificação:** Paciente, idade, acompanhante
3. **Queixa Principal e HDA:** Onset, localização, duração, intensidade, fatores de piora/melhora
4. **Antecedentes:** Comorbidades, medicações em uso, alergias, última refeição
5. **Abordagem ABCDE:**
   - A (Airway): via aérea pérvia? IOT necessária?
   - B (Breathing): FR, SpO2, ausculta, suporte O2 utilizado
   - C (Circulation): PA, FC, perfusão, acesso venoso, hidratação
   - D (Disability): Glasgow, glicemia capilar, pupilas
   - E (Exposure): temperatura, lesões, sangramento, outros achados
6. **Exames Solicitados**
7. **Condutas Realizadas:** Medicações, procedimentos
8. **Evolução no PS:** Resposta às medidas iniciais
9. **Decisão:** Alta, internação, transferência (com justificativa)
10. **Diagnóstico de Alta/Admissão (CID-10)**

Transcrição: {{transcription}}',
    '{medico}', 'emergencia', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Nota de Emergência — AVC') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Nota de Emergência — AVC',
    'Protocolo de atendimento ao AVC com NIHSS e janela terapêutica',
    'Você é um médico. Gere uma NOTA DE ATENDIMENTO DE AVC (Acidente Vascular Cerebral).

1. **Hora do Ictus:** (hora em que o paciente foi visto bem pela última vez)
2. **Hora de chegada ao PS**
3. **Janela Terapêutica:** (tempo decorrrido — < 4,5h para trombólise?)
4. **Sintomas:** Instalação (súbita/progressiva), déficits neurológicos (hemiplegia, afasia, disfagia, diplopia, ataxia)
5. **NIHSS Score:** (se informado; ou campos para preenchimento)
6. **Exame Neurológico:** Consciência (Glasgow), força, sensibilidade, linguagem, nervos cranianos
7. **Fatores de Risco:** HAS, DM, FA, tabagismo, AVC prévio, uso de anticoagulante
8. **Exames:** TC crânio, RNM, glicemia, coagulograma, ECG — resultados mencionados
9. **Conduta:** Trombólise IV (dose, contraindicações checadas), trombectomia, antiagregação
10. **Evolução:** Resposta ao tratamento, déficit neurológico pós-tratamento
11. **Diagnóstico:** AVC isquêmico (I63) ou hemorrágico (I61) com localização topográfica
12. **Destino:** UTI/AVC, enfermaria, transferência

Transcrição: {{transcription}}',
    '{medico}', 'emergencia', true
  );
END IF;

-- -----------------------------------------------------------------------
-- ENFERMARIA
-- -----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Evolução Médica — Enfermaria (SOAP)') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Evolução Médica — Enfermaria (SOAP)',
    'Evolução médica diária para paciente internado em enfermaria no formato SOAP com CID-10',
    'Você é um médico. Gere uma EVOLUÇÃO MÉDICA DIÁRIA em formato SOAP para paciente em enfermaria.

**S (Subjetivo):**
Queixas do dia, sintomas referidos, como o paciente se sente, relato de dor (localização, intensidade EVA 0-10), sono, apetite.

**O (Objetivo):**
- Sinais vitais: PA | FC | FR | Tax | SpO2 | Peso
- Exame físico geral e dos sistemas envolvidos
- Resultados de exames do dia

**A (Avaliação):**
- Diagnóstico principal e secundários (CID-10)
- Situação clínica: estável / em melhora / em piora
- Problemas ativos

**P (Plano):**
- Ajustes de medicação (com doses)
- Novos exames solicitados
- Condutas não-farmacológicas (fisioterapia, dieta, deambulação)
- Pendências
- Previsão de alta (se aplicável)

Use [NÃO INFORMADO] para campos não mencionados.
Exemplo de saída:
S: Paciente refere melhora da dispneia. Dor torácica 3/10 em repouso. Aceitando dieta oral.
O: PA 128/76 | FC 80 | FR 16 | Tax 36.7 | SpO2 96% aa | Peso 72 kg. MV bilateral sem ruídos. Abdome flácido, RHA+.
A: ICC descompensada (I50.0) em regressão. Estável.
P: Manter furosemida 40 mg VO 2x/dia. Restrição hídrica 1.5L/dia. Pesar amanhã. Ecocardiograma solicitado.

Transcrição: {{transcription}}',
    '{medico}', 'enfermaria', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Nota de Alta — Enfermaria') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Nota de Alta — Enfermaria',
    'Sumário de alta hospitalar completo com prescrição domiciliar e orientações',
    'Você é um médico. Gere um SUMÁRIO DE ALTA HOSPITALAR completo.

1. **IDENTIFICAÇÃO**
   - Paciente, idade, sexo, data de internação, data de alta, dias de internação

2. **DIAGNÓSTICOS**
   - Principal (com CID-10)
   - Secundários (com CID-10)

3. **MOTIVO DA INTERNAÇÃO**
   - Queixa principal e HDA resumida

4. **RESUMO DA INTERNAÇÃO**
   - Evolução cronológica, exames realizados e resultados principais, procedimentos
   - Complicações durante a internação (se houver)

5. **CONDIÇÃO NA ALTA**
   - Estado geral, sinais vitais, exame físico resumido
   - Critério de alta utilizado

6. **PRESCRIÇÃO DE ALTA**
   - Lista de medicamentos: nome genérico, dose, posologia, duração
   - Dieta e restrições
   - Atividade física e cuidados especiais

7. **ORIENTAÇÕES AO PACIENTE/FAMÍLIA**
   - Cuidados em casa
   - Sinais de alerta para retornar à emergência

8. **ACOMPANHAMENTO**
   - Retorno em: [data/prazo]
   - Encaminhamentos para especialistas
   - Exames a realizar antes do retorno

Transcrição: {{transcription}}',
    '{medico}', 'enfermaria', true
  );
END IF;

-- -----------------------------------------------------------------------
-- AMBULATÓRIO — Templates por especialidade
-- -----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Cardiologia') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Cardiologia',
    'Consulta cardiológica com foco em IC, DAC, arritmias, HAS e valvopatias',
    'Você é um cardiologista. Gere um RELATÓRIO DE CONSULTA CARDIOLÓGICA baseado na transcrição.

**1. IDENTIFICAÇÃO:** Paciente, {{patient_name}}, data {{date}}

**2. QUEIXA PRINCIPAL E HDA:**
Sintomas cardiológicos: dispneia (classe NYHA se IC), dor torácica (características, fatores desencadeantes, irradiação), palpitações, síncope, edema (localização e intensidade), ortopneia, dispneia paroxística noturna.

**3. ANTECEDENTES CARDIOVASCULARES:**
- Comorbidades: HAS, DM, Dislipidemia, Tabagismo, Obesidade, FA, ICC, DAC, AVC, TEP
- Cirurgias cardíacas, stents, marca-passo
- Histórico familiar (DAC prematura < 55H / <65M)
- Score de risco cardiovascular (Framingham/SCORE) se calculável

**4. MEDICAÇÕES EM USO:**
- Listar com doses (especialmente: betabloqueadores, IECA/BRA, diuréticos, anticoagulantes, antiplaquetários, estatinas)

**5. EXAME FÍSICO CARDIOVASCULAR:**
- PA (ambos os braços se primeira consulta), FC, FR, SpO2
- Ausculta cardíaca: ritmo, bulhas, sopros (grau/localização/irradiação)
- Ausculta pulmonar: crepitações, sibilos
- Pulsos periféricos, TEC
- Edema (graduação 0-4+), turgência jugular, hepatomegalia
- Peso e IMC

**6. EXAMES COMPLEMENTARES:**
- ECG: ritmo, FC, eixo, intervalo PR/QRS/QTc, alterações de ST, BRE/BRD, HVE
- Ecocardiograma: FE (%), DDVE, DSVE, valvas, alterações
- Laboratório: BNP/NT-proBNP, troponina, lipidograma, glicemia, creatinina, eletrólitos, TSH
- Holter/TILT/EEF se aplicável

**7. IMPRESSÃO DIAGNÓSTICA (CID-10):**
- Diagnóstico principal e secundários

**8. CONDUTA:**
- Ajuste de medicações (com doses)
- Novos exames
- Encaminhamentos (hemodinâmica, cirurgia, EP)
- Implante de dispositivo (se indicado)
- Orientações: dieta hipossódica, restrição hídrica, controle de peso, atividade física, cessação de tabagismo

**9. ALERTAS CLÍNICOS:**
- Sinais de alarme que devem motivar consulta/emergência imediata

**10. RETORNO:** [prazo]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Pneumologia') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Pneumologia',
    'Consulta pneumológica com foco em DPOC, asma, pneumonias e doenças pulmonares crônicas',
    'Você é um pneumologista. Gere um RELATÓRIO DE CONSULTA PNEUMOLÓGICA.

**1. IDENTIFICAÇÃO:** {{patient_name}}, data {{date}}

**2. QUEIXA PRINCIPAL:**
Tosse (características: seca/produtiva, duração, expectoração — volume, cor, hemoptise), dispneia (escala MRC 0-4), sibilância, dor torácica, febre.

**3. HDA E ANTECEDENTES:**
- Tabagismo (maços/ano, ex-tabagista há quanto tempo)
- Exposições ocupacionais (pó, fumaça, sílica, amianto)
- DPOC (GOLD I-IV), asma (controlada/parcialmente controlada/não controlada)
- Exacerbações no último ano: número, internações
- TB prévia, pneumonias de repetição, bronquiectasias
- Alergias e atopia

**4. MEDICAÇÕES EM USO:**
LABA, LAMA, CIE, SABA (resgate), teofilina, montelucaste, imunobiológicos

**5. EXAME FÍSICO PULMONAR:**
- Frequência respiratória, SpO2 (em ar ambiente), uso de musculatura acessória
- Padrão ventilatório, expansibilidade torácica
- Percussão (timpanismo, macicez)
- Ausculta: MV presente/diminuído, crepitações, sibilos (inspiratório/expiratório), roncos
- Hipocratismo digital, cianose

**6. EXAMES COMPLEMENTARES:**
- Espirometria: CVF, VEF1, VEF1/CVF, resposta ao broncodilatador
- TC de tórax: padrão (hiperinsuflação, bronquiectasias, áreas de consolidação, nódulos)
- Gasometria arterial: PaO2, PaCO2, pH, HCO3
- Oximetria de esforço

**7. DIAGNÓSTICO (CID-10) E ESTADIAMENTO**

**8. CONDUTA:**
- Escalonamento/desescalonamento de broncodilatadores
- Corticoide inalatório
- Oxigenoterapia domiciliar (se SpO2 ≤ 88% em repouso)
- Vacinação (influenza, pneumocócica)
- Reabilitação pulmonar
- Orientações: cessação de tabagismo, técnica inalatória

**9. RETORNO:** [prazo]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Neurologia') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Neurologia',
    'Consulta neurológica com exame neurológico estruturado e hipóteses topográficas',
    'Você é um neurologista. Gere um RELATÓRIO DE CONSULTA NEUROLÓGICA.

**1. IDENTIFICAÇÃO:** {{patient_name}}, data {{date}}

**2. QUEIXA PRINCIPAL E HDA:**
Cefaleia (localização, caráter, duração, frequência, intensidade EVA, fatores desencadeantes, aura), tontura/vertigem, déficit motor/sensitivo, alteração de consciência, epilepsia (tipo, frequência, última crise, medicação), tremor, marcha, distúrbio cognitivo, alteração visual/auditiva, disfagia, disartria.

**3. ANTECEDENTES:**
- AVC, TCE, neoplasia SNC, infecções do SNC
- Diabetes, HAS (risco de AVC), tabagismo
- Histórico familiar (epilepsia, esclerose múltipla, ataxias hereditárias, demência)

**4. MEDICAÇÕES NEUROLÓGICAS EM USO:**
Antiepilépticos (com doses), antiparkinsonianos, antienxaquecosos, antivertiginosos, anticoagulantes

**5. EXAME NEUROLÓGICO:**
- Cognição: orientação T/E, memória, linguagem, praxis (Mini-Mental ou MoCA se realizado)
- Nervos cranianos (II-XII): nomear alterações encontradas
- Motor: força muscular (escala MRC 0-5), tônus, reflexos tendinosos (0 a 4+), clonus, Babinski
- Sensitivo: tato, dor, propriocepção, vibração
- Cerebelo: disdiadococinesia, Romberg, marcha, nistagmo
- Marcha e equilíbrio: TUG (Timed Up and Go) se realizado

**6. EXAMES COMPLEMENTARES:**
- RNM/TC crânio: achados principais
- EEG: ritmo de base, descargas epileptiformes
- Laboratório: glicemia, B12, TSH, VDRL, hemograma (causas reversíveis de demência)
- LCR (se realizado): proteína, glicose, células, bandas oligoclonais

**7. HIPÓTESE TOPOGRÁFICA E DIAGNÓSTICO (CID-10)**

**8. CONDUTA:**
- Ajuste de antiepiléptico (com meta de nível sérico)
- Solicitação de exames
- Encaminhamento (neurorraquio, neurocirurgia, neuro-oncologia)
- Orientações: restrição de dirigir (epilepsia), quedas (distúrbio de marcha)

**9. RETORNO:** [prazo]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Ortopedia') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Ortopedia',
    'Consulta ortopédica com exame musculoesquelético estruturado e condutas',
    'Você é um ortopedista. Gere um RELATÓRIO DE CONSULTA ORTOPÉDICA.

**1. IDENTIFICAÇÃO:** {{patient_name}}, data {{date}}

**2. QUEIXA PRINCIPAL E HDA:**
Localização da dor/lesão (articulação, segmento), caráter (mecânica/inflamatória), intensidade (EVA 0-10), duração, mecanismo de trauma (se traumático), limitação funcional, bloqueio articular, instabilidade, deformidade.

**3. ANTECEDENTES:**
- Cirurgias ortopédicas prévias
- Osteoporose, artrite/artrose, DM (pé diabético), neoplasia
- Atividade física, profissão (movimentos repetitivos, esforço físico)
- Medicamentos: AINEs, corticosteróides, bisfosfonatos

**4. EXAME FÍSICO ORTOPÉDICO:**
- Inspeção: postura, marcha, deformidades, atrofias, edema, equimoses
- Palpação: pontos dolorosos, derrame articular, instabilidade ligamentar
- Mobilidade articular (ativa e passiva): graus de amplitude
- Testes especiais (nomear): Lachman, McMurray, Neer, Phalen, FABER/FADIR, etc.
- Avaliação neurovascular distal: pulsos, sensibilidade, força motora distal

**5. EXAMES DE IMAGEM:**
- Radiografia: alinhamento, densidade óssea, linha articular, osteofitos, fraturas
- RNM/TC: lesões de partes moles, menisco, ligamentos, cartilagem
- Densitometria óssea (T-score se disponível)

**6. DIAGNÓSTICO (CID-10):**
Principal e secundários

**7. CONDUTA:**
- Conservador: fisioterapia (especificar), órtese, analgesia (nome, dose, posologia)
- Infiltração: local, substância
- Cirúrgico: indicação, técnica (se decisão tomada)
- Orientações: proteção de carga, exercícios, uso de bengala/muleta

**8. RETORNO / CIRURGIA AGENDADA:** [prazo/data]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Clínica Geral / Medicina Interna') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Clínica Geral / Medicina Interna',
    'Consulta de clínica geral para internação, ambulatório geral e medicina de família',
    'Você é um clínico geral / médico de medicina interna. Gere um RELATÓRIO DE CONSULTA CLÍNICA GERAL.

**1. IDENTIFICAÇÃO:** {{patient_name}}, data {{date}}

**2. QUEIXA PRINCIPAL E HDA:**
Onset, evolução, sintomas associados, fatores de melhora e piora.

**3. ANTECEDENTES PESSOAIS:**
- Comorbidades e doenças crônicas
- Cirurgias e internações prévias
- Alergias medicamentosas
- Medicações em uso (com doses)
- Imunizações

**4. ANTECEDENTES FAMILIARES:** Doenças relevantes (HAS, DM, neoplasias, cardiopatias)

**5. HISTÓRIA SOCIAL:** Profissão, tabagismo, etilismo, drogas, atividade física

**6. REVISÃO DE SISTEMAS:**
Cardiovascular, pulmonar, digestivo, urinário, neurológico, musculoesquelético, pele

**7. EXAME FÍSICO:**
- Dados vitais: PA, FC, FR, Tax, SpO2, Peso, Altura, IMC
- Estado geral, hidratação, coloração
- Cabeça/pescoço: tireoide, adenomegalias, jugular
- Cardiovascular: ritmo, bulhas, sopros, edema
- Pulmonar: ausculta, padrão
- Abdome: RHA, dor, hepatoesplenomegalia, ascite
- Extremidades e pele

**8. EXAMES COMPLEMENTARES:**
Hemograma, glicemia, perfil lipídico, função renal/hepática, TSH, urina I — resultados se disponíveis

**9. IMPRESSÃO DIAGNÓSTICA (CID-10)**

**10. CONDUTA:**
- Medicações (nome genérico, dose, posologia, duração)
- Exames solicitados
- Encaminhamentos para especialistas
- Orientações: dieta, exercício, cessação de tabagismo, vacinação

**11. RETORNO:** [prazo]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Pediatria') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Pediatria',
    'Consulta pediátrica com avaliação do crescimento, desenvolvimento e saúde da criança',
    'Você é um pediatra. Gere um RELATÓRIO DE CONSULTA PEDIÁTRICA.

**1. IDENTIFICAÇÃO:** {{patient_name}}, data {{date}}
   - Idade (anos/meses/dias), sexo, responsável

**2. QUEIXA PRINCIPAL E HDA:**
Descrição pelos pais/responsável: onset, evolução, febre (duração, grau), sintomas respiratórios (tosse, coriza, stridor, tiragem), GI (vômitos, diarreia — frequência/consistência, desidratação), neurológicos (irritabilidade, prostração, convulsão), cutâneos (rash — localização, aspecto).

**3. ANTECEDENTES:**
- Pré-natal: GIG/PIG/AIG, idade gestacional, intercorrências gestacionais
- Parto: normal/cesárea, APGAR, UTI neonatal
- Aleitamento: materno (duração) ou fórmula
- Desenvolvimento neuropsicomotor: marcos (sustento da cabeça, sentar, andar, primeiras palavras)
- Vacinação: Cartão de vacinas atualizado? (S/N; vacinas em atraso)
- Cirurgias, internações, alergias, medicamentos em uso crônico

**4. AVALIAÇÃO DO CRESCIMENTO (curvas OMS):**
- Peso: ___ kg | Percentil: ___
- Estatura: ___ cm | Percentil: ___
- PC: ___ cm (se < 2 anos) | Percentil: ___
- Classificação: eutrófico / desnutrido / sobrepeso / obeso

**5. DESENVOLVIMENTO:**
- Marcos presentes para a idade?
- Denver / Escala de Gesell (se realizado)
- Escolar: desempenho, comportamento

**6. EXAME FÍSICO:**
- Estado geral, hidratação, coloração (icterícia, cianose, palidez), choro, fontanela
- Cabeça/pescoço: otoscopia (se indicada), orofaringe, adenomegalias
- Cardiovascular e pulmonar: bulhas, sopro, FR, SpO2, tiragem
- Abdome: distensão, dor, hepatoesplenomegalia
- Pele: rash, exantema (tipo e distribuição)
- Neurológico: tônus, reflexos, focalização

**7. EXAMES COMPLEMENTARES:** (se solicitados/disponíveis)

**8. DIAGNÓSTICO (CID-10)**

**9. CONDUTA:**
- Medicações (dose/kg/dia, posologia, duração) — usar nomes genéricos e dose pediátrica
- Orientações: hidratação, dieta, febre
- Retorno imediato se: (sinais de alarme específicos para o diagnóstico)
- Vacinas em atraso a administrar
- Encaminhamentos (se necessário)

**10. RETORNO:** [prazo]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Consulta Ambulatorial — Geriatria') THEN
  INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, sector, is_active)
  VALUES (
    'Consulta Ambulatorial — Geriatria',
    'Consulta geriátrica com avaliação funcional, cognitiva, quedas e polifarmácia',
    'Você é um geriatra. Gere um RELATÓRIO DE CONSULTA GERIÁTRICA.

**1. IDENTIFICAÇÃO:** {{patient_name}}, data {{date}}
   - Idade, moradia (com família/sozinho/ILPI), cuidador (S/N), nível educacional

**2. QUEIXA PRINCIPAL E SÍNDROME GERIÁTRICA:**
Identificar síndrome geriátrica predominante: queda, imobilidade, incontinência, iatrogenia, insuficiência cognitiva, instabilidade do humor, úlcera de pressão, inapetência.

**3. HDA E ANTECEDENTES:**
- Multimorbidade: listar todas as doenças crônicas
- Hospitalizações no último ano
- Cirurgias recentes

**4. AVALIAÇÃO FUNCIONAL:**
- ABVD (Katz Index — 0-6): banho, vestuário, toilete, transferência, continência, alimentação
- AIVD (Lawton — 0-8): telefone, compras, preparo de refeições, tarefas domésticas, transporte, medicações, finanças
- Classificação: independente / dependente parcial / dependente total

**5. AVALIAÇÃO COGNITIVA:**
- Mini-Mental (MEEM): ___/30 — suspeita de demência se < 24 (escolaridade-ajustado)
- Relógio (CDT): normal / alterado
- Fluência verbal (FAS ou animais): ___
- GDS-15 (depressão): ___/15

**6. POLIFARMÁCIA E MEDICAÇÕES:**
- Listar TODOS os medicamentos com doses
- Critérios de Beers / STOPP-START: medicamentos potencialmente inapropriados para idosos?
- Cascade prescritiva: algum medicamento prescrito para tratar efeito adverso de outro?

**7. AVALIAÇÃO DE QUEDAS:**
- Número de quedas no último ano
- Medo de cair
- TUG (Timed Up and Go): ___ segundos (normal < 12s)
- Força de preensão palmar (dinamometria) se realizada

**8. AVALIAÇÃO NUTRICIONAL:**
- MNA (Mini Nutritional Assessment): ___/30
- Perda de peso recente (> 5% em 6 meses?)
- IMC atual

**9. EXAME FÍSICO:**
- PA (sentado e ortostática — hipotensão ortostática)
- Visão e audição (déficits identificados)
- Marcha e equilíbrio: tipo de marcha, uso de dispositivo auxiliar
- Cavidade oral: dentição, prótese dental
- Pele: úlceras de pressão (localização, estadiamento)

**10. DIAGNÓSTICO PRINCIPAL E SÍNDROMES GERIÁTRICAS (CID-10)**

**11. CONDUTA:**
- Deprescriçao (medicamentos a retirar/substituir)
- Novos medicamentos (avaliar interações e dose ajustada para idoso)
- Fisioterapia: treino de equilíbrio, marcha, resistência
- Terapia Ocupacional: adaptações domiciliares para prevenção de quedas
- Fonoaudiologia: se disfagia ou alteração de linguagem
- Orientações para cuidador/família
- Rede de suporte (CRAS, ILPI se necessário)

**12. RETORNO:** [prazo]

Transcrição: {{transcription}}',
    '{medico}', 'ambulatorio', true
  );
END IF;

END $$;
