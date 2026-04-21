/**
 * Clinical scenario fixtures for audio simulation tests.
 *
 * Each scenario has:
 *  - transcriptionAccurate: clean ASR output (deterministic mode)
 *  - transcriptionNoisy:    realistic ASR with hesitations, medical misspellings, filler words
 *  - expectedIntents:       intent types that MUST be detected from this transcription
 *  - expectedMissingFields: fields the guided-mode completeness check should flag
 */

export type Sector = "uti" | "emergencia" | "enfermaria" | "ambulatorio";
export type Complexity = "low" | "med" | "high";

export interface PatientData {
  name: string;
  age: number;
  sex: "M" | "F";
  bed?: string;
  mrn?: string; // fake chart number
}

export interface ClinicalScenario {
  id: string;
  title: string;
  sector: Sector;
  specialty: string;
  complexity: Complexity;
  patientData: PatientData;
  transcriptionAccurate: string;
  transcriptionNoisy: string;
  expectedIntents: string[];
  expectedMissingFields?: string[];
}

// ---------------------------------------------------------------------------
// UTI SCENARIOS
// ---------------------------------------------------------------------------

const SCENARIO_UTI_SEPSE: ClinicalScenario = {
  id: "uti-sepse-01",
  title: "Sepse por foco pulmonar — UTI",
  sector: "uti",
  specialty: "Terapia Intensiva",
  complexity: "high",
  patientData: { name: "Carlos Eduardo Mendes", age: 68, sex: "M", bed: "UTI 3", mrn: "123456" },
  transcriptionAccurate: `Fazendo evolução do Carlos, leito três da UTI. Paciente de sessenta e oito anos, masculino, internado há quatro dias com diagnóstico de pneumonia bacteriana com sepse associada, CID J18 ponto zero.

Subjetivo: paciente sedado, RASS menos dois, não responde a estímulos verbais. Família relata que ele teve piora progressiva da dispneia há uma semana antes da internação.

Objetivo: pressão arterial cento e dez por setenta e dois, frequência cardíaca noventa e dois batimentos por minuto, temperatura trinta e seis vírgula oito, saturação noventa e oito por cento em ventilação mecânica. Modo ventilação assistida controlada por pressão, FiO2 quarenta por cento, PEEP oito, pressão de suporte quinze, volume corrente medido quatrocentos e vinte mililitros, frequência de quatorze por minuto. Hemodinâmica: sem vasopressor nas últimas seis horas. Balanço hídrico nas últimas vinte e quatro horas: entrada dois mil e oitocentos mililitros, saída dois mil e duzentos mililitros, balanço positivo de seiscentos mililitros, acumulado desde a admissão positivo cinco mil e duzentos mililitros. Função renal: ureia oitenta e dois, creatinina dois vírgula oito, diurese zero vírgula seis mililitros por quilo por hora, sem terapia renal substitutiva no momento. Glasgow: sedado, E2V1M5. Escore SOFA nove pontos. Microbiologia: hemocultura de ontem negativa, cultura de secreção traqueal mostrando Klebsiella pneumoniae sensível ao meropenem, paciente em meropenem dia cinco de dez.

Avaliação: sepse de foco pulmonar em tratamento com resposta parcial ao antibiótico. Sem vasopressor há seis horas, hemodinamicamente estável. Função renal com melhora discreta em relação a ontem.

Plano: reduzir sedação progressivamente para tentativa de desmame ventilatório amanhã. Manter meropenem por mais cinco dias. Fisioterapia motora precoce às nove horas. Solicitar gasometria arterial às quatorze horas. Repetir hemograma e PCR amanhã.`,

  transcriptionNoisy: `Ehn... fazendo evolução do Carlos, leito... leito três da UTI. Paciente de... sessenta e oito anos, sexo masculino, internado... internado há quatro dias com diagnóstico de... pneumônia... pneumonia bacteriana com sepse associada, CID J... J dezoito ponto zero.

Subjetivo: paciente sedado, ras... RASS menos dois, não responsivo. Familia... família relata que ele teve piora progressiva da... da dispneia há uma semana.

Objetivo: PA cento e dez por setenta e dois, FC noventa e dois, temperatura... trinta e seis vírgula oito, saturação noventa e oito em... ventilação mecânica. Modo... modo assistida controlada por pressão, FiO dois quarenta por cento, pepe oito, suporte quinze, volume corrente medido quatrocentos e vinte mililitros, frequência quatorze. Sem vasopressor nas últimas... seis horas. Balanço hídrico vinte e quatro horas: entrada dois mil e oitocentos, saída dois mil e duzentos, balanço... balanço positivo seiscentos, acumulado positivo cinco mil e duzentos. Ureia... ureia oitenta e dois, creatinina dois ponto oito, diurese zero vírgula seis por quilo por hora. Glasgow... glasgow sedado. SOFA nove. Cultura... cultura de traqueias... traqueal klebsiela... klebsiella pneumonia... pneumoniae sensível ao meropenen... meropenem, dia cinco de dez.

Avaliação: sepse pulmonar em tratamento, hemodinamicamente estável.

Plano: reduzir sedação, manter... manter meropenem mais cinco dias. Fisioterapia às nove. Solicitar gasometria às quatorze horas.`,

  expectedIntents: ["icu_evolution", "medical_evolution"],
  expectedMissingFields: [],
};

