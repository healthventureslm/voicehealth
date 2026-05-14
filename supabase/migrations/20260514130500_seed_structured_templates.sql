-- Seed dos primeiros 2 templates no modo estruturado (Fase 3).
--
-- Remove os antigos equivalentes (modo markdown legado) pra evitar
-- duplicação no picker. Templates legados que tenham nomes diferentes
-- ficam intocados.
--
-- Limpeza segura: clinical_reports já gerados ficam preservados, só
-- perdem a referência ao template (template_id → NULL).

BEGIN;

-- 1. Quebra referências em clinical_reports antes de deletar os templates.
UPDATE public.clinical_reports
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.report_templates
  WHERE name IN (
    'Evolução de Enfermagem',
    'Evolução de Enfermagem (SAE)',
    'Passagem de Plantão',
    'Passagem de Plantão UTI — ISBAR'
  )
);

-- 2. Quebra referências em consultations (template_id).
UPDATE public.consultations
SET template_id = NULL
WHERE template_id IN (
  SELECT id FROM public.report_templates
  WHERE name IN (
    'Evolução de Enfermagem',
    'Evolução de Enfermagem (SAE)',
    'Passagem de Plantão',
    'Passagem de Plantão UTI — ISBAR'
  )
);

-- 3. Remove os templates antigos.
DELETE FROM public.report_templates
WHERE name IN (
  'Evolução de Enfermagem',
  'Evolução de Enfermagem (SAE)',
  'Passagem de Plantão',
  'Passagem de Plantão UTI — ISBAR'
);

