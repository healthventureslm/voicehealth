-- Seed: 6 scripts clínicos completos
-- Identificação do paciente NÃO consta nos campos — vem do cadastro (nome, leito, prontuário, nº atendimento, data/hora da gravação)

INSERT INTO consultation_scripts (id, name, sector, report_type, description, fields, is_active)
VALUES

-- 1. Evolução Médica em UTI
(
  'b1000000-c000-0000-0000-000000000001',
  'Evolução Médica em UTI',
  'uti',
  'icu_evolution',
  'O médico deve informar: contexto clínico atual com diagnóstico principal e dia de internação (D+N); sinais vitais (FC, PA, SpO2, temperatura); avaliação neurológica com Glasgow ou nível de sedação; avaliação respiratória indicando se em ventilação mecânica com FiO2, PEEP e modo ventilatório (se aplicável); drogas vasoativas em uso com dose em mcg/kg/min (se houver); balanço hídrico das últimas 24h com diurese e débito; resultados laboratoriais relevantes como lactato, creatinina e gasometria (se houverem); conduta e plano terapêutico para as próximas 24h; e previsão de alta da UTI (se aplicável).',
  '[
    {"id":"b1000001-c000-0000-0000-000000000001","label":"Contexto clínico atual (diagnóstico, D+N)","required":true,"keywords":["diagnóstico","D+","internação","contexto","quadro","motivo","admissão","apresentando","sepse","pneumonia","AVC","IAM"]},
    {"id":"b1000002-c000-0000-0000-000000000001","label":"Sinais vitais (FC, PA, SpO2, Tax)","required":true,"keywords":["FC","PA","SpO2","temperatura","Tax","saturação","pressão","frequência cardíaca","mmHg","bpm"]},
    {"id":"b1000003-c000-0000-0000-000000000001","label":"Avaliação neurológica (Glasgow, sedação)","required":true,"keywords":["Glasgow","sedação","consciência","orientado","sedado","agitado","responsivo","Ramsay","RASS","pupilas"]},
    {"id":"b1000004-c000-0000-0000-000000000001","label":"Avaliação respiratória — VM (se aplicável)","required":false,"keywords":["ventilação","VM","VMI","FiO2","PEEP","volume corrente","modo","cateter","cânula","volume","pressão suporte"]},
    {"id":"b1000005-c000-0000-0000-000000000001","label":"Drogas vasoativas (se houver)","required":false,"keywords":["noradrenalina","adrenalina","vasopressina","dopamina","vasoativa","vasopressor","dose","mcg","droga"]},
    {"id":"b1000006-c000-0000-0000-000000000001","label":"Balanço hídrico 24h","required":true,"keywords":["balanço","hídrico","diurese","infusão","débito","positivo","negativo","ml","volume infundido"]},
    {"id":"b1000007-c000-0000-0000-000000000001","label":"Resultados laboratoriais (se houverem)","required":false,"keywords":["lactato","creatinina","hemograma","gasometria","PCR","eletrólitos","sódio","potássio","leucócitos","plaquetas"]},
    {"id":"b1000008-c000-0000-0000-000000000001","label":"Conduta e plano terapêutico 24h","required":true,"keywords":["conduta","plano","manter","ajustar","aumentar","reduzir","suspender","prescrição","antibiótico","sedoanalgesia"]},
    {"id":"b1000009-c000-0000-0000-000000000001","label":"Previsão de alta da UTI (se aplicável)","required":false,"keywords":["alta","previsão","transferência","critérios","estabilidade","transferir","semi-intensiva","enfermaria"]}
  ]'::jsonb,
  true
),