const SCENARIO_UTI_IAM: ClinicalScenario = {
  id: "uti-iam-02",
  title: "IAM extenso + choque cardiogênico — UTI",
  sector: "uti",
  specialty: "Cardiologia / Terapia Intensiva",
  complexity: "high",
  patientData: { name: "Roberto Alves Ferreira", age: 72, sex: "M", bed: "UTI 1", mrn: "789012" },
  transcriptionAccurate: `Evolução do Roberto, leito um da UTI, setenta e dois anos, internado ontem após IAM extenso anterior com supradesnivelamento de ST, submetido a angioplastia primária da descendente anterior, com resultado TIMI três. Evoluiu com choque cardiogênico no pós-operatório imediato, requerendo suporte com noradrenalina e dobutamina.

Subjetivo: paciente sedado com RASS menos três, sem comunicação verbal.

Objetivo: pressão arterial setenta e oito por cinquenta e dois sob noradrenalina zero vírgula trinta e cinco microgramas por quilo por minuto mais dobutamina cinco microgramas por quilo por minuto. Frequência cardíaca cento e dez batimentos por minuto, ritmo sinusal. Saturação noventa e cinco por cento em FiO2 sessenta por cento, PEEP dez. Temperatura trinta e sete ponto dois. Balanço hídrico: entrada três mil e quinhentos, saída mil e duzentos, balanço positivo dois mil e trezentos. Creatinina dois ponto um, ureia sessenta e quatro, troponina pico de oitocentos e quarenta e dois. Ecocardiograma de urgência: fração de ejeção dezoito por cento, acinesia anterior extensa.

Avaliação: choque cardiogênico pós-IAM anterior extenso. Hemodinamicamente instável com dupla vasopressora. Risco de falência orgânica.

Plano: aumentar dobutamina para dez microgramas por quilo por minuto. Chamar cardiologia intervencionista para avaliar indicação de balão intra-aórtico ou ECMO. Solicitar lactato arterial. Repetir ecocardiograma em doze horas. Consultar cirurgia cardíaca.`,

  transcriptionNoisy: `Ehn... evolução do Roberto, leito um, setenta e dois anos, internou... internado ontem. IAM... IAM anterior extenso com... com supra de ST, fez angioplastia da... da descendente anterior, TIMI três. Evoluiu... evoluiu com choque cardiogênico pós... pós-operatório imediato, noradrenalina e... e dobutamina em curso.

Objetivo: PA setenta e oito por cinquenta e dois, noradr... noradrenalina zero vírgula trinta e cinco mais dobu... dobutamina cinco. FC cento e dez, sinusal. Saturação noventa e cinco, FiO dois sessenta, PEEP dez. BH: entrada três mil e quinhentos, saída mil e duzentos. Creatinina dois ponto um. Troponina... pico de... oitocentos e quarenta. Eco: fração de ejeção... dezoito por cento, acinesia anterior.

Avaliação: choque cardiogênico pós IAM.

Plano: aumentar dobutamina pra dez. Chamar cardiologia... cardiologia intervencionista pra avaliar ECMO ou... ou balão. Solicitar lactato. Interconsulta com cirurgia cardíaca.`,

  expectedIntents: ["icu_evolution", "medical_evolution", "exam_request", "interconsult"],
  expectedMissingFields: [],
};

