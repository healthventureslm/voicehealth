-- Seed do template "Histórico de Enfermagem" (padrão Rede D'Or).
-- Recriado depois da purga geral de templates (20260515000000).
--
-- Assume que apenas 1 hospital "Clínica São Vicente" existe na DB.
-- RAISE EXCEPTION se não encontrar.

DO $$
DECLARE
  v_hospital_id uuid;
BEGIN
  SELECT id INTO v_hospital_id
  FROM public.hospitals
  WHERE name ILIKE '%São Vicente%' OR name ILIKE '%Sao Vicente%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_hospital_id IS NULL THEN
    RAISE EXCEPTION 'Hospital "Clínica São Vicente" não encontrado em public.hospitals';
  END IF;

  INSERT INTO public.report_templates (
    name, description, prompt, schema, hospital_id,
    applicable_roles, applicable_ward_types, is_active, version
  )
  VALUES (
    'Histórico de Enfermagem',
    'Admissão de enfermagem completa no padrão Clínica São Vicente. Coleta antecedentes, dispositivos, barreiras e necessidades na entrada do setor.',
    '',
    $tmpl_hist$
{
  "id": "historico_enfermagem_v1",
  "name": "Histórico de Enfermagem",
  "description": "Admissão de enfermagem completa no padrão Clínica São Vicente (Rede D'Or). Coleta antecedentes, dispositivos, barreiras e necessidades na entrada do setor.",
  "version": 1,
  "layout": "free",
  "metadata": {
    "captureMode": "voice",
    "applicableRoles": ["nurse"],
    "applicableWardTypes": ["uti", "enfermaria", "pronto_socorro"]
  },
  "sections": [
    {
      "id": "perfil",
      "title": "Perfil do paciente / Motivo do atendimento",
      "narrative": { "enabled": true, "hint": "Contexto do paciente, queixa principal" },
      "fields": [
        {
          "id": "perfil_paciente",
          "type": "select",
          "label": "Perfil",
          "required": true,
          "options": [
            { "value": "ADULTO", "label": "Adulto" },
            { "value": "PEDIATRICO", "label": "Pediátrico" },
            { "value": "NEONATAL", "label": "Neonatal" }
          ]
        },
        {
          "id": "idade",
          "type": "number_with_unit",
          "label": "Idade",
          "unit": "anos",
          "min": 0,
          "max": 130,
          "extractAs": "patient_age"
        },
        {
          "id": "motivo_atendimento",
          "type": "select",
          "label": "Motivo do atendimento",
          "required": true,
          "options": [
            { "value": "CLINICO", "label": "Clínico" },
            { "value": "CIRURGICO", "label": "Cirúrgico" },
            { "value": "TRAUMA", "label": "Trauma" },
            { "value": "OBSTETRICO", "label": "Obstétrico" }
          ]
        },
        {
          "id": "tipo_atendimento",
          "type": "select",
          "label": "Tipo de atendimento",
          "options": [
            { "value": "EMERGENCIA_ADULTA", "label": "Emergência adulta" },
            { "value": "EMERGENCIA_PEDIATRICA", "label": "Emergência pediátrica" },
            { "value": "INTERNACAO_ADULTA", "label": "Internação adulta" },
            { "value": "INTERNACAO_PEDIATRICA", "label": "Internação pediátrica" },
            { "value": "AMBULATORIAL", "label": "Ambulatorial" }
          ]
        },
        {
          "id": "queixa_principal",
          "type": "textarea",
          "label": "Queixa principal / motivo da internação",
          "rows": 2
        }
      ]
    },
    {
      "id": "dados_atendimento",
      "title": "Dados do atendimento",
      "narrative": { "enabled": true, "hint": "Contexto da chegada, condições" },
      "fields": [
        {
          "id": "procedencia",
          "type": "radio",
          "label": "Procedência",
          "options": [
            { "value": "RESIDENCIA", "label": "Residência" },
            { "value": "VIA_PUBLICA", "label": "Via pública" },
            { "value": "TRANSFERENCIA_HOSPITALAR", "label": "Transferência hospitalar" },
            { "value": "OUTRO_SETOR", "label": "Outro setor do hospital" },
            { "value": "AMBULATORIO", "label": "Ambulatório" }
          ]
        },
        {
          "id": "acompanhante",
          "type": "radio",
          "label": "Acompanhante",
          "options": [
            { "value": "FAMILIAR", "label": "Familiar" },
            { "value": "AMIGO", "label": "Amigo" },
            { "value": "CUIDADOR", "label": "Cuidador" },
            { "value": "DESACOMPANHADO", "label": "Desacompanhado" }
          ]
        },
        {
          "id": "grau_parentesco",
          "type": "select",
          "label": "Grau de parentesco",
          "visibleWhen": { "field": "acompanhante", "equals": "FAMILIAR" },
          "options": [
            { "value": "CONJUGE", "label": "Cônjuge" },
            { "value": "FILHO", "label": "Filho(a)" },
            { "value": "PAI_MAE", "label": "Pai / Mãe" },
            { "value": "IRMAO", "label": "Irmão(ã)" },
            { "value": "AVO", "label": "Avô / Avó" },
            { "value": "NETO", "label": "Neto(a)" },
            { "value": "OUTRO", "label": "Outro" }
          ]
        }
      ]
    },
    {
      "id": "medicamentos_alergias",
      "title": "Medicamentos em uso e alergias",
      "narrative": { "enabled": true, "hint": "Lista de medicamentos, doses, posologia, reações alérgicas conhecidas" },
      "fields": [
        {
          "id": "abo_rh",
          "type": "select",
          "label": "ABO / Rh",
          "extractAs": "patient_abo_rh",
          "options": [
            { "value": "A_POSITIVO", "label": "A+" },
            { "value": "A_NEGATIVO", "label": "A-" },
            { "value": "B_POSITIVO", "label": "B+" },
            { "value": "B_NEGATIVO", "label": "B-" },
            { "value": "AB_POSITIVO", "label": "AB+" },
            { "value": "AB_NEGATIVO", "label": "AB-" },
            { "value": "O_POSITIVO", "label": "O+" },
            { "value": "O_NEGATIVO", "label": "O-" },
            { "value": "DESCONHECIDO", "label": "Desconhecido" }
          ]
        },
        {
          "id": "medicamentos_uso_habitual",
          "type": "radio",
          "label": "Medicamentos de uso habitual",
          "options": [
            { "value": "SIM", "label": "Sim" },
            { "value": "NAO", "label": "Não" }
          ]
        },
        {
          "id": "medicamentos_lista",
          "type": "textarea",
          "label": "Lista de medicamentos em uso",
          "description": "Nome, dose, frequência, via",
          "rows": 3,
          "visibleWhen": { "field": "medicamentos_uso_habitual", "equals": "SIM" }
        },
        {
          "id": "alergias_status",
          "type": "radio",
          "label": "Alergias",
          "options": [
            { "value": "NEGA_DESCONHECE", "label": "Nega / Desconhece" },
            { "value": "POSSUI", "label": "Possui" }
          ]
        },
        {
          "id": "alergias_descricao",
          "type": "textarea",
          "label": "Descrição das alergias",
          "description": "Medicamentos, alimentos, látex, contraste — e tipo de reação",
          "rows": 2,
          "visibleWhen": { "field": "alergias_status", "equals": "POSSUI" }
        }
      ]
    },
    {
      "id": "hpp",
      "title": "História patológica pregressa (HPP)",
      "description": "Comorbidades e condições prévias do paciente — marque todas que se aplicam.",
      "narrative": { "enabled": true, "hint": "Tempo de diagnóstico, descompensações recentes, tratamentos em curso" },
      "fields": [
        {
          "id": "condicoes",
          "type": "multi_checkbox",
          "label": "Condições prévias",
          "extractAs": "hpp_condicoes",
          "options": [
            { "value": "HAS", "label": "HAS (hipertensão arterial sistêmica)" },
            { "value": "IC", "label": "Insuficiência cardíaca" },
            { "value": "DAC", "label": "Doença arterial coronariana (DAC)" },
            { "value": "DISLIPIDEMIA", "label": "Dislipidemia" },
            { "value": "DPOC", "label": "DPOC" },
            { "value": "ASMA", "label": "Asma" },
            { "value": "DM", "label": "Diabetes mellitus (DM)" },
            { "value": "IRC", "label": "Insuficiência renal crônica (IRC)" },
            { "value": "HIV", "label": "HIV" },
            { "value": "ANSIEDADE", "label": "Ansiedade" },
            { "value": "DOENCA_VASCULAR_PERIFERICA", "label": "Doença vascular periférica" },
            { "value": "ULCERA_PEPTICA", "label": "Úlcera péptica" },
            { "value": "HEPATOPATIA", "label": "Hepatopatia" },
            { "value": "DEMENCIA", "label": "Demência" },
            { "value": "COVID_19", "label": "COVID-19 prévio" },
            { "value": "ETILISMO", "label": "Etilismo" },
            { "value": "TABAGISMO", "label": "Tabagismo" },
            { "value": "HIPOTIREOIDISMO", "label": "Hipotireoidismo" },
            { "value": "CUIDADOS_PALIATIVOS", "label": "Em cuidados paliativos" },
            { "value": "DEPRESSAO", "label": "Depressão" },
            { "value": "VIA_AEREA_DIFICIL", "label": "Via aérea difícil" },
            { "value": "DOENCA_CEREBROVASCULAR", "label": "Doença cerebrovascular (AVC prévio)" },
            { "value": "NEOPLASIA", "label": "Neoplasia" },
            { "value": "METASTASES", "label": "Metástases" }
          ]
        },
        {
          "id": "neoplasia_detalhe",
          "type": "text",
          "label": "Detalhe da neoplasia (tipo, localização)",
          "visibleWhen": { "field": "condicoes", "contains": "NEOPLASIA" }
        },
        {
          "id": "outros_hpps",
          "type": "textarea",
          "label": "Outros HPPs",
          "description": "Outras condições não listadas acima (stent prévio, cirurgias prévias relevantes, etc)",
          "rows": 2
        }
      ]
    },
    {
      "id": "informacoes_complementares",
      "title": "Informações complementares",
      "narrative": { "enabled": true, "hint": "Detalhes adicionais relevantes pra admissão" },
      "fields": [
        {
          "id": "transfusoes_anteriores",
          "type": "radio",
          "label": "Transfusões anteriores",
          "options": [
            { "value": "SIM", "label": "Sim" },
            { "value": "NAO", "label": "Não" },
            { "value": "DESCONHECE", "label": "Desconhece" }
          ]
        },
        {
          "id": "reacao_transfusional",
          "type": "radio",
          "label": "Reação transfusional",
          "visibleWhen": { "field": "transfusoes_anteriores", "equals": "SIM" },
          "options": [
            { "value": "SIM", "label": "Sim" },
            { "value": "NAO", "label": "Não" }
          ]
        },
        {
          "id": "reacao_transfusional_detalhe",
          "type": "text",
          "label": "Descrição da reação transfusional",
          "visibleWhen": { "field": "reacao_transfusional", "equals": "SIM" }
        },
        {
          "id": "anestesias_anteriores",
          "type": "radio",
          "label": "Anestesias anteriores",
          "options": [
            { "value": "SIM", "label": "Sim" },
            { "value": "NAO", "label": "Não" },
            { "value": "DESCONHECE", "label": "Desconhece" }
          ]
        },
        {
          "id": "reacao_anestesica",
          "type": "radio",
          "label": "Reação anestésica",
          "visibleWhen": { "field": "anestesias_anteriores", "equals": "SIM" },
          "options": [
            { "value": "SIM", "label": "Sim" },
            { "value": "NAO", "label": "Não" }
          ]
        },
        {
          "id": "reacao_anestesica_detalhe",
          "type": "text",
          "label": "Descrição da reação anestésica",
          "visibleWhen": { "field": "reacao_anestesica", "equals": "SIM" }
        },
        {
          "id": "historico_queda",
          "type": "radio",
          "label": "Histórico de queda nos últimos 3 meses",
          "options": [
            { "value": "SIM", "label": "Sim" },
            { "value": "NAO", "label": "Não" }
          ]
        },
        {
          "id": "jejum_desde",
          "type": "text",
          "label": "Jejum desde",
          "description": "Data/hora do início do jejum, ou 'Não se aplica'"
        },
        {
          "id": "ufi",
          "type": "text",
          "label": "UFI (última fração ingerida)"
        },
        {
          "id": "dum",
          "type": "text",
          "label": "DUM (data da última menstruação)",
          "description": "Mulheres em idade fértil. 'Não se aplica' caso contrário."
        },
        {
          "id": "uso_contraceptivo",
          "type": "text",
          "label": "Uso de contraceptivo"
        },
        {
          "id": "abo_rh_mae",
          "type": "text",
          "label": "ABO/Rh da Mãe",
          "description": "Apenas neonatal/pediátrico"
        },
        {
          "id": "abo_rh_pai",
          "type": "text",
          "label": "ABO/Rh do Pai",
          "description": "Apenas neonatal/pediátrico"
        }
      ]
    },
    {
      "id": "antropometria",
      "title": "Dados antropométricos",
      "narrative": { "enabled": true, "hint": "Variações recentes de peso, comportamento alimentar" },
      "fields": [
        { "id": "peso", "type": "number_with_unit", "label": "Peso", "unit": "kg", "min": 0, "step": 0.1, "extractAs": "anthro_peso" },
        { "id": "altura", "type": "number_with_unit", "label": "Altura", "unit": "cm", "min": 0, "extractAs": "anthro_altura" },
        { "id": "imc", "type": "computed", "label": "IMC", "unit": "kg/m²", "formula": { "kind": "expression", "expr": "peso / ((altura / 100) ^ 2)" } }
      ]
    },
    {
      "id": "precaucoes",
      "title": "Precauções",
      "narrative": { "enabled": true, "hint": "Microorganismos identificados, motivo do rastreamento" },
      "fields": [
        {
          "id": "lista_precaucoes",
          "type": "table",
          "label": "Precauções ativas",
          "columns": [
            { "id": "tipo", "type": "select", "label": "Tipo", "required": true, "options": [
              { "value": "PADRAO", "label": "Padrão" },
              { "value": "CONTATO", "label": "Contato" },
              { "value": "GOTICULAS", "label": "Gotículas" },
              { "value": "AEROSSOIS", "label": "Aerossóis" },
              { "value": "PROTETIVA", "label": "Protetiva" }
            ] },
            { "id": "motivo", "type": "text", "label": "Motivo" },
            { "id": "inicio", "type": "date", "label": "Início" }
          ]
        }
      ]
    },
    {
      "id": "dispositivos_proteses",
      "title": "Dispositivos / Próteses",
      "description": "Dispositivos ou próteses que o paciente já possui na admissão. Marque todos que se aplicam.",
      "narrative": { "enabled": true, "hint": "Tempo de uso, marca/modelo, último ajuste/troca" },
      "fields": [
        {
          "id": "dispositivos",
          "type": "multi_checkbox",
          "label": "Dispositivos / próteses presentes",
          "extractAs": "admission_devices",
          "options": [
            { "value": "AUDITIVA", "label": "Prótese auditiva" },
            { "value": "DENTARIA", "label": "Prótese dentária" },
            { "value": "DIU", "label": "DIU" },
            { "value": "BENGALA_ANDADOR", "label": "Bengala / Andador" },
            { "value": "MARCAPASSO", "label": "Marcapasso" },
            { "value": "STENT_CARDIACO", "label": "Stent cardíaco" },
            { "value": "BOMBA_IMPLANTADA", "label": "Bomba implantada" },
            { "value": "NEUROESTIMULADOR", "label": "Neuroestimulador" },
            { "value": "TATUAGEM_PIERCING", "label": "Tatuagem / Piercing" },
            { "value": "CATETER_IMPLANTADO", "label": "Cateter implantado" },
            { "value": "OCULOS_LENTE", "label": "Óculos / Lente de contato" },
            { "value": "VALVULA_CARDIACA_METALICA", "label": "Válvula cardíaca metálica" },
            { "value": "DVP", "label": "DVP (derivação ventrículo-peritoneal)" },
            { "value": "CLIP_METALICO", "label": "Clip metálico" },
            { "value": "ABSORVENTE_INTERNO", "label": "Absorvente interno" },
            { "value": "PROTESE_METALICA_ORTOPEDICA", "label": "Prótese metálica ortopédica" }
          ]
        },
        {
          "id": "outros_dispositivos",
          "type": "text",
          "label": "Outros dispositivos não listados"
        }
      ]
    },
    {
      "id": "barreiras_necessidades",
      "title": "Barreiras e necessidades",
      "narrative": { "enabled": true, "hint": "Implicações no plano de cuidado: necessidade de intérprete, escala adaptada, etc." },
      "fields": [
        {
          "id": "barreiras",
          "type": "multi_checkbox",
          "label": "Barreiras identificadas",
          "extractAs": "barreiras",
          "options": [
            { "value": "MOTORA", "label": "Motora" },
            { "value": "AUDITIVA", "label": "Auditiva" },
            { "value": "VISUAL", "label": "Visual" },
            { "value": "FALA", "label": "Fala" },
            { "value": "COGNITIVA", "label": "Cognitiva / Intelectual / Emocional" }
          ]
        },
        {
          "id": "religiosa_cultural",
          "type": "textarea",
          "label": "Aspectos religiosos / culturais relevantes",
          "rows": 2
        },
        {
          "id": "estado_emocional",
          "type": "radio",
          "label": "Estado emocional",
          "options": [
            { "value": "TRANQUILO", "label": "Tranquilo" },
            { "value": "ANSIOSO", "label": "Ansioso" },
            { "value": "AGITADO", "label": "Agitado" },
            { "value": "DEPRIMIDO", "label": "Deprimido" },
            { "value": "APREENSIVO", "label": "Apreensivo" },
            { "value": "RESIGNADO", "label": "Resignado" }
          ]
        },
        {
          "id": "idioma",
          "type": "text",
          "label": "Idioma (se diferente de português)"
        },
        {
          "id": "condicao_economica",
          "type": "select",
          "label": "Condição econômica",
          "options": [
            { "value": "INDEPENDENTE", "label": "Independente" },
            { "value": "PARCIALMENTE_DEPENDENTE", "label": "Parcialmente dependente" },
            { "value": "DEPENDENTE", "label": "Dependente" }
          ]
        },
        {
          "id": "grau_instrucao",
          "type": "select",
          "label": "Grau de instrução",
          "options": [
            { "value": "ANALFABETO", "label": "Analfabeto" },
            { "value": "ALFABETIZADO", "label": "Alfabetizado" },
            { "value": "FUNDAMENTAL", "label": "Fundamental" },
            { "value": "MEDIO", "label": "Médio" },
            { "value": "SUPERIOR", "label": "Superior" },
            { "value": "POS_GRADUACAO", "label": "Pós-graduação" }
          ]
        },
        {
          "id": "moradia",
          "type": "radio",
          "label": "Moradia",
          "options": [
            { "value": "ACOMPANHADO", "label": "Acompanhado" },
            { "value": "SOZINHO", "label": "Sozinho" },
            { "value": "INSTITUICAO", "label": "Em instituição" },
            { "value": "SITUACAO_RUA", "label": "Situação de rua" }
          ]
        }
      ]
    }
  ]
}

$tmpl_hist$::jsonb,
    v_hospital_id,
    ARRAY['nurse']::app_role[],
    ARRAY['uti', 'enfermaria', 'pronto_socorro']::ward_type[],
    TRUE,
    1
  );
END $$;