-- 2. Evolução Médica em UI (Unidade de Internação)
(
  'b2000000-c000-0000-0000-000000000001',
  'Evolução Médica em UI',
  'enfermaria',
  'medical_evolution',
  'O médico deve informar: diagnóstico principal com CID e dia de internação (D+N); queixa atual do paciente (se houver); sinais vitais (FC, PA, SpO2, temperatura); exame físico com dados de ausculta, abdome, edema e hidratação; resultados de exames laboratoriais ou de imagem relevantes (se houverem); dieta e via de alimentação atual; principais medicações em uso; conduta do dia incluindo solicitações, ajustes e planos; e previsão de alta hospitalar (se aplicável).',
  '[
    {"id":"b2000001-c000-0000-0000-000000000001","label":"Diagnóstico e motivo de internação (CID, D+N)","required":true,"keywords":["diagnóstico","CID","internado","motivo","admissão","D+","principal","hipótese"]},
    {"id":"b2000002-c000-0000-0000-000000000001","label":"Queixa atual do paciente (se houver)","required":false,"keywords":["queixa","refere","relata","sintoma","dor","piora","melhora","queixando","hoje"]},
    {"id":"b2000003-c000-0000-0000-000000000001","label":"Sinais vitais (FC, PA, SpO2, temperatura)","required":true,"keywords":["FC","PA","SpO2","temperatura","Tax","saturação","pressão","bpm","mmHg"]},
    {"id":"b2000004-c000-0000-0000-000000000001","label":"Exame físico","required":true,"keywords":["exame","físico","ausculta","abdome","edema","hidratação","consciente","mucosas","respiração","pulsos"]},
    {"id":"b2000005-c000-0000-0000-000000000001","label":"Resultados de exames (se houverem)","required":false,"keywords":["exame","lab","raio-x","ultrassom","tomografia","resultado","leucócitos","creatinina","hemoglobina","PCR"]},
    {"id":"b2000006-c000-0000-0000-000000000001","label":"Dieta e via oral (se aplicável)","required":false,"keywords":["dieta","oral","VO","alimentando","aceitação","jejum","sonda","enteral","tolerando"]},
    {"id":"b2000007-c000-0000-0000-000000000001","label":"Medicações em uso (se aplicável)","required":false,"keywords":["medicação","antibiótico","analgésico","anti-hipertensivo","uso","dose","prescrito","antidiabético"]},
    {"id":"b2000008-c000-0000-0000-000000000001","label":"Conduta do dia","required":true,"keywords":["conduta","plano","solicitar","manter","ajustar","suspender","prescrever","introduzir","coletar"]},
    {"id":"b2000009-c000-0000-0000-000000000001","label":"Previsão de alta hospitalar (se aplicável)","required":false,"keywords":["alta","previsão","critérios","estabilidade","dias","programar","receber","ambulatório"]}
  ]'::jsonb,
  true
),

-- 3. Evolução de Enfermagem — UTI
(
  'b3000000-c000-0000-0000-000000000001',
  'Evolução de Enfermagem — UTI',
  'uti',
  'nursing_evolution',
  'O enfermeiro deve informar: estado geral e nível de consciência com Glasgow ou grau de sedação; monitorização hemodinâmica com FC, PA e PAM; avaliação respiratória indicando SpO2, modo ventilatório e FiO2 se em ventilação mecânica (se aplicável); condições do acesso venoso (AVP, CVC ou PICC) e infusões em andamento; diurese e eliminações incluindo aspecto e volume; condições da pele e presença de lesões por pressão (se houver); contenção e posicionamento do paciente (se aplicável); administração de medicamentos do plantão com doses e horários; e intercorrências ou observações do plantão.',
  '[
    {"id":"b3000001-c000-0000-0000-000000000001","label":"Estado geral e nível de consciência","required":true,"keywords":["consciente","Glasgow","orientado","sedado","agitado","responsivo","Ramsay","RASS","estado geral","reativo"]},
    {"id":"b3000002-c000-0000-0000-000000000001","label":"Monitorização hemodinâmica (FC, PA, PAM)","required":true,"keywords":["FC","PA","PAM","ritmo","frequência","pressão","cardíaco","sinusal","bpm","mmHg","monitorizado"]},
    {"id":"b3000003-c000-0000-0000-000000000001","label":"Avaliação respiratória — VM (se aplicável)","required":false,"keywords":["SpO2","ventilação","VM","FiO2","expansão","respiração","cateter","modo","PEEP","volume","saturação"]},
    {"id":"b3000004-c000-0000-0000-000000000001","label":"Acesso venoso e infusões","required":true,"keywords":["acesso","AVP","CVC","PICC","infusão","pervio","flebite","bomba","central","venoso","cateter"]},
    {"id":"b3000005-c000-0000-0000-000000000001","label":"Diurese e eliminações","required":true,"keywords":["diurese","SVD","urina","débito","aspecto","eliminação","fezes","ml","amarelo","colúrico"]},
    {"id":"b3000006-c000-0000-0000-000000000001","label":"Pele e lesões por pressão (se houver)","required":false,"keywords":["pele","LPP","lesão","Braden","curativo","integridade","úlcera","eritema","área","pressão"]},
    {"id":"b3000007-c000-0000-0000-000000000001","label":"Contenção e posicionamento (se aplicável)","required":false,"keywords":["contenção","decúbito","posicionamento","cabeceira","lateralização","semifowler","graus","prona"]},
    {"id":"b3000008-c000-0000-0000-000000000001","label":"Administração de medicamentos","required":true,"keywords":["medicação","administrado","dose","horário","antibiótico","analgesia","sedoanalgesia","infundido","droga"]},
    {"id":"b3000009-c000-0000-0000-000000000001","label":"Intercorrências e observações","required":false,"keywords":["intercorrência","observação","alarme","familiar","chamada","ocorrência","queda","extubação","acidente"]}
  ]'::jsonb,
  true
),