const SCENARIO_UTI_PNEUMONIA: ClinicalScenario = {
  id: "uti-pneumonia-12",
  title: "Pneumonia grave (CURB-65 alto) — UTI",
  sector: "uti",
  specialty: "Pneumologia / Terapia Intensiva",
  complexity: "high",
  patientData: { name: "Maria Aparecida Santos", age: 81, sex: "F", bed: "UTI 5", mrn: "345678" },
  transcriptionAccurate: `Evolução da dona Maria Aparecida, leito cinco, oitenta e um anos, internada há dois dias com pneumonia bilateral grave, CURB-65 quatro pontos.

Subjetivo: paciente em ventilação não invasiva, consegue responder por acenos. Refere melhora da dispneia em relação a ontem.

Objetivo: pressão arterial cento e trinta por oitenta, frequência cardíaca oitenta e quatro, temperatura trinta e seis vírgula cinco, saturação noventa e seis por cento em VNI com FiO2 quarenta por cento e PEEP seis. Frequência respiratória vinte por minuto sem tiragem. Ausculta: crepitações bilaterais em bases, menos intensas que ontem. PCR quinze, leucócitos doze mil com desvio. Antibiótico: ceftriaxona mais azitromicina, dia dois.

Avaliação: pneumonia bilateral grave em melhora com VNI. Sem necessidade de intubação no momento.

Plano: manter VNI. Se saturação cair abaixo de noventa e dois, intubar e ventilar de forma protetora. Solicitar radiografia de tórax controle. Fisioterapia respiratória duas vezes ao dia.`,

  transcriptionNoisy: `Evolução da... dona Maria Aparecida, leito cinco. Oitenta e um anos. Pneumonia bilateral grave, curb... CURB-65 quatro pontos, dia dois de internação.

Objetivo: PA cento e trinta por oitenta, FC oitenta e quatro, temperatura trinta e seis cinco, saturação noventa e seis na... VNI, FiO dois quarenta por cento, PEEP seis. FR vinte por minuto. Ausculta... crepitações bilaterais em bases, menos que ontem. PCR quinze, leucócitos doze mil com desvio. Ceftriaxona mais azitromicina, dia dois.

Avaliação: melhora com VNI.

Plano: manter VNI, intubar se saturação cair de noventa e dois. Raio-x de controle. Fisioterapia dois vezes ao dia.`,

  expectedIntents: ["icu_evolution", "medical_evolution", "exam_request"],
  expectedMissingFields: [],
};

// ---------------------------------------------------------------------------
// EMERGÊNCIA SCENARIOS
// ---------------------------------------------------------------------------

const SCENARIO_EMER_POLITRAUMA: ClinicalScenario = {
  id: "emer-politrauma-03",
  title: "Politrauma (TCE + fratura) — Emergência",
  sector: "emergencia",
  specialty: "Cirurgia de Trauma / Emergência",
  complexity: "high",
  patientData: { name: "Lucas Martins Carvalho", age: 28, sex: "M", bed: "Trauma 1", mrn: "901234" },
  transcriptionAccurate: `Atendimento do Lucas, vinte e oito anos, masculino, trazido pelo SAMU após acidente de motocicleta sem capacete. Triagem laranja, urgente.

Subjetivo: paciente agitado, escala de dor EVA dez, não obedece a comandos.

Objetivo pela abordagem ABCDE: via aérea pérvia com ronco, decidimos intubar, Glasgow seis, E1V2M3. Breathing: frequência respiratória vinte e oito, saturação noventa por cento em ar ambiente, decidimos ventilar com balão máscara antes de intubar. Circulação: pressão arterial noventa por sessenta, FC cento e vinte, dois acessos venosos calibrosos, iniciamos ressuscitação com ringer lactato mil mililitros. Disability: Glasgow seis, pupilas anisocóricas, direita midriática não reativa, suspeita de herniação. Exposure: fratura de fêmur direito com deformidade visível, laceração em couro cabeludo com sangramento ativo, sem sangramento abdominal à inspeção.

Avaliação: politrauma grave com TCE grave e fratura de fêmur. Glasgow seis sugere lesão cerebral grave.

Plano: intubação de sequência rápida com quetamina e succinilcolina. Tomografia de crânio, cervical e abdome com contraste após estabilização. Acionar neurocirurgia e ortopedia urgência. Transfusão de concentrado de hemácias dois unidades. Imobilizar fratura de fêmur com tração.`,

  transcriptionNoisy: `Lucas... Lucas Martins, vinte e oito anos. Acidente de moto sem capacete, trazido pelo SAMU. Triagem laranja.

ABCDE: via aérea... via aérea com ronco, vamos intubar. Glasgow seis, E1V2M3. Breathing: FR vinte e oito, saturação noventa em ar ambiente. Circulação: PA noventa por sessenta, FC cento e vinte, dois acessos venosos, ringer lactato mil mililitros. Disability: Glasgow seis, pupilas aniso... anisocóricas, pupila direita midriática não reativa. Exposure: fratura de fêmur direito, laceração no couro... cabeludo com sangramento.

Plano: intubação... intubação de sequência rápida com... quetamina e succinilcolina. Tomografia de crânio e... e abdome. Neurocirurgia e ortopedia urgente. Dois... dois unidades de concentrado de hemácias. Imobilizar fêmur.`,

  expectedIntents: ["exam_request", "hospitalization", "interconsult"],
  expectedMissingFields: ["dose_ketamina", "dose_succinilcolina"],
};

