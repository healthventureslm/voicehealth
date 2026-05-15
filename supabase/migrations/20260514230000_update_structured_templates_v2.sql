-- Atualiza os schemas dos 2 templates estruturados pra v2 (expandida).
--
-- v2 do "Evolução de Enfermagem" inclui: idade, motivo_detalhe,
-- alergias, sinais vitais completos, Glasgow scored, secreção
-- traqueal, débito urinário, dispositivos invasivos, riscos NANDA
-- (10 itens), metas (tabela), comunicação familiar, narrative em
-- todas as seções, e annotations extractAs marcando campos clínicos
-- promovíveis pra tabela de observations no futuro.
--
-- v2 do "Transição SBAR" adiciona narrative em todas as 4 seções
-- SBAR.
--
-- Idempotente — UPDATE não falha se rodar duas vezes.

BEGIN;

UPDATE public.report_templates
SET
  schema = $tmpl_evol$
{
  "id": "evolucao_enfermagem_v2",
  "name": "Evolução de Enfermagem",
  "description": "Evolução diária de enfermagem em UTI/Enfermaria seguindo o padrão Rede D'Or. Avaliação por sistemas + escalas obrigatórias + riscos NANDA + metas.",
  "version": 2,
  "layout": "free",
  "metadata": {
    "captureMode": "voice",
    "applicableRoles": ["nurse"],
    "applicableWardTypes": ["uti", "enfermaria"]
  },
  "sections": [
    {
      "id": "perfil",
      "title": "Perfil do paciente / Motivo de atendimento",
      "narrative": { "enabled": true, "hint": "Contexto adicional do paciente, condições de base relevantes" },
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
          "label": "Motivo de atendimento",
          "required": true,
          "options": [
            { "value": "CLINICO", "label": "Clínico" },
            { "value": "CIRURGICO", "label": "Cirúrgico" },
            { "value": "TRAUMA", "label": "Trauma" },
            { "value": "OBSTETRICO", "label": "Obstétrico" }
          ]
        },
        {
          "id": "motivo_detalhe",
          "type": "textarea",
          "label": "Detalhe do motivo",
          "description": "Diagnóstico principal, contexto cirúrgico (ex: 2º DPO Laparotomia Exploradora), motivo de internação",
          "rows": 2
        },
        {
          "id": "antecedentes",
          "type": "textarea",
          "label": "Antecedentes / comorbidades",
          "description": "HAS, DM, IRC, ICC, etc. Cirurgias prévias relevantes",
          "rows": 2
        },
        {
          "id": "alergias_nega",
          "type": "boolean",
          "label": "Nega alergias?"
        },
        {
          "id": "alergias",
          "type": "textarea",
          "label": "Alergias",
          "description": "Medicamentos, alimentos, látex",
          "rows": 1,
          "visibleWhen": { "field": "alergias_nega", "equals": false }
        }
      ]
    },
    {
      "id": "sinais_vitais",
      "title": "Sinais vitais",
      "narrative": { "enabled": true, "hint": "Horário da aferição, oscilações, tendência" },
      "fields": [
        { "id": "pa_sistolica", "type": "number_with_unit", "label": "PAS (sistólica)", "unit": "mmHg", "min": 0, "max": 350, "extractAs": "vital_pa_sistolica" },
        { "id": "pa_diastolica", "type": "number_with_unit", "label": "PAD (diastólica)", "unit": "mmHg", "min": 0, "max": 250, "extractAs": "vital_pa_diastolica" },
        { "id": "pam", "type": "number_with_unit", "label": "PAM", "unit": "mmHg", "min": 0, "max": 300, "extractAs": "vital_pam" },
        { "id": "fc", "type": "number_with_unit", "label": "FC", "unit": "bpm", "min": 0, "max": 250, "extractAs": "vital_fc" },
        { "id": "fr", "type": "number_with_unit", "label": "FR", "unit": "irpm", "min": 0, "max": 100, "extractAs": "vital_fr" },
        { "id": "spo2", "type": "number_with_unit", "label": "SpO2", "unit": "%", "min": 0, "max": 100, "extractAs": "vital_spo2" },
        { "id": "temperatura", "type": "number_with_unit", "label": "Temperatura", "unit": "°C", "min": 25, "max": 45, "step": 0.1, "extractAs": "vital_temperatura" },
        { "id": "glicemia", "type": "number_with_unit", "label": "Glicemia capilar", "unit": "mg/dL", "min": 0, "max": 800, "extractAs": "vital_glicemia" },
        {
          "id": "metodo_pa",
          "type": "radio",
          "label": "Método PA",
          "options": [
            { "value": "INVASIVA", "label": "Invasiva (PAI)" },
            { "value": "NAO_INVASIVA", "label": "Não invasiva" }
          ]
        }
      ]
    },
    {
      "id": "avaliacao_geral",
      "title": "Avaliação geral",
      "narrative": { "enabled": true, "hint": "Observações sobre repouso, mobilização, prevenção TEV" },
      "fields": [
        {
          "id": "repouso",
          "type": "radio",
          "label": "Repouso",
          "required": true,
          "options": [
            { "value": "ABSOLUTO", "label": "Repouso absoluto no leito" },
            { "value": "RELATIVO", "label": "Repouso relativo no leito" },
            { "value": "SEM_RESTRICAO", "label": "Sem restrição" }
          ]
        },
        {
          "id": "deambulacao",
          "type": "radio",
          "label": "Deambulação",
          "required": true,
          "options": [
            { "value": "INDEPENDENTE", "label": "Deambulação independente" },
            { "value": "COM_AUXILIO", "label": "Deambulação com auxílio" },
            { "value": "ACAMADO", "label": "Acamado / não deambula" }
          ]
        },
        { "id": "prevencao_tev_ativa", "type": "boolean", "label": "Prevenção de TEV ativa?" },
        {
          "id": "prevencao_tev_tipos",
          "type": "multi_checkbox",
          "label": "Tipo(s) de prevenção TEV",
          "visibleWhen": { "field": "prevencao_tev_ativa", "equals": true },
          "options": [
            { "value": "FARMACOLOGICA", "label": "Profilaxia farmacológica" },
            { "value": "MECANICA", "label": "Profilaxia mecânica" },
            { "value": "DEAMBULACAO", "label": "Deambulação" }
          ]
        },
        {
          "id": "uso_compressor_horas", "type": "number_with_unit", "label": "Uso do compressor",
          "unit": "h/dia", "min": 0, "max": 24,
          "visibleWhen": { "field": "prevencao_tev_tipos", "contains": "MECANICA" }
        },
        {
          "id": "morse",
          "type": "scored_scale",
          "label": "MORSE — risco de queda",
          "extractAs": "scale_morse_score",
          "items": [
            { "id": "historico_quedas", "label": "Histórico de quedas (3 meses)", "options": [{ "value": 0, "label": "Não" }, { "value": 25, "label": "Sim" }] },
            { "id": "diagnostico_secundario", "label": "Diagnóstico secundário", "options": [{ "value": 0, "label": "Não" }, { "value": 15, "label": "Sim" }] },
            { "id": "auxilio_deambulacao", "label": "Auxílio na deambulação", "options": [{ "value": 0, "label": "Nenhum / repouso / profissional" }, { "value": 15, "label": "Muletas, bengala, andador" }, { "value": 30, "label": "Apoia-se em mobiliário" }] },
            { "id": "terapia_endovenosa", "label": "Terapia endovenosa / acesso periférico", "options": [{ "value": 0, "label": "Não" }, { "value": 20, "label": "Sim" }] },
            { "id": "marcha", "label": "Marcha", "options": [{ "value": 0, "label": "Normal / sem deambulação" }, { "value": 10, "label": "Debilitada" }, { "value": 20, "label": "Cambaleante / desequilibrada" }] },
            { "id": "estado_mental_morse", "label": "Estado mental", "options": [{ "value": 0, "label": "Orientado quanto à própria capacidade" }, { "value": 15, "label": "Superestima ou esquece limitações" }] }
          ],
          "classification": [
            { "min": 0, "max": 24, "label": "Risco baixo", "color": "green" },
            { "min": 25, "max": 44, "label": "Risco moderado", "color": "yellow" },
            { "min": 45, "max": 125, "label": "Risco alto", "color": "red" }
          ]
        },
        {
          "id": "nas_score",
          "type": "number",
          "label": "NAS — grau de dependência (% carga de trabalho)",
          "min": 0,
          "max": 200,
          "step": 0.1,
          "extractAs": "scale_nas_score"
        }
      ]
    },
    {
      "id": "precaucoes",
      "title": "Precauções",
      "narrative": { "enabled": true, "hint": "Microrganismos identificados, motivo do rastreamento" },
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
            { "id": "inicio", "type": "date", "label": "Início" },
            { "id": "microorganismo_mdr", "type": "text", "label": "Microorganismo MDR" }
          ]
        }
      ]
    },
    {
      "id": "neurologica",
      "title": "Avaliação neurológica",
      "narrative": { "enabled": true, "hint": "Drogas sedativas em uso, observações pupilares, motora" },
      "fields": [
        {
          "id": "nivel_consciencia",
          "type": "radio",
          "label": "Nível de consciência",
          "options": [
            { "value": "ALERTA", "label": "Alerta" },
            { "value": "SONOLENTO", "label": "Sonolento" },
            { "value": "TORPOROSO", "label": "Torporoso" },
            { "value": "COMATOSO", "label": "Comatoso" },
            { "value": "SEDADO", "label": "Sedado" }
          ]
        },
        {
          "id": "estado_mental",
          "type": "multi_checkbox",
          "label": "Estado mental",
          "options": [
            { "value": "ORIENTADO", "label": "Orientado" },
            { "value": "DESORIENTADO", "label": "Desorientado" },
            { "value": "COLABORATIVO", "label": "Colaborativo" },
            { "value": "HIPOATIVO", "label": "Hipoativo" },
            { "value": "HIPERATIVO", "label": "Hiperativo" }
          ]
        },
        {
          "id": "glasgow",
          "type": "scored_scale",
          "label": "Glasgow",
          "extractAs": "scale_glasgow_score",
          "items": [
            { "id": "abertura_ocular", "label": "Abertura ocular", "options": [
              { "value": 1, "label": "Sem resposta" },
              { "value": 2, "label": "À dor" },
              { "value": 3, "label": "À voz" },
              { "value": 4, "label": "Espontânea" }
            ] },
            { "id": "resposta_verbal", "label": "Resposta verbal", "options": [
              { "value": 1, "label": "Sem resposta" },
              { "value": 2, "label": "Sons incompreensíveis" },
              { "value": 3, "label": "Palavras inapropriadas" },
              { "value": 4, "label": "Confuso" },
              { "value": 5, "label": "Orientado" }
            ] },
            { "id": "resposta_motora", "label": "Resposta motora", "options": [
              { "value": 1, "label": "Sem resposta" },
              { "value": 2, "label": "Extensão à dor" },
              { "value": 3, "label": "Flexão anormal à dor" },
              { "value": 4, "label": "Retirada à dor" },
              { "value": 5, "label": "Localiza dor" },
              { "value": 6, "label": "Obedece comandos" }
            ] }
          ],
          "classification": [
            { "min": 3, "max": 8, "label": "Lesão cerebral grave", "color": "red" },
            { "min": 9, "max": 12, "label": "Lesão cerebral moderada", "color": "orange" },
            { "min": 13, "max": 15, "label": "Lesão cerebral leve / normal", "color": "green" }
          ]
        },
        {
          "id": "rass",
          "type": "scored_scale",
          "label": "RASS (Richmond Agitation-Sedation Scale)",
          "extractAs": "scale_rass_nivel",
          "items": [
            { "id": "rass_nivel", "label": "Nível", "options": [
              { "value": 4, "label": "+4 Combativo" },
              { "value": 3, "label": "+3 Muito agitado" },
              { "value": 2, "label": "+2 Agitado" },
              { "value": 1, "label": "+1 Inquieto" },
              { "value": 0, "label": "0 Alerta e calmo" },
              { "value": -1, "label": "-1 Sonolento" },
              { "value": -2, "label": "-2 Sedação leve" },
              { "value": -3, "label": "-3 Sedação moderada" },
              { "value": -4, "label": "-4 Sedação profunda" },
              { "value": -5, "label": "-5 Não responsivo" }
            ] }
          ]
        },
        {
          "id": "cam_icu",
          "type": "radio",
          "label": "CAM-ICU (delirium)",
          "options": [
            { "value": "HA_DELIRIUM", "label": "Há delirium" },
            { "value": "SEM_DELIRIUM", "label": "Sem delirium" },
            { "value": "NAO_AVALIADO", "label": "Não avaliado" }
          ]
        },
        { "id": "contencao_mecanica", "type": "boolean", "label": "Contenção mecânica?" },
        {
          "id": "pupilas",
          "type": "radio",
          "label": "Pupilas",
          "options": [
            { "value": "ISOCORICAS", "label": "Isocóricas" },
            { "value": "ANISOCORICAS", "label": "Anisocóricas" }
          ]
        },
        { "id": "diametro_pupilar", "type": "text", "label": "Diâmetro pupilar (ex: 3mm bilateral)" },
        {
          "id": "reacao_fotomotora",
          "type": "radio",
          "label": "Reação fotomotora",
          "options": [
            { "value": "PRESENTE", "label": "Presente" },
            { "value": "AUSENTE", "label": "Ausente" }
          ]
        },
        {
          "id": "avaliacao_motora",
          "type": "radio",
          "label": "Avaliação motora",
          "options": [
            { "value": "SEM_ALTERACOES", "label": "Sem alterações" },
            { "value": "COM_ALTERACOES", "label": "Com alterações" },
            { "value": "NAO_AVALIADO", "label": "Não avaliado" }
          ]
        }
      ]
    },
    {
      "id": "cardiovascular",
      "title": "Avaliação cardiovascular",
      "narrative": { "enabled": true, "hint": "Drogas vasoativas, monitorização, ECG" },
      "fields": [
        { "id": "hemodinamica", "type": "radio", "label": "Hemodinâmica", "options": [
          { "value": "ESTAVEL", "label": "Estável" },
          { "value": "INSTAVEL", "label": "Instável" },
          { "value": "ESTAVEL_SUPORTE", "label": "Estável com suporte (DVA)" }
        ] },
        { "id": "ritmo_cardiaco", "type": "radio", "label": "Ritmo cardíaco", "options": [
          { "value": "REGULAR", "label": "Regular / Sinusal" },
          { "value": "IRREGULAR", "label": "Irregular" }
        ] },
        { "id": "extremidades", "type": "radio", "label": "Extremidades", "options": [
          { "value": "QUENTES", "label": "Quentes" },
          { "value": "FRIAS", "label": "Frias" },
          { "value": "SEM_ALTERACOES", "label": "Sem alterações" }
        ] },
        { "id": "perfusao_periferica", "type": "radio", "label": "Perfusão periférica", "options": [
          { "value": "NORMAL", "label": "Normal" },
          { "value": "LENTIFICADA", "label": "Lentificada" }
        ] },
        { "id": "panturrilha_empastada", "type": "boolean", "label": "Panturrilha empastada?" },
        { "id": "edema", "type": "radio", "label": "Edema", "options": [
          { "value": "AUSENTE", "label": "Ausente" },
          { "value": "PRESENTE", "label": "Presente" }
        ] },
        { "id": "edema_localizacao", "type": "text", "label": "Localização do edema", "visibleWhen": { "field": "edema", "equals": "PRESENTE" } }
      ]
    },
    {
      "id": "infusoes",
      "title": "Infusões importantes",
      "narrative": { "enabled": true, "hint": "Diluições, vias de acesso, justificativa clínica" },
      "fields": [
        { "id": "sem_infusoes", "type": "boolean", "label": "Paciente não possui infusões contínuas importantes" },
        {
          "id": "lista_infusoes",
          "type": "table",
          "label": "Infusões",
          "visibleWhen": { "field": "sem_infusoes", "equals": false },
          "columns": [
            { "id": "droga", "type": "text", "label": "Droga", "required": true },
            { "id": "dose", "type": "text", "label": "Dose" },
            { "id": "unidade", "type": "text", "label": "Unidade (ex: mcg/kg/min)" },
            { "id": "via", "type": "text", "label": "Via / acesso" },
            { "id": "inicio", "type": "datetime", "label": "Início" }
          ]
        }
      ]
    },
    {
      "id": "respiratoria",
      "title": "Avaliação respiratória / torácica",
      "narrative": { "enabled": true, "hint": "Ausculta pulmonar, secreções (cor/quantidade), gasometria" },
      "fields": [
        { "id": "padrao_respiratorio", "type": "radio", "label": "Padrão respiratório", "options": [
          { "value": "EUPNEICO", "label": "Eupneico" },
          { "value": "DISPNEICO", "label": "Dispneico" },
          { "value": "TAQUIPNEICO", "label": "Taquipneico" },
          { "value": "BRADIPNEICO", "label": "Bradipneico" }
        ] },
        { "id": "esforco_respiratorio", "type": "radio", "label": "Esforço respiratório", "options": [
          { "value": "AUSENTE", "label": "Ausente" },
          { "value": "TIRAGEM", "label": "Tiragem" },
          { "value": "MUSCULATURA_ACESSORIA", "label": "Uso de musculatura acessória" },
          { "value": "GEMIDO", "label": "Gemido expiratório" },
          { "value": "BATIMENTO_ASA_NARIZ", "label": "Batimento de asa de nariz" }
        ] },
        {
          "id": "suporte_ventilatorio",
          "type": "radio",
          "label": "Suporte ventilatório",
          "required": true,
          "options": [
            { "value": "AR_AMBIENTE", "label": "Ar ambiente" },
            { "value": "CATETER_NASAL", "label": "Cateter nasal" },
            { "value": "MASCARA", "label": "Máscara facial / Venturi" },
            { "value": "ALTO_FLUXO", "label": "Cateter de alto fluxo" },
            { "value": "MACRONEBULIZACAO", "label": "Macronebulização" },
            { "value": "SVNI", "label": "SVNI (não invasiva)" },
            { "value": "VM", "label": "VM (invasiva)" }
          ]
        },
        { "id": "modo_ventilatorio", "type": "select", "label": "Modo ventilatório",
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" },
          "options": [
            { "value": "PCV", "label": "PCV" }, { "value": "VCV", "label": "VCV" },
            { "value": "PSV", "label": "PSV" }, { "value": "SIMV", "label": "SIMV" },
            { "value": "OUTRO", "label": "Outro" }
          ] },
        { "id": "vc", "type": "number_with_unit", "label": "VC (volume corrente)", "unit": "ml", "min": 0,
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" } },
        { "id": "peep", "type": "number_with_unit", "label": "PEEP", "unit": "cmH2O", "min": 0,
          "extractAs": "vent_peep",
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" } },
        { "id": "pressao_pico", "type": "number_with_unit", "label": "Pressão de pico", "unit": "cmH2O",
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" } },
        { "id": "fio2", "type": "number_with_unit", "label": "FiO2", "unit": "%", "min": 21, "max": 100,
          "extractAs": "vent_fio2",
          "visibleWhen": { "field": "suporte_ventilatorio", "in": ["VM", "ALTO_FLUXO", "SVNI", "MASCARA"] } },
        { "id": "p_f", "type": "number", "label": "Relação P/F",
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" } },
        { "id": "tosse", "type": "radio", "label": "Tosse", "options": [
          { "value": "AUSENTE", "label": "Ausente" },
          { "value": "SECA", "label": "Seca" },
          { "value": "PRODUTIVA_EFICAZ", "label": "Produtiva e eficaz" },
          { "value": "PRODUTIVA_INEFICAZ", "label": "Produtiva e ineficaz" }
        ] },
        { "id": "secrecao", "type": "radio", "label": "Secreção traqueal", "options": [
          { "value": "AUSENTE", "label": "Ausente / escassa" },
          { "value": "MODERADA", "label": "Moderada" },
          { "value": "ABUNDANTE", "label": "Abundante" }
        ] },
        { "id": "secrecao_aspecto", "type": "text", "label": "Aspecto da secreção (cor, fluidez)",
          "visibleWhen": { "field": "secrecao", "in": ["MODERADA", "ABUNDANTE"] } }
      ]
    },
    {
      "id": "abdominal",
      "title": "Avaliação abdominal / gastrointestinal",
      "narrative": { "enabled": true, "hint": "Curativo cirúrgico, resíduo gástrico, características das eliminações" },
      "fields": [
        { "id": "dieta", "type": "radio", "label": "Dieta", "options": [
          { "value": "ORAL", "label": "Oral" },
          { "value": "ENTERAL", "label": "Enteral" },
          { "value": "PARENTERAL", "label": "Parenteral" },
          { "value": "JEJUM", "label": "Jejum" },
          { "value": "ZERO", "label": "Dieta zero" }
        ] },
        { "id": "consistencia_dieta", "type": "text", "label": "Consistência da dieta",
          "visibleWhen": { "field": "dieta", "in": ["ORAL", "ENTERAL"] } },
        { "id": "aceitacao", "type": "radio", "label": "Aceitação",
          "visibleWhen": { "field": "dieta", "in": ["ORAL", "ENTERAL"] },
          "options": [
            { "value": "TOTAL", "label": "Total" },
            { "value": "PARCIAL", "label": "Parcial" },
            { "value": "INAPETENTE", "label": "Inapetente" },
            { "value": "BOA", "label": "Boa" }
          ] },
        { "id": "vazao_enteral", "type": "number_with_unit", "label": "Vazão enteral", "unit": "ml/h",
          "visibleWhen": { "field": "dieta", "equals": "ENTERAL" } },
        { "id": "abdome", "type": "radio", "label": "Abdome", "options": [
          { "value": "FLACIDO", "label": "Flácido" },
          { "value": "GLOBOSO", "label": "Globoso" },
          { "value": "PLANO", "label": "Plano" },
          { "value": "DISTENDIDO", "label": "Distendido" }
        ] },
        { "id": "rha", "type": "radio", "label": "RHA (ruídos hidroaéreos)", "options": [
          { "value": "PRESENTE", "label": "Presentes" },
          { "value": "AUSENTE", "label": "Ausentes" },
          { "value": "DIMINUIDOS", "label": "Diminuídos" }
        ] },
        { "id": "dor_palpacao", "type": "radio", "label": "Dor à palpação", "options": [
          { "value": "PRESENTE", "label": "Presente" },
          { "value": "AUSENTE", "label": "Ausente" },
          { "value": "NAO_AVALIADO", "label": "Não avaliado (sedado)" }
        ] },
        { "id": "ultima_funcao_intestinal", "type": "date", "label": "Última função intestinal", "max": "today" },
        { "id": "n_evacuacoes", "type": "number", "label": "Nº de evacuações no período", "min": 0 },
        { "id": "aspecto_fezes", "type": "text", "label": "Aspecto das fezes" },
        { "id": "colostomia", "type": "boolean", "label": "Colostomia / Ileostomia?" },
        { "id": "restricao_hidrica", "type": "boolean", "label": "Restrição hídrica?" }
      ]
    },
    {
      "id": "urologico",
      "title": "Avaliação urológica / renal",
      "narrative": { "enabled": true, "hint": "Tempo de cateter, característica da diurese, suporte renal" },
      "fields": [
        { "id": "tipo_eliminacao", "type": "multi_checkbox", "label": "Tipo de eliminação", "options": [
          { "value": "ESPONTANEA", "label": "Diurese espontânea" },
          { "value": "SVD_SVA", "label": "Sonda vesical (SVD/SVA)" },
          { "value": "INCONTINENCIA", "label": "Incontinência urinária" },
          { "value": "ANURIA_OLIGURIA", "label": "Anúria / Oligúria" },
          { "value": "UROSTOMIA", "label": "Urostomia" },
          { "value": "IRRIGACAO_VESICAL", "label": "Irrigação vesical" }
        ] },
        { "id": "debito_urinario", "type": "number_with_unit", "label": "Débito urinário no período", "unit": "ml", "min": 0, "extractAs": "vital_diurese_volume" },
        { "id": "horas_debito", "type": "number_with_unit", "label": "Período do débito", "unit": "h", "min": 0, "max": 48 },
        { "id": "aspecto_diurese", "type": "radio", "label": "Aspecto da diurese", "options": [
          { "value": "CLARO", "label": "Claro" },
          { "value": "AMARELO_CITRINO", "label": "Amarelo citrino" },
          { "value": "CONCENTRADA", "label": "Concentrada" },
          { "value": "HEMATURIA", "label": "Hematúrica" },
          { "value": "COLURIA", "label": "Colúrica" }
        ] },
        { "id": "suporte_renal", "type": "radio", "label": "Suporte renal", "options": [
          { "value": "NAO", "label": "Não" },
          { "value": "HD_INTERMITENTE", "label": "HD intermitente" },
          { "value": "TRRC", "label": "TRRC contínua" },
          { "value": "DIALISE_PERITONEAL", "label": "Diálise peritoneal" }
        ] }
      ]
    },
    {
      "id": "antropometria",
      "title": "Antropometria",
      "narrative": { "enabled": true, "hint": "Tendência de peso, balanço hídrico" },
      "fields": [
        { "id": "peso", "type": "number_with_unit", "label": "Peso", "unit": "kg", "min": 0, "step": 0.1, "extractAs": "anthro_peso" },
        { "id": "altura", "type": "number_with_unit", "label": "Estatura", "unit": "cm", "min": 0, "extractAs": "anthro_altura" },
        { "id": "imc", "type": "computed", "label": "IMC", "unit": "kg/m²", "formula": { "kind": "expression", "expr": "peso / ((altura / 100) ^ 2)" } }
      ]
    },
    {
      "id": "pele",
      "title": "Avaliação de pele e mucosas",
      "narrative": { "enabled": true, "hint": "Coberturas usadas, próxima troca, características das lesões" },
      "fields": [
        { "id": "estado_pele", "type": "multi_checkbox", "label": "Estado", "options": [
          { "value": "INTEGRAS", "label": "Pele e mucosas íntegras" },
          { "value": "HIPOCORADA", "label": "Hipocorada" },
          { "value": "DESIDRATADA", "label": "Desidratada" },
          { "value": "ICTERICA", "label": "Ictérica" },
          { "value": "ANASARCA", "label": "Anasarca" },
          { "value": "XERODERMIA", "label": "Xerodermia" },
          { "value": "MUCOSITE", "label": "Mucosite / moníliase oral" }
        ] },
        {
          "id": "braden",
          "type": "scored_scale",
          "label": "BRADEN — risco de LPP",
          "extractAs": "scale_braden_score",
          "items": [
            { "id": "percepcao_sensorial", "label": "Percepção sensorial", "options": [
              { "value": 1, "label": "Totalmente limitado" },
              { "value": 2, "label": "Muito limitado" },
              { "value": 3, "label": "Levemente limitado" },
              { "value": 4, "label": "Nenhuma limitação" }
            ] },
            { "id": "umidade", "label": "Umidade", "options": [
              { "value": 1, "label": "Completamente molhado" },
              { "value": 2, "label": "Muito molhado" },
              { "value": 3, "label": "Ocasionalmente molhado" },
              { "value": 4, "label": "Raramente molhado" }
            ] },
            { "id": "atividade", "label": "Atividade", "options": [
              { "value": 1, "label": "Acamado" },
              { "value": 2, "label": "Confinado à cadeira" },
              { "value": 3, "label": "Anda ocasionalmente" },
              { "value": 4, "label": "Anda frequentemente" }
            ] },
            { "id": "mobilidade", "label": "Mobilidade", "options": [
              { "value": 1, "label": "Totalmente imóvel" },
              { "value": 2, "label": "Bastante limitado" },
              { "value": 3, "label": "Levemente limitado" },
              { "value": 4, "label": "Não apresenta limitação" }
            ] },
            { "id": "nutricao", "label": "Nutrição", "options": [
              { "value": 1, "label": "Muito pobre" },
              { "value": 2, "label": "Provavelmente inadequado" },
              { "value": 3, "label": "Adequado" },
              { "value": 4, "label": "Excelente" }
            ] },
            { "id": "friccao_cisalhamento", "label": "Fricção e cisalhamento", "options": [
              { "value": 1, "label": "Problema" },
              { "value": 2, "label": "Problema em potencial" },
              { "value": 3, "label": "Nenhum problema" }
            ] }
          ],
          "classification": [
            { "min": 19, "max": 23, "label": "Sem risco", "color": "green" },
            { "min": 15, "max": 18, "label": "Risco baixo", "color": "blue" },
            { "min": 13, "max": 14, "label": "Risco moderado", "color": "yellow" },
            { "min": 10, "max": 12, "label": "Risco alto", "color": "orange" },
            { "min": 0, "max": 9, "label": "Risco muito alto", "color": "red" }
          ]
        },
        {
          "id": "lesoes",
          "type": "table",
          "label": "Lesões de pele",
          "columns": [
            { "id": "data", "type": "date", "label": "Data" },
            { "id": "tipo", "type": "text", "label": "Tipo (LPP, cirúrgica, etc)" },
            { "id": "local", "type": "text", "label": "Local" },
            { "id": "estagio", "type": "text", "label": "Estágio" },
            { "id": "push", "type": "number", "label": "PUSH" },
            { "id": "cobertura", "type": "text", "label": "Cobertura" },
            { "id": "proxima_troca", "type": "date", "label": "Próxima troca" }
          ]
        }
      ]
    },
    {
      "id": "dispositivos",
      "title": "Dispositivos invasivos",
      "narrative": { "enabled": true, "hint": "Local, tempo de uso, sinais flogísticos" },
      "fields": [
        {
          "id": "lista_dispositivos",
          "type": "table",
          "label": "Dispositivos em uso",
          "columns": [
            { "id": "tipo", "type": "select", "label": "Tipo", "options": [
              { "value": "AVP", "label": "Acesso venoso periférico" },
              { "value": "CVC", "label": "Cateter venoso central" },
              { "value": "PICC", "label": "PICC" },
              { "value": "PAI", "label": "Pressão arterial invasiva" },
              { "value": "SVD", "label": "Sonda vesical demora" },
              { "value": "SNE", "label": "Sonda nasoenteral" },
              { "value": "SNG", "label": "Sonda nasogástrica" },
              { "value": "TOT", "label": "TOT" },
              { "value": "TQT", "label": "TQT" },
              { "value": "DRENO", "label": "Dreno" },
              { "value": "OUTRO", "label": "Outro" }
            ] },
            { "id": "local", "type": "text", "label": "Local" },
            { "id": "data_insercao", "type": "date", "label": "Data de inserção" },
            { "id": "dias_uso", "type": "number", "label": "Dias de uso" }
          ]
        }
      ]
    },
    {
      "id": "bundles",
      "title": "Bundles aplicados no turno",
      "description": "Conformidade dos bundles assistenciais conforme protocolo.",
      "narrative": { "enabled": true, "hint": "Motivos de não conformidade" },
      "fields": [
        {
          "id": "bundles_checklist",
          "type": "tri_state_checklist",
          "label": "Bundles",
          "extractAs": "bundles_status",
          "items": [
            { "id": "ics", "label": "Bundle ICS (cateter venoso central)" },
            { "id": "pav", "label": "Bundle PAV (pneumonia associada à VM)" },
            { "id": "pam", "label": "Bundle PAM (artéria pulmonar)" },
            { "id": "itu", "label": "Bundle ITU (sonda vesical)" }
          ]
        }
      ]
    },
    {
      "id": "riscos_nanda",
      "title": "Riscos do paciente (NANDA)",
      "description": "Avaliação dos 10 diagnósticos de enfermagem padrão Rede D'Or.",
      "narrative": { "enabled": true, "hint": "Justificativa pra aceitar/recusar cada risco" },
      "fields": [
        {
          "id": "riscos_status",
          "type": "tri_state_checklist",
          "label": "Status dos riscos (SIM = aceito; NÃO = recusado; N/A = não avaliado)",
          "extractAs": "nanda_riscos",
          "items": [
            { "id": "dor_aguda", "label": "Dor aguda, risco de" },
            { "id": "broncoaspiracao", "label": "Risco de broncoaspiração" },
            { "id": "confusao_aguda", "label": "Risco de confusão aguda" },
            { "id": "glicemia_instavel", "label": "Risco de glicemia instável" },
            { "id": "lesao_pressao", "label": "Risco de lesão por pressão" },
            { "id": "queda", "label": "Risco de queda" },
            { "id": "sangramento", "label": "Risco de sangramento" },
            { "id": "idoso_fragil", "label": "Risco de síndrome do idoso frágil" },
            { "id": "termorregulacao", "label": "Risco de termorregulação ineficaz" },
            { "id": "trombose", "label": "Risco de trombose" }
          ]
        }
      ]
    },
    {
      "id": "metas",
      "title": "Metas do dia",
      "narrative": { "enabled": true, "hint": "Justificativa, dependências entre metas" },
      "fields": [
        {
          "id": "lista_metas",
          "type": "table",
          "label": "Metas",
          "columns": [
            { "id": "descricao", "type": "text", "label": "Meta", "required": true },
            { "id": "prazo", "type": "text", "label": "Prazo (ex: 3 dias)" },
            { "id": "data_inicio", "type": "date", "label": "Início" },
            { "id": "status", "type": "select", "label": "Status", "options": [
              { "value": "EM_ANDAMENTO", "label": "Em andamento" },
              { "value": "ATINGIDA", "label": "Atingida" },
              { "value": "SUSPENSA", "label": "Suspensa" },
              { "value": "NAO_ATINGIDA", "label": "Não atingida" }
            ] }
          ]
        }
      ]
    },
    {
      "id": "comunicacao_familia",
      "title": "Comunicação familiar",
      "narrative": { "enabled": true, "hint": "Quem foi orientado, conteúdo da orientação, reações" },
      "fields": [
        { "id": "familiar_orientado", "type": "boolean", "label": "Familiar orientado no período?" },
        { "id": "familiar_nome", "type": "text", "label": "Familiar (vínculo + nome)", "visibleWhen": { "field": "familiar_orientado", "equals": true } },
        { "id": "horario_orientacao", "type": "datetime", "label": "Horário", "visibleWhen": { "field": "familiar_orientado", "equals": true } }
      ]
    },
    {
      "id": "observacoes_finais",
      "title": "Outras observações",
      "narrative": { "enabled": true, "hint": "Qualquer informação clínica que não coube nas seções acima" },
      "fields": [
        {
          "id": "exames_pendentes",
          "type": "textarea",
          "label": "Exames pendentes / programados",
          "rows": 2
        }
      ]
    }
  ]
}

$tmpl_evol$::jsonb,
  version = version + 1,
  updated_at = NOW()
WHERE name = 'Evolução de Enfermagem';

UPDATE public.report_templates
SET
  schema = $tmpl_sbar$
{
  "id": "transicao_cuidado_sbar_v2",
  "name": "Transição de Cuidado SBAR (Enfermagem)",
  "description": "Passagem de plantão estruturada no formato SBAR — Situação / Background / Atualidade / Recomendações.",
  "version": 2,
  "layout": "sbar",
  "metadata": {
    "captureMode": "voice",
    "applicableRoles": ["nurse"],
    "applicableWardTypes": ["uti", "enfermaria", "pronto_socorro"]
  },
  "sections": [
    {
      "id": "situacao",
      "sbarRole": "S",
      "title": "Situação atual",
      "narrative": { "enabled": true, "hint": "Apresentação resumida do paciente, contexto crítico do momento" },
      "fields": [
        {
          "id": "diagnostico_principal",
          "type": "text",
          "label": "Diagnóstico principal",
          "required": true
        },
        {
          "id": "fugulin",
          "type": "radio",
          "label": "Fugulin — grau de dependência",
          "options": [
            { "value": "MINIMOS", "label": "Cuidados mínimos" },
            { "value": "INTERMEDIARIOS", "label": "Cuidados intermediários" },
            { "value": "ALTA_DEPENDENCIA", "label": "Alta dependência" },
            { "value": "SEMI_INTENSIVO", "label": "Semi-intensivo" },
            { "value": "INTENSIVO", "label": "Intensivo" }
          ]
        },
        {
          "id": "nas_pontuacao",
          "type": "radio",
          "label": "NAS — pontuação",
          "options": [
            { "value": "ABAIXO_50", "label": "< 50 pontos" },
            { "value": "ACIMA_50", "label": ">= 50 pontos" }
          ]
        },
        {
          "id": "cuidado_paliativo",
          "type": "boolean",
          "label": "Cuidado paliativo?"
        },
        {
          "id": "pulseira_identificacao_legivel",
          "type": "boolean",
          "label": "Pulseira de identificação legível?"
        },
        {
          "id": "precaucao",
          "type": "multi_checkbox",
          "label": "Precauções",
          "options": [
            { "value": "NA", "label": "N/A" },
            { "value": "CONTATO", "label": "Contato" },
            { "value": "GOTICULAS", "label": "Gotículas" },
            { "value": "AEROSSOIS", "label": "Aerossóis" }
          ]
        },
        {
          "id": "protocolos",
          "type": "multi_checkbox",
          "label": "Protocolos ativos",
          "options": [
            { "value": "RASTREAMENTO", "label": "Rastreamento" },
            { "value": "SEPSE", "label": "Sepse" },
            { "value": "DOR_TORACICA", "label": "Dor torácica" },
            { "value": "AVC", "label": "AVC" }
          ]
        },
        {
          "id": "riscos_clinicos",
          "type": "multi_checkbox",
          "label": "Riscos clínicos",
          "options": [
            { "value": "QUEDA", "label": "Queda" },
            { "value": "LP", "label": "LP (lesão por pressão)" },
            { "value": "HEMORRAGIA", "label": "Hemorragia" },
            { "value": "BRONCOASPIRACAO", "label": "Broncoaspiração" },
            { "value": "RISCO_VENTILATORIO", "label": "Risco ventilatório" },
            { "value": "DELIRIUM", "label": "Delirium" },
            { "value": "RISCO_DOR", "label": "Risco de dor" },
            { "value": "IRAS", "label": "IRAS" },
            { "value": "DOR_TORACICA", "label": "Dor torácica" },
            { "value": "FA", "label": "FA" },
            { "value": "SEPSE", "label": "Sepse" },
            { "value": "PNM", "label": "PNM" },
            { "value": "IC", "label": "Insuficiência cardíaca" },
            { "value": "TEV", "label": "TEV" }
          ]
        }
      ]
    },
    {
      "id": "background",
      "sbarRole": "B",
      "title": "Background",
      "narrative": { "enabled": true, "hint": "Antecedentes relevantes, evolução até o momento atual" },
      "fields": [
        {
          "id": "hpp",
          "type": "textarea",
          "label": "HPP (história patológica pregressa)",
          "rows": 3
        },
        {
          "id": "alergia",
          "type": "text",
          "label": "Alergia (medicamentos, alimentos, látex)"
        }
      ]
    },
    {
      "id": "atualidade",
      "sbarRole": "A",
      "title": "Atualidade",
      "narrative": { "enabled": true, "hint": "Estado clínico atual detalhado, observações por sistema, terapêutica em curso" },
      "fields": [
        {
          "id": "nivel_consciencia",
          "type": "radio",
          "label": "Nível de consciência",
          "options": [
            { "value": "ACORDADO", "label": "Acordado" },
            { "value": "SONOLENTO", "label": "Sonolento" },
            { "value": "TORPOROSO", "label": "Torporoso" },
            { "value": "SEDADO", "label": "Sedado" },
            { "value": "COMATOSO", "label": "Comatoso" },
            { "value": "ORIENTADO", "label": "Orientado" },
            { "value": "DESORIENTADO", "label": "Desorientado" }
          ]
        },
        {
          "id": "cam_icu",
          "type": "radio",
          "label": "CAM-ICU",
          "visibleWhen": { "field": "nivel_consciencia", "in": ["SEDADO", "COMATOSO", "TORPOROSO"] },
          "options": [
            { "value": "SD", "label": "SD" },
            { "value": "SN", "label": "SN" }
          ]
        },
        {
          "id": "flutuacao_consciencia_24h",
          "type": "radio",
          "label": "Houve flutuação do nível de consciência nas últimas 24h?",
          "options": [
            { "value": "S", "label": "Sim" },
            { "value": "N", "label": "Não" },
            { "value": "NA", "label": "N/A" }
          ]
        },
        {
          "id": "protocolo_contencao",
          "type": "radio",
          "label": "Protocolo de contenção mecânica",
          "options": [
            { "value": "S", "label": "Sim" },
            { "value": "N", "label": "Não" },
            { "value": "NA", "label": "N/A" }
          ]
        },
        {
          "id": "ventilatorio",
          "type": "select",
          "label": "Ventilatório",
          "options": [
            { "value": "AR_AMBIENTE", "label": "Ar ambiente" },
            { "value": "MACRO_CAT_NASAL", "label": "Macro / cateter nasal" },
            { "value": "VNI", "label": "VNI" },
            { "value": "TOT_TQT", "label": "TOT / TQT" }
          ]
        },
        {
          "id": "tot_tqt_numero",
          "type": "text",
          "label": "TOT / TQT — Nº",
          "visibleWhen": { "field": "ventilatorio", "equals": "TOT_TQT" }
        },
        {
          "id": "modo_vent",
          "type": "text",
          "label": "Modo ventilatório",
          "visibleWhen": { "field": "ventilatorio", "in": ["TOT_TQT", "VNI"] }
        },
        {
          "id": "peep_atual",
          "type": "number_with_unit",
          "label": "PEEP",
          "unit": "cmH2O",
          "visibleWhen": { "field": "ventilatorio", "in": ["TOT_TQT", "VNI"] }
        },
        {
          "id": "aspiracao_subglotica",
          "type": "radio",
          "label": "Aspiração subglótica",
          "visibleWhen": { "field": "ventilatorio", "equals": "TOT_TQT" },
          "options": [
            { "value": "CONTINUA", "label": "Contínua" },
            { "value": "INTERMITENTE", "label": "Intermitente" },
            { "value": "NA", "label": "N/A" }
          ]
        },
        {
          "id": "comissura_labial",
          "type": "text",
          "label": "Comissura labial — secreção"
        },
        {
          "id": "dieta",
          "type": "multi_checkbox",
          "label": "Dieta",
          "options": [
            { "value": "ORAL", "label": "Oral" },
            { "value": "ZERO", "label": "Dieta ZERO" },
            { "value": "ENTERAL", "label": "Enteral" },
            { "value": "PARENTERAL", "label": "Parenteral" }
          ]
        },
        {
          "id": "motivo_dieta_zero",
          "type": "text",
          "label": "Motivo da dieta ZERO",
          "visibleWhen": { "field": "dieta", "contains": "ZERO" }
        },
        {
          "id": "vazao_enteral",
          "type": "number_with_unit",
          "label": "Vazão enteral",
          "unit": "ml/h",
          "visibleWhen": { "field": "dieta", "contains": "ENTERAL" }
        },
        {
          "id": "aceitacao",
          "type": "text",
          "label": "Aceitação",
          "visibleWhen": {
            "any": [
              { "field": "dieta", "contains": "ORAL" },
              { "field": "dieta", "contains": "ENTERAL" }
            ]
          }
        },
        {
          "id": "dispositivos_vasculares",
          "type": "table",
          "label": "Dispositivos vasculares",
          "columns": [
            {
              "id": "tipo",
              "type": "select",
              "label": "Tipo",
              "options": [
                { "value": "PERIFERICA", "label": "Periférica" },
                { "value": "PROFUNDA", "label": "Profunda" },
                { "value": "PICC", "label": "PICC" }
              ]
            },
            { "id": "dias", "type": "number", "label": "Dias" },
            { "id": "local", "type": "text", "label": "Local" },
            { "id": "bundle_ipcs", "type": "boolean", "label": "Bundle IPCS aplicado" }
          ]
        },
        {
          "id": "curativo_sem_pelicula",
          "type": "radio",
          "label": "Algum curativo sem película CHG?",
          "options": [
            { "value": "S", "label": "Sim" },
            { "value": "N", "label": "Não" }
          ]
        },
        {
          "id": "motivo_sem_pelicula",
          "type": "text",
          "label": "Motivo",
          "visibleWhen": { "field": "curativo_sem_pelicula", "equals": "S" }
        },
        {
          "id": "drenos",
          "type": "table",
          "label": "Drenos",
          "columns": [
            { "id": "tipo", "type": "text", "label": "Tipo / local" },
            {
              "id": "estado",
              "type": "radio",
              "label": "Estado",
              "options": [
                { "value": "SEM_DRENO", "label": "Sem dreno" },
                { "value": "ABERTO", "label": "Dreno aberto" },
                { "value": "FECHADO", "label": "Dreno fechado" }
              ]
            },
            { "id": "aspecto", "type": "text", "label": "Aspecto" }
          ]
        },
        {
          "id": "solucoes",
          "type": "table",
          "label": "Soluções em curso",
          "columns": [
            { "id": "nome", "type": "text", "label": "Solução" },
            { "id": "vazao", "type": "number_with_unit", "label": "Vazão", "unit": "ml/h" }
          ]
        },
        {
          "id": "atb_em_uso",
          "type": "boolean",
          "label": "ATB em uso?"
        },
        {
          "id": "atb_lista",
          "type": "table",
          "label": "Antibioticoterapia",
          "visibleWhen": { "field": "atb_em_uso", "equals": true },
          "columns": [
            { "id": "nome", "type": "text", "label": "ATB" },
            { "id": "dia", "type": "number", "label": "D (dia de uso)" }
          ]
        },
        {
          "id": "lesoes_cutaneas",
          "type": "boolean",
          "label": "Há lesões cutâneas?"
        },
        {
          "id": "ficha_integridade_admissao",
          "type": "boolean",
          "label": "Realizada ficha de integridade cutânea na admissão",
          "visibleWhen": { "field": "lesoes_cutaneas", "equals": true }
        },
        {
          "id": "braden_classificacao",
          "type": "radio",
          "label": "Escala de BRADEN (classificação)",
          "options": [
            { "value": "MUITO_ALTO", "label": "Muito alto" },
            { "value": "ALTO", "label": "Alto" },
            { "value": "MODERADO", "label": "Moderado" },
            { "value": "LEVE", "label": "Leve" }
          ]
        },
        {
          "id": "lesao_localizacao",
          "type": "text",
          "label": "Localização / estágio",
          "visibleWhen": { "field": "lesoes_cutaneas", "equals": true }
        },
        {
          "id": "dor_periodo",
          "type": "radio",
          "label": "Dor no período",
          "options": [
            { "value": "SEM_DOR", "label": "Sem dor" },
            { "value": "LEVE", "label": "Leve" },
            { "value": "MODERADA", "label": "Moderada" },
            { "value": "INTENSA", "label": "Intensa" }
          ]
        },
        {
          "id": "dor_escala",
          "type": "scale",
          "label": "Escala de dor (0–10)",
          "min": 0,
          "max": 10,
          "step": 1,
          "labels": {
            "0": "Sem dor",
            "5": "Moderada",
            "10": "Máxima"
          },
          "visibleWhen": { "field": "dor_periodo", "notEquals": "SEM_DOR" }
        },
        {
          "id": "dor_conduta",
          "type": "textarea",
          "label": "Conduta: medicação e cuidados para aliviar a dor",
          "visibleWhen": { "field": "dor_periodo", "notEquals": "SEM_DOR" },
          "rows": 2
        },
        {
          "id": "duvidas_medicamentos",
          "type": "textarea",
          "label": "Esclarecimento de dúvidas sobre medicamentos em uso",
          "rows": 2
        },
        {
          "id": "ronda_qualidade",
          "type": "time_window_multi",
          "label": "Ronda da qualidade percebida — horários realizados",
          "windows": [
            { "id": "09", "label": "09:00" },
            { "id": "12", "label": "12:00" },
            { "id": "15", "label": "15:00" },
            { "id": "18", "label": "18:00" },
            { "id": "21", "label": "21:00" },
            { "id": "00", "label": "00:00" },
            { "id": "03", "label": "03:00" },
            { "id": "06", "label": "06:00" }
          ]
        },
        {
          "id": "banho",
          "type": "radio",
          "label": "Banho",
          "options": [
            { "value": "MANHA", "label": "Manhã" },
            { "value": "TARDE", "label": "Tarde" },
            { "value": "NOITE", "label": "Noite" }
          ]
        }
      ]
    },
    {
      "id": "recomendacoes",
      "sbarRole": "R",
      "title": "Recomendações",
      "narrative": { "enabled": true, "hint": "Cuidados a serem mantidos pelo turno seguinte, pendências, sinais de alerta" },
      "fields": [
        {
          "id": "exames_realizados",
          "type": "textarea",
          "label": "Exames e procedimentos realizados",
          "rows": 2
        },
        {
          "id": "exames_programados",
          "type": "table",
          "label": "Programado / agendado",
          "columns": [
            { "id": "exame", "type": "text", "label": "Exame / procedimento" },
            { "id": "data", "type": "datetime", "label": "Agendado para" }
          ]
        },
        {
          "id": "outras_programacoes",
          "type": "textarea",
          "label": "Outras programações",
          "rows": 2
        },
        {
          "id": "alta_prevista",
          "type": "boolean",
          "label": "Alta prevista?"
        },
        {
          "id": "data_alta_prevista",
          "type": "date",
          "label": "Data prevista da alta",
          "visibleWhen": { "field": "alta_prevista", "equals": true }
        }
      ]
    }
  ]
}

$tmpl_sbar$::jsonb,
  version = version + 1,
  updated_at = NOW()
WHERE name = 'Transição de Cuidado SBAR (Enfermagem)';

COMMIT;
