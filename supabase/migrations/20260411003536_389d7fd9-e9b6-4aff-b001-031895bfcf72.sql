
-- 1. Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fisioterapeuta';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nutricionista';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fonoaudiologo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'psicologo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistente_social';

-- 2. Add applicable_roles column to report_templates
ALTER TABLE public.report_templates ADD COLUMN IF NOT EXISTS applicable_roles text[] DEFAULT '{}';

-- 3. Seed templates for each professional role
INSERT INTO public.report_templates (name, description, prompt_template, applicable_roles, is_active) VALUES

-- MÉDICO
('Evolução Médica', 'Evolução clínica padrão para médicos', 'Você é um médico especialista. Com base na transcrição abaixo, gere uma EVOLUÇÃO MÉDICA estruturada com as seguintes seções:

## SUBJETIVO
- Queixa principal e HDA
- Sintomas referidos pelo paciente

## OBJETIVO
- Exame físico relevante
- Sinais vitais mencionados
- Resultados de exames

## AVALIAÇÃO
- Hipóteses diagnósticas
- Diagnósticos confirmados (CID-10 quando possível)

## PLANO
- Conduta terapêutica
- Medicações prescritas (dose, via, posologia)
- Exames solicitados
- Orientações ao paciente
- Retorno/seguimento

Transcrição: {{transcription}}', '{medico}', true),

('SOAP', 'Nota clínica no formato SOAP', 'Você é um médico. Gere uma nota clínica no formato SOAP com base na transcrição:

**S (Subjetivo):** Queixas do paciente, história da doença atual, antecedentes relevantes.

**O (Objetivo):** Exame físico, sinais vitais, exames complementares.

**A (Avaliação):** Diagnósticos e hipóteses diagnósticas com CID-10.

**P (Plano):** Conduta, prescrições, exames solicitados, orientações, retorno.

Transcrição: {{transcription}}', '{medico}', true),

('Nota de Alta', 'Sumário de alta hospitalar', 'Você é um médico. Gere uma NOTA DE ALTA HOSPITALAR completa:

1. **Identificação do paciente**
2. **Data de internação e alta**
3. **Diagnósticos** (principal e secundários com CID-10)
4. **Resumo da internação** (motivo, evolução, procedimentos realizados)
5. **Condições de alta** (exame físico resumido)
6. **Prescrição de alta** (medicações com dose, via e posologia)
7. **Orientações ao paciente/família**
8. **Seguimento** (retorno, encaminhamentos)

Transcrição: {{transcription}}', '{medico}', true),

('Prescrição Médica', 'Template para prescrição médica estruturada', 'Você é um médico. Com base na transcrição, gere uma PRESCRIÇÃO MÉDICA organizada:

1. Dieta
2. Hidratação venosa (se aplicável)
3. Medicações (nome genérico, dose, via, posologia, duração)
4. Cuidados de enfermagem
5. Sinais vitais e controles
6. Exames solicitados

Transcrição: {{transcription}}', '{medico}', true),

-- ENFERMEIRO
('Evolução de Enfermagem (SAE)', 'Sistematização da Assistência de Enfermagem com NANDA/NIC/NOC', 'Você é um enfermeiro especialista em SAE. Gere uma EVOLUÇÃO DE ENFERMAGEM com base na transcrição:

## COLETA DE DADOS
- Estado geral, nível de consciência, sinais vitais
- Avaliação por sistemas (neurológico, respiratório, cardiovascular, gastrointestinal, geniturinário, tegumentar, musculoesquelético)

## DIAGNÓSTICOS DE ENFERMAGEM (NANDA)
- Liste os diagnósticos de enfermagem identificados usando taxonomia NANDA-I

## RESULTADOS ESPERADOS (NOC)
- Resultados esperados para cada diagnóstico

## INTERVENÇÕES DE ENFERMAGEM (NIC)
- Intervenções planejadas com base na NIC

## AVALIAÇÃO
- Resposta do paciente às intervenções

Transcrição: {{transcription}}', '{enfermeiro}', true),

('Passagem de Plantão', 'Relatório estruturado para passagem de plantão', 'Você é um enfermeiro. Gere um relatório de PASSAGEM DE PLANTÃO usando o método SBAR:

**S (Situação):** Identificação, diagnóstico principal, motivo da internação.

**B (Background):** Antecedentes relevantes, alergias, medicações em uso.

**A (Avaliação):** Estado atual, sinais vitais, intercorrências no plantão, procedimentos realizados, drenos/dispositivos.

**R (Recomendação):** Pendências, exames aguardando resultado, cuidados especiais, atenção para o próximo plantão.

Transcrição: {{transcription}}', '{enfermeiro}', true),

-- FISIOTERAPEUTA
('Avaliação Funcional', 'Avaliação fisioterapêutica inicial', 'Você é um fisioterapeuta. Gere uma AVALIAÇÃO FUNCIONAL FISIOTERAPÊUTICA:

## ANAMNESE
- Queixa principal, HDA, antecedentes

## INSPEÇÃO E PALPAÇÃO
- Postura, deformidades, edema, trofismo

## AVALIAÇÃO RESPIRATÓRIA
- Padrão ventilatório, ausculta pulmonar, uso de musculatura acessória, SpO2, suporte ventilatório

## AVALIAÇÃO MOTORA
- Força muscular (escala MRC), amplitude de movimento, tônus, reflexos
- Mobilidade no leito, transferências, marcha

## AVALIAÇÃO FUNCIONAL
- Índice de Barthel ou MIF
- Nível de independência funcional

## DIAGNÓSTICO FISIOTERAPÊUTICO
- Problemas identificados

## PLANO TERAPÊUTICO
- Objetivos e condutas propostas

Transcrição: {{transcription}}', '{fisioterapeuta}', true),

('Evolução Fisioterapêutica', 'Evolução diária de fisioterapia', 'Você é um fisioterapeuta. Gere uma EVOLUÇÃO FISIOTERAPÊUTICA:

- **Estado geral:** Nível de consciência, cooperação, sinais vitais
- **Avaliação respiratória:** Padrão, ausculta, SpO2, VM (se aplicável: modo, parâmetros)
- **Avaliação motora:** Força, mobilidade, funcionalidade
- **Condutas realizadas:** Técnicas aplicadas, exercícios, mobilizações
- **Resposta ao tratamento:** Tolerância, evolução funcional
- **Plano:** Próximas condutas, metas

Transcrição: {{transcription}}', '{fisioterapeuta}', true),

-- TÉCNICO DE ENFERMAGEM
('Anotação de Enfermagem', 'Registro de cuidados pelo técnico de enfermagem', 'Você é um técnico de enfermagem. Gere uma ANOTAÇÃO DE ENFERMAGEM cronológica:

- Horário e cuidados realizados
- Sinais vitais (PA, FC, FR, Tax, SpO2, Dor)
- Estado geral do paciente
- Aceitação alimentar
- Eliminações (diurese, evacuação)
- Curativos realizados
- Medicações administradas
- Intercorrências e comunicados ao enfermeiro/médico
- Posicionamento e mudança de decúbito

Transcrição: {{transcription}}', '{tecnico}', true),

('Registro de Sinais Vitais', 'Organização de sinais vitais e balanço hídrico', 'Você é um técnico de enfermagem. Organize os dados em formato de REGISTRO DE SINAIS VITAIS:

| Horário | PA | FC | FR | Tax | SpO2 | Dor | Glicemia |
|---------|----|----|----|----|------|-----|----------|

- **Balanço hídrico:** Entradas (soros, medicações, dieta) vs Saídas (diurese, drenos, perdas insensíveis)
- **Observações:** Intercorrências, alterações relevantes

Transcrição: {{transcription}}', '{tecnico}', true),

-- NUTRICIONISTA
('Avaliação Nutricional', 'Triagem e avaliação nutricional completa', 'Você é um nutricionista clínico. Gere uma AVALIAÇÃO NUTRICIONAL:

## TRIAGEM NUTRICIONAL
- NRS-2002 ou ASG (Avaliação Subjetiva Global)

## ANAMNESE ALIMENTAR
- Histórico alimentar, alergias/intolerâncias, preferências
- Via de alimentação atual (oral, enteral, parenteral)

## AVALIAÇÃO ANTROPOMÉTRICA
- Peso, altura, IMC, CB, PCT, CMB (quando disponíveis)

## AVALIAÇÃO BIOQUÍMICA
- Albumina, pré-albumina, proteínas totais, eletrólitos relevantes

## DIAGNÓSTICO NUTRICIONAL
- Estado nutricional e classificação

## PRESCRIÇÃO DIETÉTICA
- Tipo de dieta, calorias, macro e micronutrientes
- Consistência, restrições, suplementos

## PLANO DE CUIDADO NUTRICIONAL
- Metas, monitoramento, reavaliação

Transcrição: {{transcription}}', '{nutricionista}', true),

('Prescrição Dietética', 'Prescrição de dieta hospitalar', 'Você é um nutricionista. Gere uma PRESCRIÇÃO DIETÉTICA:

- **Tipo de dieta:** (livre, branda, pastosa, líquida, enteral, parenteral)
- **Valor calórico:** kcal/dia
- **Distribuição de macronutrientes:** PTN, CHO, LIP (g/kg/dia)
- **Restrições:** (sódio, potássio, líquidos, glúten, lactose)
- **Consistência e fracionamento**
- **Suplementos:** (tipo, volume, horários)
- **Via de administração e velocidade** (se enteral/parenteral)
- **Observações especiais**

Transcrição: {{transcription}}', '{nutricionista}', true),

-- FONOAUDIÓLOGO
('Avaliação Fonoaudiológica', 'Avaliação clínica fonoaudiológica', 'Você é um fonoaudiólogo. Gere uma AVALIAÇÃO FONOAUDIOLÓGICA:

## ANAMNESE
- Queixa principal, HDA, antecedentes

## AVALIAÇÃO DE LINGUAGEM
- Compreensão, expressão, nomeação, repetição, fluência

## AVALIAÇÃO DE MOTRICIDADE OROFACIAL
- Lábios, língua, bochechas, palato, mandíbula, ATM

## AVALIAÇÃO DE DEGLUTIÇÃO
- Avaliação clínica funcional da deglutição
- Consistências testadas (líquido, néctar, mel, pudim, sólido)
- Sinais de aspiração, eficiência da deglutição
- Escala FOIS (Functional Oral Intake Scale)

## AVALIAÇÃO DE VOZ (se aplicável)
- Qualidade vocal, TMF, relação s/z

## DIAGNÓSTICO FONOAUDIOLÓGICO

## CONDUTA
- Orientações, exercícios, adaptações de dieta

Transcrição: {{transcription}}', '{fonoaudiologo}', true),

('Evolução Fonoaudiológica', 'Evolução diária de fonoaudiologia', 'Você é um fonoaudiólogo. Gere uma EVOLUÇÃO FONOAUDIOLÓGICA:

- **Estado geral e nível de consciência**
- **Avaliação da deglutição:** Consistências liberadas, sinais de disfagia
- **Linguagem/comunicação:** Evolução do quadro
- **Condutas realizadas:** Exercícios, manobras, treino de deglutição
- **Orientações à equipe:** Posicionamento para alimentação, espessamento, supervisão
- **Plano:** Próximas condutas e metas

Transcrição: {{transcription}}', '{fonoaudiologo}', true),

-- PSICÓLOGO
('Evolução Psicológica', 'Evolução de atendimento psicológico hospitalar', 'Você é um psicólogo hospitalar. Gere uma EVOLUÇÃO PSICOLÓGICA:

- **Demanda do atendimento:** (solicitação da equipe, busca espontânea, rotina)
- **Estado emocional:** Humor, afeto, ansiedade, sinais de sofrimento psíquico
- **Conteúdo do atendimento:** Temas abordados (sem quebrar sigilo terapêutico - seja genérico)
- **Recursos de enfrentamento:** Estratégias identificadas
- **Dinâmica familiar:** Rede de apoio, participação da família
- **Conduta:** Técnicas utilizadas, encaminhamentos
- **Plano:** Frequência de acompanhamento, metas terapêuticas

Transcrição: {{transcription}}', '{psicologo}', true),

('Avaliação Psicológica Hospitalar', 'Avaliação psicológica inicial', 'Você é um psicólogo hospitalar. Gere uma AVALIAÇÃO PSICOLÓGICA:

## DADOS DA AVALIAÇÃO
- Motivo do encaminhamento/internação

## HISTÓRIA PSICOLÓGICA
- Antecedentes psiquiátricos, uso de psicofármacos
- Eventos estressores recentes

## EXAME DO ESTADO MENTAL
- Aparência, comportamento, consciência, orientação
- Humor/afeto, pensamento, percepção, memória, juízo crítico

## AVALIAÇÃO EMOCIONAL
- Reação à hospitalização/diagnóstico
- Mecanismos de defesa e enfrentamento
- Rede de apoio social e familiar

## IMPRESSÃO DIAGNÓSTICA
- Hipóteses (CID-10 quando aplicável)

## CONDUTA E PLANO
- Intervenções propostas, frequência, encaminhamentos

Transcrição: {{transcription}}', '{psicologo}', true),

-- ASSISTENTE SOCIAL
('Relatório Social', 'Relatório de avaliação do Serviço Social', 'Você é um assistente social hospitalar. Gere um RELATÓRIO SOCIAL:

## IDENTIFICAÇÃO SOCIAL
- Composição familiar, moradia, renda, vínculo empregatício
- Rede de apoio social

## SITUAÇÃO SOCIAL
- Condições socioeconômicas
- Acesso a serviços de saúde e benefícios sociais
- Vulnerabilidades identificadas

## DEMANDAS IDENTIFICADAS
- Necessidades do paciente/família

## ENCAMINHAMENTOS E ORIENTAÇÕES
- Benefícios sociais (BPC, auxílio-doença, etc.)
- Rede de proteção social (CRAS, CREAS)
- Documentação necessária
- Articulação com a rede intersetorial

## PLANO DE INTERVENÇÃO
- Ações planejadas, prazos, acompanhamento

Transcrição: {{transcription}}', '{assistente_social}', true),

('Evolução Social', 'Evolução diária do Serviço Social', 'Você é um assistente social. Gere uma EVOLUÇÃO SOCIAL:

- **Demanda:** Motivo do atendimento
- **Atendimento realizado:** Abordagem ao paciente/família
- **Situação social:** Atualizações sobre condições socioeconômicas e familiares
- **Providências:** Contatos realizados, encaminhamentos, documentação
- **Pendências:** Ações em andamento
- **Plano:** Próximos passos e acompanhamento

Transcrição: {{transcription}}', '{assistente_social}', true);