const SCENARIO_EMER_AVC: ClinicalScenario = {
  id: "emer-avc-04",
  title: "AVC isquêmico agudo — Emergência",
  sector: "emergencia",
  specialty: "Neurologia / Emergência",
  complexity: "high",
  patientData: { name: "Helena Rodrigues Costa", age: 65, sex: "F", bed: "Emergência 5", mrn: "567890" },
  transcriptionAccurate: `Atendimento da Helena, sessenta e cinco anos, feminino, trazida pelo marido às dez e quarenta e dois da manhã com quadro de hemiplegia súbita à esquerda e afasia global. Sintomas iniciaram às dez e quinze, janela terapêutica de vinte e sete minutos até o momento.

Subjetivo: incapaz de verbalizar, agitada.

Objetivo: pressão arterial cento e oitenta e dois por cento e dois, frequência cardíaca noventa e oito, glicemia capitar cento e vinte, temperatura afebrile. Exame neurológico: Glasgow doze, E4V2M6. Afasia global. Hemiplegia total à esquerda, face e membro. Desvio de rexo do olhar para direita. NIHSS dezesseis pontos. Tomografia de crânio sem contraste: sem hiperdensidade, sem efeito de massa, sem transformação hemorrágica.

Avaliação: AVC isquêmico agudo hemisférico direito com NIHSS dezesseis. Dentro da janela terapêutica para trombólise.

Plano: iniciar alteplase setenta e dois miligramas intravenosa, seis vírgula quatro de bólus e sessenta e cinco vírgula seis em infusão em sessenta minutos. Verificar contraindicações: sem cirurgia recente, sem anticoagulante, glicemia cento e vinte. Monitorizar PA cada quinze minutos. Acionar neurologia para avaliação de trombectomia mecânica dado NIHSS alto. Tomografia com angiotomografia cervical e intracraniana urgente.`,

  transcriptionNoisy: `Helena, sessenta e cinco anos. Hemiplegia súbita à esquerda e afasia. Sintomas às dez e quinze, chegou às dez e quarenta e dois, janela de... vinte e sete minutos.

PA cento e oitenta e dois por cento e dois. FC noventa e oito. Glicemia cento e vinte. Glasgow doze. Afasia global. Hemiplegia total à esquerda. NIHSS... dezesseis pontos. TC de crânio: sem sangramento.

Avaliação: AVC isquêmico, NIHSS dezesseis, dentro da janela.

Plano: alteplase... alteplase setenta e dois miligramas, seis vírgula quatro de bólus, sessenta e cinco vírgula seis em infusão. PA cada quinze minutos. Chamar... chamar neurologia pro NIHSS alto, avaliar trombectomia. Angiotomografia urgente.`,

  expectedIntents: ["exam_request", "prescription", "interconsult", "hospitalization"],
  expectedMissingFields: [],
};

// ---------------------------------------------------------------------------
// ENFERMARIA SCENARIOS
// ---------------------------------------------------------------------------