-- 4. Insere os novos templates com schema estruturado populado.
--    prompt = '' porque o fluxo estruturado não usa esse campo.
INSERT INTO public.report_templates (
  name, description, prompt, schema,
  applicable_roles, applicable_ward_types, is_active, version
)
VALUES (
  'Evolução de Enfermagem',
  'Evolução diária de enfermagem em UTI/Enfermaria. Cobre avaliação por sistemas + escalas obrigatórias.',
  '',
  $tmpl_evol$
{
  "id": "evolucao_enfermagem_v1",
  "name": "Evolução de Enfermagem",
  "description": "Evolução diária de enfermagem em UTI/Enfermaria. Cobre avaliação por sistemas + escalas obrigatórias.",
  "version": 1,
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
        }
      ]
    },
    {
      "id": "avaliacao_geral",
      "title": "Avaliação geral",
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
            { "value": "COM_AUXILIO", "label": "Deambulação com auxílio (de outros / dispositivos)" },
            { "value": "ACAMADO", "label": "Acamado / não deambula" }
          ]
        },
        {
          "id": "prevencao_tev_ativa",
          "type": "boolean",
          "label": "Prevenção de TEV ativa?"
        },
        {
          "id": "prevencao_tev_tipos",
          "type": "multi_checkbox",
          "label": "Tipo(s) de prevenção",
          "visibleWhen": { "field": "prevencao_tev_ativa", "equals": true },
          "options": [
            { "value": "FARMACOLOGICA", "label": "Profilaxia farmacológica" },
            { "value": "MECANICA", "label": "Profilaxia mecânica" },
            { "value": "DEAMBULACAO", "label": "Deambulação" }
          ]
        },
        {
          "id": "uso_compressor_horas",
          "type": "number_with_unit",
          "label": "Uso do compressor",
          "unit": "h/dia",
          "min": 0,
          "max": 24,
          "visibleWhen": { "field": "prevencao_tev_tipos", "contains": "MECANICA" }
        },
        {
          "id": "morse",
          "type": "scored_scale",
          "label": "MORSE — escala de risco de queda",
          "items": [
            {
              "id": "historico_quedas",
              "label": "Histórico de quedas (últimos 3 meses)",
              "options": [
                { "value": 0, "label": "Não" },
                { "value": 25, "label": "Sim" }
              ]
            },
            {
              "id": "diagnostico_secundario",
              "label": "Diagnóstico secundário",
              "options": [
                { "value": 0, "label": "Não" },
                { "value": 15, "label": "Sim" }
              ]
            },
            {
              "id": "auxilio_deambulacao",
              "label": "Auxílio na deambulação",
              "options": [
                { "value": 0, "label": "Nenhum / repouso / auxílio de profissional" },
                { "value": 15, "label": "Muletas, bengala ou andador" },
                { "value": 30, "label": "Apoia-se em mobiliário" }
              ]
            },
            {
              "id": "terapia_endovenosa",
              "label": "Terapia endovenosa / acesso periférico",
              "options": [
                { "value": 0, "label": "Não" },
                { "value": 20, "label": "Sim" }
              ]
            },
            {
              "id": "marcha",
              "label": "Marcha",
              "options": [
                { "value": 0, "label": "Normal / sem deambulação" },
                { "value": 10, "label": "Debilitada" },
                { "value": 20, "label": "Cambaleante / desequilibrada" }
              ]
            },
            {
              "id": "estado_mental_morse",
              "label": "Estado mental",
              "options": [
                { "value": 0, "label": "Orientado quanto à própria capacidade" },
                { "value": 15, "label": "Superestima ou esquece limitações" }
              ]
            }
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
          "label": "NAS — grau de dependência (% de carga de trabalho)",
          "min": 0,
          "max": 200,
          "step": 0.1
        }
      ]
    },
    {
      "id": "precaucoes",
      "title": "Precauções",
      "fields": [
        {
          "id": "lista_precaucoes",
          "type": "table",
          "label": "Precauções ativas",
          "columns": [
            {
              "id": "tipo",
              "type": "select",
              "label": "Tipo",
              "required": true,
              "options": [
                { "value": "CONTATO", "label": "Contato" },
                { "value": "GOTICULAS", "label": "Gotículas" },
                { "value": "AEROSSOIS", "label": "Aerossóis" },
                { "value": "PROTETIVA", "label": "Protetiva" }
              ]
            },
            { "id": "motivo", "type": "text", "label": "Motivo", "required": true },
            { "id": "inicio", "type": "date", "label": "Início", "required": true },
            { "id": "microorganismo_mdr", "type": "text", "label": "Microorganismo MDR (se aplicável)" }
          ]
        }
      ]
    },
    {
      "id": "neurologica",
      "title": "Avaliação neurológica",
      "fields": [
        {
          "id": "nivel_consciencia",
          "type": "radio",
          "label": "Nível de consciência",
          "options": [
            { "value": "ALERTA", "label": "Alerta" },
            { "value": "SONOLENTO", "label": "Sonolento" },
            { "value": "COMATOSO", "label": "Comatoso" },
            { "value": "SEDADO", "label": "Sedado" }
          ]
        },
        {
          "id": "estado_mental",
          "type": "radio",
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
          "id": "rass",
          "type": "scored_scale",
          "label": "RASS (Richmond Agitation-Sedation Scale)",
          "items": [
            {
              "id": "rass_nivel",
              "label": "Nível",
              "options": [
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
              ]
            }
          ]
        },
        {
          "id": "cam_icu",
          "type": "radio",
          "label": "CAM-ICU (avaliação de delirium)",
          "options": [
            { "value": "HA_DELIRIUM", "label": "Há delirium" },
            { "value": "SEM_DELIRIUM", "label": "Sem delirium" },
            { "value": "NAO_AVALIADO", "label": "Não avaliado" }
          ]
        },
        {
          "id": "contencao_mecanica",
          "type": "boolean",
          "label": "Contenção mecânica?"
        },
        {
          "id": "pupilas",
          "type": "radio",
          "label": "Pupilas",
          "options": [
            { "value": "ISOCORICAS", "label": "Isocóricas" },
            { "value": "ANISOCORICAS", "label": "Anisocóricas" }
          ]
        },
        {
          "id": "reacao_fotomotora",
          "type": "radio",
          "label": "Reação fotomotora",
          "options": [
            { "value": "PRESENTE", "label": "Presente" },
            { "value": "AUSENTE", "label": "Ausente" }
          ]
        }
      ]
    },
    {
      "id": "cardiovascular",
      "title": "Avaliação cardiovascular",
      "fields": [
        {
          "id": "hemodinamica",
          "type": "radio",
          "label": "Hemodinâmica",
          "options": [
            { "value": "ESTAVEL", "label": "Estável" },
            { "value": "INSTAVEL", "label": "Instável" }
          ]
        },
        {
          "id": "ritmo_cardiaco",
          "type": "radio",
          "label": "Ritmo cardíaco",
          "options": [
            { "value": "REGULAR", "label": "Regular" },
            { "value": "IRREGULAR", "label": "Irregular" }
          ]
        },
        {
          "id": "extremidades",
          "type": "radio",
          "label": "Extremidades",
          "options": [
            { "value": "QUENTES", "label": "Quentes" },
            { "value": "FRIAS", "label": "Frias" },
            { "value": "SEM_ALTERACOES", "label": "Sem alterações" }
          ]
        },
        {
          "id": "perfusao_periferica",
          "type": "radio",
          "label": "Perfusão periférica",
          "options": [
            { "value": "NORMAL", "label": "Normal" },
            { "value": "LENTIFICADA", "label": "Lentificada" }
          ]
        },
        {
          "id": "panturrilha_empastada",
          "type": "boolean",
          "label": "Panturrilha empastada?"
        },
        {
          "id": "edema",
          "type": "radio",
          "label": "Edema",
          "options": [
            { "value": "AUSENTE", "label": "Ausente" },
            { "value": "PRESENTE", "label": "Presente" }
          ]
        }
      ]
    },
    {
      "id": "respiratoria",
      "title": "Avaliação respiratória / torácica",
      "fields": [
        {
          "id": "padrao_respiratorio",
          "type": "radio",
          "label": "Padrão respiratório",
          "options": [
            { "value": "EUPNEICO", "label": "Eupneico" },
            { "value": "DISPNEICO", "label": "Dispneico" },
            { "value": "TAQUIPNEICO", "label": "Taquipneico" },
            { "value": "BRADIPNEICO", "label": "Bradipneico" }
          ]
        },
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
            { "value": "SVNI", "label": "SVNI" },
            { "value": "VM", "label": "VM (ventilação mecânica)" }
          ]
        },
        {
          "id": "modo_ventilatorio",
          "type": "select",
          "label": "Modo ventilatório",
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" },
          "options": [
            { "value": "PCV", "label": "PCV" },
            { "value": "VCV", "label": "VCV" },
            { "value": "PSV", "label": "PSV" },
            { "value": "SIMV", "label": "SIMV" },
            { "value": "OUTRO", "label": "Outro" }
          ]
        },
        {
          "id": "vc",
          "type": "number_with_unit",
          "label": "VC (volume corrente)",
          "unit": "ml",
          "min": 0,
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" }
        },
        {
          "id": "peep",
          "type": "number_with_unit",
          "label": "PEEP",
          "unit": "cmH2O",
          "min": 0,
          "visibleWhen": { "field": "suporte_ventilatorio", "equals": "VM" }
        },
        {
          "id": "fio2",
          "type": "number_with_unit",
          "label": "FiO2",
          "unit": "%",
          "min": 21,
          "max": 100,
          "visibleWhen": {
            "field": "suporte_ventilatorio",
            "in": ["VM", "ALTO_FLUXO", "SVNI", "MASCARA"]
          }
        },
        {
          "id": "tosse",
          "type": "radio",
          "label": "Avaliação de tosse",
          "options": [
            { "value": "AUSENTE", "label": "Ausente" },
            { "value": "SECA", "label": "Seca" },
            { "value": "PRODUTIVA_EFICAZ", "label": "Produtiva e eficaz" },
            { "value": "PRODUTIVA_INEFICAZ", "label": "Produtiva e ineficaz" }
          ]
        }
      ]
    },
    {
      "id": "abdominal",
      "title": "Avaliação abdominal / gastrointestinal",
      "fields": [
        {
          "id": "dieta",
          "type": "radio",
          "label": "Dieta",
          "options": [
            { "value": "ORAL", "label": "Dieta oral" },
            { "value": "ENTERAL", "label": "Dieta enteral" },
            { "value": "PARENTERAL", "label": "Dieta parenteral" },
            { "value": "JEJUM", "label": "Jejum" }
          ]
        },
        {
          "id": "aceitacao",
          "type": "radio",
          "label": "Aceitação",
          "visibleWhen": { "field": "dieta", "in": ["ORAL", "ENTERAL"] },
          "options": [
            { "value": "TOTAL", "label": "Aceitação total" },
            { "value": "PARCIAL", "label": "Aceitação parcial" },
            { "value": "INAPETENTE", "label": "Inapetente" },
            { "value": "NA", "label": "N/A" }
          ]
        },
        {
          "id": "vazao_enteral",
          "type": "number_with_unit",
          "label": "Vazão enteral",
          "unit": "ml/h",
          "visibleWhen": { "field": "dieta", "equals": "ENTERAL" }
        },
        {
          "id": "abdome",
          "type": "radio",
          "label": "Abdome",
          "options": [
            { "value": "FLACIDO", "label": "Flácido" },
            { "value": "GLOBOSO", "label": "Globoso" },
            { "value": "PLANO", "label": "Plano" },
            { "value": "DISTENDIDO", "label": "Distendido" }
          ]
        },
        {
          "id": "rha",
          "type": "radio",
          "label": "RHA (ruídos hidroaéreos)",
          "options": [
            { "value": "PRESENTE", "label": "Presente" },
            { "value": "AUSENTE", "label": "Ausente" }
          ]
        },
        {
          "id": "dor_palpacao",
          "type": "boolean",
          "label": "Dor à palpação?"
        },
        {
          "id": "ultima_funcao_intestinal",
          "type": "date",
          "label": "Última função intestinal",
          "max": "today"
        }
      ]
    },
    {
      "id": "antropometria",
      "title": "Antropometria",
      "fields": [
        {
          "id": "peso",
          "type": "number_with_unit",
          "label": "Peso",
          "unit": "kg",
          "min": 0,
          "step": 0.1
        },
        {
          "id": "altura",
          "type": "number_with_unit",
          "label": "Estatura",
          "unit": "cm",
          "min": 0
        },
        {
          "id": "imc",
          "type": "computed",
          "label": "IMC",
          "unit": "kg/m²",
          "formula": {
            "kind": "expression",
            "expr": "peso / ((altura / 100) ^ 2)"
          }
        }
      ]
    },
    {
      "id": "infusoes",
      "title": "Infusões importantes",
      "fields": [
        {
          "id": "sem_infusoes",
          "type": "boolean",
          "label": "Paciente não possui infusões contínuas importantes"
        },
        {
          "id": "lista_infusoes",
          "type": "table",
          "label": "Infusões",
          "visibleWhen": { "field": "sem_infusoes", "equals": false },
          "columns": [
            { "id": "nome", "type": "text", "label": "Infusão", "required": true },
            { "id": "dose", "type": "text", "label": "Dose", "required": true },
            { "id": "unidade", "type": "text", "label": "Unidade" },
            { "id": "inicio", "type": "datetime", "label": "Início" },
            { "id": "fim", "type": "datetime", "label": "Fim previsto" }
          ]
        }
      ]
    },
    {
      "id": "pele",
      "title": "Avaliação de pele e mucosas",
      "fields": [
        {
          "id": "estado_pele",
          "type": "multi_checkbox",
          "label": "Estado",
          "options": [
            { "value": "INTEGRAS", "label": "Pele e mucosas íntegras" },
            { "value": "HIPOCORADA", "label": "Hipocorada" },
            { "value": "DESIDRATADA", "label": "Desidratada" },
            { "value": "ICTERICA", "label": "Ictérica" },
            { "value": "ANASARCA", "label": "Anasarca" },
            { "value": "XERODERMIA", "label": "Xerodermia" },
            { "value": "MUCOSITE", "label": "Mucosite / monoliáse oral" }
          ]
        },
        {
          "id": "braden",
          "type": "scored_scale",
          "label": "BRADEN — risco de lesão por pressão",
          "items": [
            {
              "id": "percepcao_sensorial",
              "label": "Percepção sensorial",
              "options": [
                { "value": 1, "label": "Totalmente limitado" },
                { "value": 2, "label": "Muito limitado" },
                { "value": 3, "label": "Levemente limitado" },
                { "value": 4, "label": "Nenhuma limitação" }
              ]
            },
            {
              "id": "umidade",
              "label": "Umidade",
              "options": [
                { "value": 1, "label": "Completamente molhado" },
                { "value": 2, "label": "Muito molhado" },
                { "value": 3, "label": "Ocasionalmente molhado" },
                { "value": 4, "label": "Raramente molhado" }
              ]
            },
            {
              "id": "atividade",
              "label": "Atividade",
              "options": [
                { "value": 1, "label": "Acamado" },
                { "value": 2, "label": "Confinado à cadeira" },
                { "value": 3, "label": "Anda ocasionalmente" },
                { "value": 4, "label": "Anda frequentemente" }
              ]
            },
            {
              "id": "mobilidade",
              "label": "Mobilidade",
              "options": [
                { "value": 1, "label": "Totalmente imóvel" },
                { "value": 2, "label": "Bastante limitado" },
                { "value": 3, "label": "Levemente limitado" },
                { "value": 4, "label": "Não apresenta limitação" }
              ]
            },
            {
              "id": "nutricao",
              "label": "Nutrição",
              "options": [
                { "value": 1, "label": "Muito pobre" },
                { "value": 2, "label": "Provavelmente inadequado" },
                { "value": 3, "label": "Adequado" },
                { "value": 4, "label": "Excelente" }
              ]
            },
            {
              "id": "friccao_cisalhamento",
              "label": "Fricção e cisalhamento",
              "options": [
                { "value": 1, "label": "Problema" },
                { "value": 2, "label": "Problema em potencial" },
                { "value": 3, "label": "Nenhum problema" }
              ]
            }
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
            { "id": "tipo", "type": "text", "label": "Tipo" },
            { "id": "local", "type": "text", "label": "Local" },
            { "id": "push", "type": "number", "label": "PUSH" }
          ]
        }
      ]
    },
    {
      "id": "bundles",
      "title": "Bundles aplicados no turno",
      "description": "Marcar conformidade dos bundles assistenciais conforme protocolo.",
      "fields": [
        {
          "id": "bundles_checklist",
          "type": "tri_state_checklist",
          "label": "Bundles",
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
      "id": "observacoes",
      "title": "Outras observações",
      "fields": [
        {
          "id": "observacoes",
          "type": "textarea",
          "label": "Observações livres",
          "rows": 4
        }
      ]
    }
  ]
}

$tmpl_evol$::jsonb,
  ARRAY['nurse']::app_role[],
  ARRAY['uti', 'enfermaria']::ward_type[],
  TRUE,
  1
);

INSERT INTO public.report_templates (
  name, description, prompt, schema,
  applicable_roles, applicable_ward_types, is_active, version
)
VALUES (
  'Transição de Cuidado SBAR (Enfermagem)',
  'Passagem de plantão estruturada no formato SBAR — Situação / Background / Atualidade / Recomendações.',
  '',
  $tmpl_sbar$
{
  "id": "transicao_cuidado_sbar_v1",
  "name": "Transição de Cuidado SBAR (Enfermagem)",
  "description": "Passagem de plantão estruturada no formato SBAR — Situação / Background / Atualidade / Recomendações.",
  "version": 1,
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
  ARRAY['nurse']::app_role[],
  ARRAY['uti', 'enfermaria', 'pronto_socorro']::ward_type[],
  TRUE,
  1
);

COMMIT;