-- 4. Evolução de Enfermagem — Enfermaria
(
  'b4000000-c000-0000-0000-000000000001',
  'Evolução de Enfermagem — Enfermaria',
  'enfermaria',
  'nursing_evolution',
  'O enfermeiro deve informar: estado geral do paciente com nível de consciência e queixas; sinais vitais do plantão (FC, PA, SpO2, temperatura); condições do acesso venoso (se houver); dieta e aceitação alimentar incluindo via de nutrição; diurese e eliminações; administração de medicamentos com doses e horários; cuidados com pele e curativos (se houver); qualidade do sono e conforto do paciente (se aplicável); e observações e intercorrências do plantão.',
  '[
    {"id":"b4000001-c000-0000-0000-000000000001","label":"Estado geral","required":true,"keywords":["estado geral","consciente","orientado","cooperativo","agitado","queixa","ativo","responsivo","comunicativo"]},
    {"id":"b4000002-c000-0000-0000-000000000001","label":"Sinais vitais (FC, PA, SpO2, temperatura)","required":true,"keywords":["FC","PA","SpO2","temperatura","Tax","saturação","pressão","bpm","mmHg","afebril","febril"]},
    {"id":"b4000003-c000-0000-0000-000000000001","label":"Acesso venoso (se houver)","required":false,"keywords":["acesso","AVP","PICC","pervio","flebite","ocluído","periférico","venoso","trocado","salinizado"]},
    {"id":"b4000004-c000-0000-0000-000000000001","label":"Dieta e aceitação alimentar","required":true,"keywords":["dieta","oral","alimentação","aceitação","sonda","VO","jejum","aceitou","recusou","tolerando","pastosa"]},
    {"id":"b4000005-c000-0000-0000-000000000001","label":"Diurese e eliminações","required":true,"keywords":["diurese","urina","fezes","eliminação","deambulou","evacuou","continente","incontinente","aspecto","ml"]},
    {"id":"b4000006-c000-0000-0000-000000000001","label":"Administração de medicamentos","required":true,"keywords":["medicação","administrado","dose","horário","antibiótico","analgesia","infundido","prescrito","tomou"]},
    {"id":"b4000007-c000-0000-0000-000000000001","label":"Cuidados com pele e curativos (se houver)","required":false,"keywords":["pele","curativo","LPP","lesão","Braden","higiene","úlcera","realizado","trocado","área"]},
    {"id":"b4000008-c000-0000-0000-000000000001","label":"Sono e conforto (se aplicável)","required":false,"keywords":["dormiu","sono","repouso","conforto","analgesia","noturno","queixa","acordou","tranquilo","agitado"]},
    {"id":"b4000009-c000-0000-0000-000000000001","label":"Observações e intercorrências","required":false,"keywords":["intercorrência","observação","familiar","orientação","queda","chamada","ocorrência","relatado"]}
  ]'::jsonb,
  true
),