const SCENARIO_ENF_ICC: ClinicalScenario = {
  id: "enf-icc-05",
  title: "Descompensação de ICC — Enfermaria",
  sector: "enfermaria",
  specialty: "Cardiologia / Clínica Médica",
  complexity: "med",
  patientData: { name: "Antônio José Pereira", age: 74, sex: "M", bed: "Enf 3 — Leito 14", mrn: "234567" },
  transcriptionAccurate: `Evolução do seu Antônio, leito quatorze da enfermaria três. Setenta e quatro anos, segundo dia de internação por descompensação de insuficiência cardíaca com fração de ejeção reduzida.

Subjetivo: paciente relata melhora importante da dispneia em repouso, ainda com ortopneia discreta ao deitar. Negou dor torácica.

Objetivo: pressão arterial cento e vinte e dois por setenta e seis, frequência cardíaca setenta e dois, temperatura trinta e seis ponto quatro, saturação noventa e seis por cento em ar ambiente. Peso hoje sessenta e oito quilos, ontem setenta quilos, perda de dois quilos. Ausculta cardíaca: bulhas rítmicas normofonéticas, sem sopros. Ausculta pulmonar: crepitações bibasais discretas, menos que ontem. Edema em membros inferiores mais mais de quatro mais. BNP solicitado hoje.

Avaliação: ICC descompensada em melhora com diurético venoso. Perda de dois quilos em vinte e quatro horas.

Plano: manter furosemida quarenta miligramas intravenosa de doze em doze horas. Se manter melhora, converter para oral amanhã. Restringir líquidos a mil e quinhentos mililitros por dia. Pesar amanhã cedo. Solicitar ecocardiograma ambulatorial na alta.`,

  transcriptionNoisy: `Evolução do seu Antônio, leito catorze... enfermaria três. Setenta e quatro anos, segundo dia... descompensação de insuficiência cardíaca com fração de ejeção reduzida.

Subjetivo: melhora da dispneia em repouso, ainda com ortopneia discreta. Nega dor torácica.

Objetivo: PA cento e vinte e dois por setenta e seis, FC setenta e dois, temperatura trinta e seis quatro, saturação noventa e seis em ar ambiente. Peso hoje... sessenta e oito quilos, ontem setenta, perdeu dois quilos. Ausculta cardíaca: bulhas rítmicas, sem sopros. Pulmão: crep... crepitações bibasais discretas, menos que ontem. Edema mais mais de quatro mais.

Plano: manter furosemida quarenta intravenosa de doze em doze. Converter pra oral amanhã se melhora. Restrição hídrica mil e quinhentos. Pesar amanhã. Eco ambulatorial na alta.`,

  expectedIntents: ["medical_evolution", "exam_request"],
  expectedMissingFields: [],
};

const SCENARIO_ENF_FRATURA: ClinicalScenario = {
  id: "enf-fratura-06",
  title: "Fratura de fêmur pós-queda (Geriatria) — Enfermaria",
  sector: "enfermaria",
  specialty: "Ortopedia / Geriatria",
  complexity: "med",
  patientData: { name: "Tereza Nascimento Lima", age: 83, sex: "F", bed: "Enf 2 — Leito 8", mrn: "890123" },
  transcriptionAccurate: `Evolução da dona Tereza, oitenta e três anos, fratura de colo de fêmur esquerdo após queda da própria altura, operada ontem com artroplastia parcial de quadril. Pós-operatório imediato.

Subjetivo: paciente relata dor moderada no quadril operado, EVA seis, controlada com dipirona. Sono adequado. Sem febre.

Objetivo: pressão arterial cento e trinta por oitenta, frequência cardíaca oitenta, temperatura trinta e seis vírgula seis, saturação noventa e cinco por cento em ar ambiente. Dreno em vácuo com quarenta mililitros de conteúdo seroso. Ferida operatória limpa, sem sinais de infecção. Sonda vesical com urina clara, diurese adequada.

Avaliação: pós-operatório imediato de artroplastia parcial de quadril, sem intercorrências. Dor controlada.

Plano: fisioterapia e cinesioterapia motora a partir de amanhã, levantar do leito. Manter enoxaparina quarenta miligramas subcutânea uma vez ao dia para profilaxia de tromboembolismo. Dipirona um grama de seis em seis horas se dor. Dieta livre. Remover sonda vesical amanhã. Raio X de controle do quadril.`,

  transcriptionNoisy: `Evolução da dona Tereza, oitenta e três anos. Fratura de colo de fêmur... fêmur esquerdo, fratura após queda. Artro... artroplastia parcial de quadril ontem. Pós-operatório imediato.

Subjetivo: dor moderada no quadril, EVA seis, dipirona. Sem febre.

Objetivo: PA cento e trinta por oitenta, FC oitenta, temperatura trinta e seis seis, saturação noventa e cinco em ar ambiente. Dreno em vácuo... quarenta mililitros seroso. Ferida limpa. Sonda vesical com urina clara.

Plano: fisioterapia amanhã, levantar do leito. Enox... enoxaparina quarenta subcutânea uma vez ao dia. Dipirona um grama de seis em seis se dor. Remover sonda amanhã. Raio X de controle.`,

  expectedIntents: ["medical_evolution", "prescription", "exam_request"],
  expectedMissingFields: [],
};

