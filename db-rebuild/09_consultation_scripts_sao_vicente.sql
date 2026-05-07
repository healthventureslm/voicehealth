-- ============================================================================
-- 09_consultation_scripts_sao_vicente.sql
-- ----------------------------------------------------------------------------
-- Cria 5 roteiros (consultation_scripts) que pareiam 1:1 (por nome) com os
-- templates de relatório da Clínica São Vicente criados em 07_*.sql.
--
-- Cada roteiro define os pontos que o profissional deve abordar durante a
-- gravação. Conforme a fala é transcrita em tempo real (Web Speech API), o
-- frontend marca cada ponto como coberto pela presença das keywords.
--
-- Match por NOME (igual ao name de report_templates) — não há FK direta.
-- Idempotente: limpa e reinsere.
-- ============================================================================

BEGIN;

DELETE FROM consultation_scripts
 WHERE hospital_id = (SELECT id FROM hospitals WHERE slug = 'clinica-sao-vicente');

DO $scripts$
DECLARE
  v_hosp_id uuid;
BEGIN
  SELECT id INTO v_hosp_id FROM hospitals WHERE slug = 'clinica-sao-vicente';
  IF v_hosp_id IS NULL THEN
    RAISE EXCEPTION 'Hospital "clinica-sao-vicente" não encontrado — rode 03_create.sql primeiro';
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 1) EVOLUÇÃO DE ENFERMAGEM
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO consultation_scripts (hospital_id, name, description, fields,
                                     applicable_ward_types, is_active)
  VALUES (v_hosp_id,
    'Evolução de Enfermagem',
    'Roteiro para evolução diária — guia o que falar durante a gravação.',
    $json$[
      {"id": "identificacao", "label": "Identificação do paciente (nome, idade)",
       "required": true, "keywords": ["paciente", "anos", "idade"]},
      {"id": "motivo", "label": "Motivo do atendimento / condição clínica atual",
       "required": true, "keywords": ["motivo", "diagnostico", "internado", "internada", "condicao"]},
      {"id": "neurologico", "label": "Avaliação neurológica (consciência, Glasgow, RASS)",
       "required": true, "keywords": ["consciencia", "glasgow", "rass", "lucido", "lucida", "orientado", "orientada", "sonolento", "sonolenta", "neurologico", "pupila"]},
      {"id": "cardiovascular", "label": "Cardiovascular (PA, FC, perfusão, edema)",
       "required": true, "keywords": ["pressao", "pa", "fc", "frequencia cardiaca", "perfusao", "edema", "ritmo", "hemodinamico", "hemodinamica"]},
      {"id": "respiratorio", "label": "Respiratório (FR, SpO2, suporte de O2)",
       "required": true, "keywords": ["respiratorio", "respiratoria", "fr", "saturacao", "spo2", "oxigenio", "cateter", "mascara", "ventilacao", "ventilador", "ar ambiente"]},
      {"id": "gastrointestinal", "label": "Abdominal/GI (dieta, aceitação, RHA, evacuação)",
       "required": false, "keywords": ["dieta", "abdome", "rha", "ruidos hidroaereos", "evacuacao", "evacuou", "fezes", "ostomia"]},
      {"id": "renal", "label": "Urológico/renal (diurese, dispositivo)",
       "required": false, "keywords": ["diurese", "urina", "sonda vesical", "svd", "renal"]},
      {"id": "pele", "label": "Pele e lesões (Braden, curativos)",
       "required": false, "keywords": ["pele", "braden", "lesao", "curativo", "ferida", "ulcera"]},
      {"id": "infusoes", "label": "Infusões e medicações em curso",
       "required": true, "keywords": ["infusao", "droga", "vasoativa", "noradrenalina", "sedacao", "antibiotico", "soro", "medicacao"]},
      {"id": "riscos", "label": "Riscos (queda, LPP, broncoaspiração, sangramento)",
       "required": true, "keywords": ["risco", "queda", "lpp", "lesao por pressao", "broncoaspiracao", "sangramento", "trombose"]},
      {"id": "metas", "label": "Metas e plano de cuidado",
       "required": false, "keywords": ["meta", "plano", "objetivo", "alta", "proximo"]}
    ]$json$::jsonb,
    ARRAY[]::ward_type[],
    true);

  -- ─────────────────────────────────────────────────────────────────────
  -- 2) HISTÓRICO DE ENFERMAGEM (ADMISSÃO)
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO consultation_scripts (hospital_id, name, description, fields,
                                     applicable_ward_types, is_active)
  VALUES (v_hosp_id,
    'Histórico de Enfermagem',
    'Roteiro de admissão — coleta de antecedentes e perfil ao entrar no setor.',
    $json$[
      {"id": "identificacao", "label": "Identificação do paciente (nome, idade, perfil)",
       "required": true, "keywords": ["paciente", "anos", "idade", "adulto", "idoso", "pediatrico"]},
      {"id": "motivo_admissao", "label": "Motivo da admissão / queixa principal",
       "required": true, "keywords": ["motivo", "admissao", "queixa", "internacao", "internado", "internada"]},
      {"id": "procedencia", "label": "Procedência e condições de chegada",
       "required": true, "keywords": ["procedencia", "residencia", "pronto atendimento", "pa", "outro hospital", "deambulando", "cadeira", "maca", "acamado"]},
      {"id": "acompanhante", "label": "Acompanhante e grau de parentesco",
       "required": false, "keywords": ["acompanhante", "filho", "filha", "esposa", "esposo", "marido", "mae", "pai", "irmao", "irma", "parentesco"]},
      {"id": "medicacoes", "label": "Medicamentos de uso habitual",
       "required": true, "keywords": ["medicacao", "medicamento", "remedio", "uso habitual", "uso continuo"]},
      {"id": "alergias", "label": "Alergias (medicamentosas, alimentares)",
       "required": true, "keywords": ["alergia", "alergico", "alergica", "nega alergia", "desconhece"]},
      {"id": "comorbidades", "label": "Comorbidades / HPP (HAS, DM, DPOC, etc.)",
       "required": true, "keywords": ["hipertensao", "has", "diabetes", "dm", "dpoc", "asma", "cardiopatia", "renal cronica", "hiv", "neoplasia", "comorbidade", "hpp"]},
      {"id": "antecedentes", "label": "Antecedentes (transfusão, anestesia, quedas)",
       "required": false, "keywords": ["transfusao", "anestesia", "queda", "cirurgia previa"]},
      {"id": "antropometricos", "label": "Peso, altura, IMC",
       "required": false, "keywords": ["peso", "kilo", "quilo", "altura", "metro", "imc"]},
      {"id": "dispositivos", "label": "Dispositivos / próteses (marcapasso, stent, etc.)",
       "required": false, "keywords": ["marcapasso", "stent", "protese", "cateter implantado", "dispositivo", "valvula"]},
      {"id": "barreiras", "label": "Barreiras (motora, auditiva, visual, idioma)",
       "required": false, "keywords": ["barreira", "auditiva", "visual", "motora", "fala", "cognitiva", "idioma", "religiosa"]}
    ]$json$::jsonb,
    ARRAY[]::ward_type[],
    true);

  -- ─────────────────────────────────────────────────────────────────────
  -- 3) PASSAGEM DE PLANTÃO (SBAR)
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO consultation_scripts (hospital_id, name, description, fields,
                                     applicable_ward_types, is_active)
  VALUES (v_hosp_id,
    'Passagem de Plantão',
    'Roteiro SBAR para handoff — situação, background, avaliação, recomendações.',
    $json$[
      {"id": "identificacao", "label": "Identificação rápida do paciente",
       "required": true, "keywords": ["paciente", "anos", "leito", "pulseira"]},
      {"id": "situacao", "label": "S — Situação atual (diagnóstico, dor, riscos)",
       "required": true, "keywords": ["diagnostico", "situacao", "dor", "instavel", "estavel", "queixa"]},
      {"id": "precaucao", "label": "Precaução (contato, gotícula, aerossol)",
       "required": false, "keywords": ["precaucao", "contato", "goticula", "aerossol", "isolamento", "rastreamento"]},
      {"id": "background", "label": "B — Background (HPP, alergias, resumo clínico)",
       "required": true, "keywords": ["hpp", "comorbidade", "antecedente", "alergia", "historia"]},
      {"id": "consciencia", "label": "A — Nível de consciência e orientação",
       "required": true, "keywords": ["consciencia", "lucido", "lucida", "orientado", "orientada", "sonolento", "sonolenta", "rebaixado", "rebaixada"]},
      {"id": "ventilatorio", "label": "A — Ventilatório e dispositivos vasculares",
       "required": true, "keywords": ["ventilatorio", "saturacao", "spo2", "oxigenio", "cateter", "ventilacao", "acesso venoso", "central", "picc"]},
      {"id": "infusoes", "label": "A — Infusões, antibióticos, dieta, drenos/sondas",
       "required": true, "keywords": ["infusao", "antibiotico", "dieta", "dreno", "sonda", "soro"]},
      {"id": "eliminacoes", "label": "A — Eliminações e curativos",
       "required": false, "keywords": ["diurese", "evacuacao", "curativo", "lesao"]},
      {"id": "exames", "label": "R — Exames realizados / pendentes",
       "required": true, "keywords": ["exame", "tomografia", "raio x", "laboratorio", "hemograma", "pendente"]},
      {"id": "programacao", "label": "R — Programação e cuidados prioritários do próximo turno",
       "required": true, "keywords": ["programacao", "proximo turno", "prioridade", "pendencia", "recomendacao"]}
    ]$json$::jsonb,
    ARRAY[]::ward_type[],
    true);

  -- ─────────────────────────────────────────────────────────────────────
  -- 4) ACOMPANHAMENTO DE LESÕES DE PELE
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO consultation_scripts (hospital_id, name, description, fields,
                                     applicable_ward_types, is_active)
  VALUES (v_hosp_id,
    'Acompanhamento de Lesões de Pele',
    'Roteiro para avaliação e curativo de lesão.',
    $json$[
      {"id": "identificacao", "label": "Identificação do paciente e do profissional",
       "required": true, "keywords": ["paciente", "anos", "enfermeiro", "estomaterapeuta", "profissional"]},
      {"id": "tipo", "label": "Tipo de lesão (LPP, ferida operatória, skin tear, DAI)",
       "required": true, "keywords": ["lesao por pressao", "lpp", "ferida operatoria", "skin tear", "dermatite", "dai", "ulcera", "ferida"]},
      {"id": "localizacao", "label": "Localização anatômica da lesão",
       "required": true, "keywords": ["sacral", "trocanter", "calcaneo", "occipital", "perna", "abdome", "regiao", "local", "localizada", "localizado"]},
      {"id": "medidas", "label": "Medidas (comprimento × largura × profundidade)",
       "required": true, "keywords": ["centimetro", "cm", "milimetro", "mm", "comprimento", "largura", "profundidade", "medida"]},
      {"id": "leito", "label": "Leito da lesão (granulação, esfacelo, necrose)",
       "required": true, "keywords": ["granulacao", "esfacelo", "necrose", "tecido", "leito", "fibrina"]},
      {"id": "exsudato", "label": "Exsudato (quantidade, tipo, odor)",
       "required": true, "keywords": ["exsudato", "seroso", "sanguinolento", "purulento", "odor", "secrecao"]},
      {"id": "bordas", "label": "Bordas e pele adjacente",
       "required": false, "keywords": ["borda", "pele adjacente", "macerada", "macerado", "ressecada", "ressecado", "hiperemia"]},
      {"id": "curativo", "label": "Curativo realizado (cobertura primária e secundária)",
       "required": true, "keywords": ["cobertura", "curativo", "alginato", "hidrogel", "espuma", "hidrocoloide", "ag", "prata", "gaze"]},
      {"id": "procedimento", "label": "Procedimento (limpeza, materiais utilizados)",
       "required": false, "keywords": ["limpeza", "soro fisiologico", "clorexidina", "material", "tecnica"]},
      {"id": "proxima_troca", "label": "Periodicidade e próxima troca",
       "required": true, "keywords": ["troca", "periodicidade", "diaria", "diario", "horas", "proxima"]},
      {"id": "push", "label": "Escala PUSH e tendência (melhora/piora)",
       "required": false, "keywords": ["push", "pontuacao", "melhora", "estavel", "piora", "tendencia"]}
    ]$json$::jsonb,
    ARRAY[]::ward_type[],
    true);

  -- ─────────────────────────────────────────────────────────────────────
  -- 5) TRANSFERÊNCIA INTERNA DE PACIENTE
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO consultation_scripts (hospital_id, name, description, fields,
                                     applicable_ward_types, is_active)
  VALUES (v_hosp_id,
    'Transferência Interna de Paciente',
    'Roteiro SBAR para transferência entre setores.',
    $json$[
      {"id": "setores", "label": "Setor de origem e destino (com leito)",
       "required": true, "keywords": ["origem", "destino", "uti", "enfermaria", "setor", "leito", "transferencia"]},
      {"id": "diagnostico", "label": "S — Diagnóstico principal e secundários",
       "required": true, "keywords": ["diagnostico", "principal", "secundario", "sepse", "ami", "avc", "hipotese"]},
      {"id": "dispositivos", "label": "S — Dispositivos atuais (acessos, sondas, drenos)",
       "required": true, "keywords": ["dispositivo", "acesso venoso", "central", "picc", "sonda", "dreno", "cateter"]},
      {"id": "medicacoes", "label": "S — Antibióticos e analgésicos em curso",
       "required": true, "keywords": ["antibiotico", "analgesico", "medicacao", "infusao", "atb"]},
      {"id": "precaucoes", "label": "S — Precauções ativas",
       "required": false, "keywords": ["precaucao", "contato", "goticula", "aerossol", "isolamento"]},
      {"id": "historico", "label": "B — Resumo clínico e procedimentos realizados",
       "required": true, "keywords": ["resumo", "historico", "procedimento", "cirurgia", "internacao", "evolucao"]},
      {"id": "alergias", "label": "B — Alergias e HPP relevante",
       "required": true, "keywords": ["alergia", "nega alergia", "hpp", "comorbidade", "antecedente"]},
      {"id": "neurologico", "label": "A — Avaliação neurológica",
       "required": true, "keywords": ["consciencia", "glasgow", "rass", "lucido", "lucida", "orientado", "orientada", "neurologico"]},
      {"id": "ventilatorio", "label": "A — Suporte ventilatório atual",
       "required": true, "keywords": ["ventilatorio", "saturacao", "spo2", "ar ambiente", "cateter", "ventilacao", "ventilador"]},
      {"id": "riscos", "label": "A — Riscos (queda, LPP, sangramento, trombose)",
       "required": true, "keywords": ["risco", "queda", "lpp", "sangramento", "trombose", "glicemia"]},
      {"id": "pendencias", "label": "R — Pendências (exames, pareceres) e recomendações",
       "required": true, "keywords": ["pendencia", "exame pendente", "parecer", "recomendacao", "planejamento", "meta"]}
    ]$json$::jsonb,
    ARRAY[]::ward_type[],
    true);

  RAISE NOTICE '✓ 5 roteiros (consultation_scripts) da Clínica São Vicente inseridos';
END
$scripts$;

COMMIT;

-- Verificação
SELECT name,
       jsonb_array_length(fields) AS num_fields,
       applicable_ward_types,
       is_active
  FROM consultation_scripts
 WHERE hospital_id = (SELECT id FROM hospitals WHERE slug = 'clinica-sao-vicente')
 ORDER BY name;