-- 5. Evolução de Fisioterapia Completa
(
  'b5000000-c000-0000-0000-000000000001',
  'Evolução de Fisioterapia Completa',
  NULL,
  'physiotherapy_evolution',
  'O fisioterapeuta deve informar: diagnóstico e motivo do atendimento fisioterapêutico; avaliação respiratória com SpO2, padrão respiratório, expansão torácica, ausculta, tosse e secreção — e parâmetros ventilatórios se em ventilação mecânica (se aplicável); avaliação motora e força muscular com escala MRC e capacidade de deambulação; nível de consciência e cooperação do paciente; modalidade e técnica fisioterapêutica utilizada; resposta ao atendimento com tolerância e estabilidade hemodinâmica; e metas e plano para o próximo atendimento.',
  '[
    {"id":"b5000001-c000-0000-0000-000000000001","label":"Diagnóstico e motivo do atendimento","required":true,"keywords":["diagnóstico","fisioterapia","indicação","encaminhamento","motivo","internado","reabilitação","protocolo"]},
    {"id":"b5000002-c000-0000-0000-000000000001","label":"Avaliação respiratória (padrão, ausculta, secreção; VM se aplicável)","required":true,"keywords":["SpO2","respiração","expansão","ausculta","tosse","secreção","padrão","murmúrio","VM","FiO2","crepitação"]},
    {"id":"b5000003-c000-0000-0000-000000000001","label":"Avaliação motora e força muscular (MRC)","required":true,"keywords":["força","grau","MRC","membros","deambulação","sentar","levantar","fraqueza","marcha","transferência"]},
    {"id":"b5000004-c000-0000-0000-000000000001","label":"Nível de consciência e cooperação","required":true,"keywords":["consciente","Glasgow","orientado","coopera","sedado","colaborativo","responsivo","entende","segue"]},
    {"id":"b5000005-c000-0000-0000-000000000001","label":"Modalidade e técnica utilizada","required":true,"keywords":["técnica","exercício","mobilização","CPAP","PEEP","flutter","respiratório","aspiração","fisioterapia","manobra","hiperinsuflação"]},
    {"id":"b5000006-c000-0000-0000-000000000001","label":"Resposta ao atendimento","required":true,"keywords":["tolerou","respondeu","SpO2","instabilidade","cansaço","melhora","piora","desaturou","tolerância","bem"]},
    {"id":"b5000007-c000-0000-0000-000000000001","label":"Metas e plano do próximo atendimento","required":true,"keywords":["meta","plano","próximo","continuar","progredir","alta","fisioterapia","objetivo","deambular","desmame"]}
  ]'::jsonb,
  true
),

-- 6. Evolução de Nutrição Clínica
(
  'b6000000-c000-0000-0000-000000000001',
  'Evolução de Nutrição Clínica',
  NULL,
  'nutrition_evolution',
  'O nutricionista deve informar: diagnóstico nutricional com resultado da triagem de risco (NRS ou MNA); via e modalidade de nutrição atual (oral, enteral ou parenteral); necessidades calóricas e proteicas calculadas com meta e déficit; aceitação e tolerância à dieta incluindo sintomas gastrointestinais (diarreia, náusea, resíduo); volume e velocidade de infusão em caso de nutrição enteral ou parenteral (se aplicável); resultados de exames relevantes como glicemia e albumina (se houverem); e conduta, ajustes realizados e metas nutricionais para o próximo atendimento.',
  '[
    {"id":"b6000001-c000-0000-0000-000000000001","label":"Diagnóstico nutricional (NRS, triagem de risco)","required":true,"keywords":["diagnóstico","nutricional","desnutrição","risco","NRS","triagem","obeso","eutrópico","MNA","sarcopenia"]},
    {"id":"b6000002-c000-0000-0000-000000000001","label":"Via e modalidade de nutrição","required":true,"keywords":["via oral","VO","enteral","parenteral","SNE","SNJ","NPT","gastrostomia","jejum","sonda","dieta"]},
    {"id":"b6000003-c000-0000-0000-000000000001","label":"Necessidades calóricas e proteicas (kcal, proteína)","required":true,"keywords":["calorias","kcal","proteína","meta","necessidade","déficit","prescrito","grama","kg","REE"]},
    {"id":"b6000004-c000-0000-0000-000000000001","label":"Aceitação e tolerância","required":true,"keywords":["aceitou","tolerou","aceitação","diarreia","constipação","náusea","vômito","resíduo","distensão","flatulência"]},
    {"id":"b6000005-c000-0000-0000-000000000001","label":"Volume e velocidade infundidos (se enteral/parenteral)","required":false,"keywords":["volume","ml","velocidade","infundido","recebeu","taxa","gotejamento","ml/h","bomba"]},
    {"id":"b6000006-c000-0000-0000-000000000001","label":"Exames relevantes (se houverem)","required":false,"keywords":["glicemia","albumina","pré-albumina","proteína","lab","exame","hemoglobina","triglicerídeos","zinco"]},
    {"id":"b6000007-c000-0000-0000-000000000001","label":"Conduta, ajuste e metas nutricionais","required":true,"keywords":["conduta","ajuste","aumentar","reduzir","suspender","manter","progredir","meta","reavaliação","objetivo"]}
  ]'::jsonb,
  true
)

ON CONFLICT (id) DO NOTHING;