const SCENARIO_ENF_DM2: ClinicalScenario = {
  id: "enf-dm2-07",
  title: "DM2 descompensado — Enfermaria",
  sector: "enfermaria",
  specialty: "Endocrinologia / Clínica Médica",
  complexity: "med",
  patientData: { name: "Paulo Sérgio Oliveira", age: 56, sex: "M", bed: "Enf 1 — Leito 5", mrn: "456789" },
  transcriptionAccurate: `Evolução do Paulo, leito cinco, cinquenta e seis anos, internado por cetoacidose diabética. Terceiro dia de internação.

Subjetivo: paciente se sente bem melhor, sem náuseas, aceitando dieta oral normalmente. Nega poliúria.

Objetivo: pressão arterial cento e vinte e oito por oitenta, frequência cardíaca oitenta e dois, temperatura trinta e seis ponto cinco, saturação noventa e oito por cento. Glicemia capilar esta manhã cento e quarenta. Gasometria de controle: pH sete vírgula trinta e oito, bicarbonato vinte e quatro, sem acidose. Cetonúria negativa.

Avaliação: cetoacidose diabética resolvida. Paciente compensado clinicamente.

Plano: suspender insulina intravenosa. Iniciar esquema de insulina NPH doze unidades de manhã e oito unidades à noite, mais insulina regular escala de resgate conforme glicemia capilar. Consultar endocrinologia para ajuste de esquema insulínico para alta. Solicitar HbA1c. Alta prevista amanhã se mantiver estabilidade.`,

  transcriptionNoisy: `Evolução do Paulo, leito cinco. Cinquenta e seis anos. Cetoacidose diabética, terceiro dia.

Subjetivo: melhor, sem náuseas, comendo normal.

Objetivo: PA cento e vinte e oito por oitenta, FC oitenta e dois. Glicemia capilar esta manhã... cento e quarenta. Gasometria: pH sete trinta e oito, bicarbonato vinte e quatro, sem acidose. Cetonu... cetonúria negativa.

Avaliação: cetoacidose resolvida.

Plano: suspender insulina... insulina venosa. Iniciar NPH doze de manhã e oito à noite mais... mais escala de resgate. Pedir interconsulta com... endocrinologia. Solicitar HbA1c. Alta amanhã.`,

  expectedIntents: ["medical_evolution", "prescription", "exam_request", "interconsult"],
  expectedMissingFields: [],
};

// ---------------------------------------------------------------------------
// AMBULATÓRIO SCENARIOS
// ---------------------------------------------------------------------------

const SCENARIO_AMB_HAS: ClinicalScenario = {
  id: "amb-has-08",
  title: "Consulta de rotina — HAS — Ambulatório",
  sector: "ambulatorio",
  specialty: "Cardiologia / Clínica Geral",
  complexity: "low",
  patientData: { name: "Joana Fernandes Souza", age: 58, sex: "F", mrn: "678901" },
  transcriptionAccurate: `Consulta de retorno da Joana, cinquenta e oito anos, hipertensa há dez anos em uso de losartana cinquenta miligramas uma vez ao dia e anlodipino cinco miligramas uma vez ao dia.

Queixa principal: veio para retorno de rotina, nega sintomas. Pressão em casa em torno de cento e trinta por oitenta.

Exame físico: pressão arterial na consulta cento e trinta e dois por oitenta e quatro, frequência cardíaca setenta e dois, peso sessenta e dois quilos, IMC vinte e seis ponto dois. Ausculta cardíaca normal. Sem edema.

Avaliação: hipertensão arterial sistêmica bem controlada. Manter esquema atual.

Plano: manter losartana cinquenta miligramas mais anlodipino cinco miligramas. Solicitar hemograma, glicemia em jejum, lipidograma, creatinina, urina um e eletrocardiograma para próxima consulta. Orientar dieta hipossódica e atividade física pelo menos cento e cinquenta minutos por semana. Retorno em seis meses.`,

  transcriptionNoisy: `Joana, cinquenta e oito anos, hipertensa há dez anos. Losartana cinquenta e anlodi... anlodipino cinco.

Queixa: retorno de rotina, sem sintomas. Pressão em casa cento e trinta por oitenta.

Exame físico: PA na consulta cento e trinta e dois por oitenta e quatro, FC setenta e dois, peso sessenta e dois quilos. Ausculta normal.

Avaliação: hipertensão bem controlada.

Plano: manter losartana cinquenta mais anlodipino cinco. Solicitar hemo... hemograma, glicemia, lipidograma, creatinina, urina um e ECG. Retorno em seis meses.`,

  expectedIntents: ["exam_request"],
  expectedMissingFields: [],
};

const SCENARIO_AMB_CARDIO_RETORNO: ClinicalScenario = {
  id: "amb-cardio-09",
  title: "Retorno cardiologia pós-IAM — Ambulatório",
  sector: "ambulatorio",
  specialty: "Cardiologia",
  complexity: "low",
  patientData: { name: "José Augusto Mendonça", age: 62, sex: "M", mrn: "012345" },
  transcriptionAccurate: `Consulta de retorno do José Augusto, sessenta e dois anos, trinta dias após IAM inferior tratado com angioplastia primária da coronária direita com implante de stent farmacológico.

Subjetivo: paciente assintomático do ponto de vista cardiovascular. Sem dor torácica, sem dispneia, sem palpitações. Aderindo às medicações.

Exame físico: pressão arterial cento e vinte e dois por setenta e quatro, frequência cardíaca sessenta e quatro, IMC vinte e seis. Ausculta cardíaca rítmica sem sopros.

ECG trazido pelo paciente: ritmo sinusal, sem alterações isquêmicas agudas. Ondas Q em DII, DIII, aVF compatíveis com IAM prévio.

Avaliação: pós-IAM inferior trinta dias, assintomático. Boa adesão à medicação secundária.

Plano: manter ácido acetilsalicílico cento miligramas ao dia, ticagrelor noventa miligramas duas vezes ao dia por mais onze meses, atorvastatina oitenta miligramas ao dia, metoprolol succinato vinte e cinco miligramas ao dia, ramipril cinco miligramas ao dia. Solicitar ecocardiograma para avaliar função ventricular pós-IAM. Orientar reabilitação cardíaca. Retorno em três meses.`,

  transcriptionNoisy: `José Augusto, sessenta e dois anos, trinta dias de IAM inferior. Angioplastia da coronária direita com stent.

Subjetivo: assintomático, sem dor, sem dispneia. Tomando os remédios.

Exame físico: PA cento e vinte e dois por setenta e quatro, FC sessenta e quatro. Ausculta normal.

ECG: sinusal, Q em DII DIII aVF.

Plano: manter AAS cem, ticagrelor noventa duas vezes ao dia por mais onze meses, atorvastatina oitenta, metoprolol succinato vinte e cinco, ramipril cinco. Solicitar eco... ecocardiograma. Reabilitação cardíaca. Retorno três meses.`,

  expectedIntents: ["exam_request"],
  expectedMissingFields: [],
};

const SCENARIO_AMB_PRE_OP: ClinicalScenario = {
  id: "amb-preop-10",
  title: "Avaliação pré-operatória eletiva — Ambulatório",
  sector: "ambulatorio",
  specialty: "Clínica Médica / Anestesiologia",
  complexity: "low",
  patientData: { name: "Sandra Cristina Almeida", age: 52, sex: "F", mrn: "345670" },
  transcriptionAccurate: `Avaliação pré-operatória da Sandra, cinquenta e dois anos, para colecistectomia videolaparoscópica eletiva prevista para a próxima semana.

Comorbidades: hipertensão arterial em uso de enalapril vinte miligramas ao dia, hipotireoidismo em uso de levotiroxina setenta e cinco microgramas ao dia. Nega diabetes, cardiopatia, coagulopatia. Nega tabagismo. Nega alergias medicamentosas.

Exame físico: pressão arterial cento e vinte e oito por oitenta, frequência cardíaca setenta e oito, SpO2 noventa e oito por cento, peso setenta e quatro quilos, altura um metro e sessenta e dois, IMC vinte e oito. Cardiorrespiratório sem alterações. Abdome com dor em hipocôndrio direito à palpação, Murphy positivo.

Avaliação: paciente com risco cirúrgico ASA II, apta para cirurgia sob anestesia geral ou peridural. HAS bem controlada.

Plano: solicitar exames pré-operatórios: hemograma, coagulograma, função renal, eletrólitos, glicemia, ECG e radiografia de tórax. Orientar manter medicações habituais até o dia da cirurgia, inclusive no dia da cirurgia, exceto anti-hipertensivos de longa ação que devem ser tomados com sorvo d'água. Suspender qualquer anticoagulante ou antiagregante se em uso. Jejum de oito horas para sólidos, dois horas para líquidos claros. Retorno com resultados em cinco dias.`,

  transcriptionNoisy: `Avaliação pré-operatória da Sandra, cinquenta e dois anos, colecistecto... colecistectomia laparoscópica semana que vem.

Comorbidades: HAS em uso de... enalapril vinte, hipotireoidismo, levotiroxina setenta e cinco. Nega diabetes. Nega alergias.

Exame físico: PA cento e vinte e oito por oitenta, FC setenta e oito, SpO dois noventa e oito, peso setenta e quatro quilos. Cardiopulmonar normal. Abdome: Murphy positivo.

Avaliação: ASA II, apta para cirurgia.

Plano: exames pré-operatórios: hemograma, coagu... coagulograma, função renal, eletrólitos, glicemia, ECG, raio X de tórax. Manter medicações, exceto anti-hipertensivo no dia da cirurgia. Jejum oito horas sólidos, dois horas líquidos. Retorno com resultados.`,

  expectedIntents: ["exam_request"],
  expectedMissingFields: [],
};

const SCENARIO_AMB_PEDIATRIA: ClinicalScenario = {
  id: "amb-pediatria-11",
  title: "Primeira consulta pediatria — Ambulatório",
  sector: "ambulatorio",
  specialty: "Pediatria",
  complexity: "med",
  patientData: { name: "Guilherme Costa Ribeiro", age: 3, sex: "M", mrn: "456781" },
  transcriptionAccurate: `Primeira consulta do Guilherme, três anos, masculino, trazido pela mãe com queixa de tosse há quinze dias e febre há três dias.

Subjetivo: mãe refere tosse seca que virou produtiva, expectoração amarelada, febre de até trinta e oito vírgula seis, sem convulsão febril. Sem dificuldade para respirar em repouso. Aceitando líquidos bem.

Antecedentes: parto a termo normal, aleitamento materno exclusivo até seis meses. Vacinação em dia. Sem comorbidades. Nega alergias.

Crescimento: peso doze quilos, altura noventa e dois centímetros, ambos no percentil cinquenta pelo Cartão da OMS.

Exame físico: estado geral regular, hidratado, corado. Temperatura trinta e oito ponto dois. Frequência respiratória trinta e dois por minuto, sem tiragem, saturação noventa e seis por cento. Orofaringe hiperemiada com exsudato em amígdalas. Ausculta pulmonar com roncos difusos, sem crepitações. Sem adenomegalia cervical significativa.

Avaliação: amigdalite bacteriana mais bronquite aguda.

Plano: amoxicilina cinquenta miligramas por quilo por dia dividida em três doses por dez dias. Dose para o Guilherme: duzentos miligramas três vezes ao dia. Ibuprofeno dez miligramas por quilo para febre acima de trinta e oito, máximo quatro doses ao dia. Inalação com soro fisiológico duas vezes ao dia. Retornar se febre persistir por mais de quarenta e oito horas, se surgir dificuldade respiratória ou se piorar.`,

  transcriptionNoisy: `Guilherme, três anos. Tosse há quinze dias, febre há três dias.

Subjetivo: tosse produtiva, expecto... expectoração amarelada. Febre até trinta e oito seis. Aceitando bem líquidos.

Antecedentes: parto a termo, aleitamento até seis meses, vacinas em dia.

Peso doze quilos, altura noventa e dois centímetros, percentil cinquenta.

Exame físico: estado geral regular, hidratado. Temperatura trinta e oito dois. FR trinta e dois, saturação noventa e seis, sem tiragem. Orofaringe hiperemiada com exsudato. Ausculta... roncos difusos, sem crepitações.

Avaliação: amigdalite bacteriana e bronquite aguda.

Plano: amoxicilina... amoxicilina cinquenta miligramas por quilo por dia em três doses por dez dias, duzentos miligramas três vezes ao dia. Ibuprofeno dez por quilo para febre. Inalação com soro duas vezes ao dia. Retornar se piorar.`,

  expectedIntents: ["prescription"],
  expectedMissingFields: [],
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const CLINICAL_SCENARIOS: ClinicalScenario[] = [
  SCENARIO_UTI_SEPSE,
  SCENARIO_UTI_IAM,
  SCENARIO_UTI_PNEUMONIA,
  SCENARIO_EMER_POLITRAUMA,
  SCENARIO_EMER_AVC,
  SCENARIO_ENF_ICC,
  SCENARIO_ENF_FRATURA,
  SCENARIO_ENF_DM2,
  SCENARIO_AMB_HAS,
  SCENARIO_AMB_CARDIO_RETORNO,
  SCENARIO_AMB_PRE_OP,
  SCENARIO_AMB_PEDIATRIA,
];

export function getScenarioById(id: string): ClinicalScenario | undefined {
  return CLINICAL_SCENARIOS.find((s) => s.id === id);
}

export function getScenariosBySector(sector: Sector): ClinicalScenario[] {
  return CLINICAL_SCENARIOS.filter((s) => s.sector === sector);
}

export function getScenariosByComplexity(complexity: Complexity): ClinicalScenario[] {
  return CLINICAL_SCENARIOS.filter((s) => s.complexity === complexity);
}
