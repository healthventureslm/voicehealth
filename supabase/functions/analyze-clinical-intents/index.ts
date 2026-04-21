import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_INTENT_MAP: Record<string, string[]> = {
  medico: ["exam_request", "prescription", "hospitalization", "high_cost_med", "transfer", "discharge", "medical_evolution", "icu_evolution", "surgical_note", "interconsult", "handoff_isbar"],
  enfermeiro: ["nursing_note", "nursing_evolution", "vital_signs", "transfer", "handoff_isbar"],
  tecnico: ["nursing_note", "vital_signs"],
  nutricionista: ["diet_prescription"],
  fisioterapeuta: ["rehab_evolution"],
  fonoaudiologo: ["speech_eval"],
  psicologo: ["psych_eval"],
  assistente_social: ["social_report"],
  farmaceutico: ["prescription"],
  admin: [
    "exam_request", "prescription", "hospitalization", "high_cost_med", "transfer", "discharge",
    "nursing_note", "nursing_evolution", "vital_signs", "diet_prescription", "rehab_evolution",
    "speech_eval", "psych_eval", "social_report",
    "medical_evolution", "icu_evolution", "surgical_note", "interconsult", "handoff_isbar",
  ],
};

const INTENT_DESCRIPTIONS: Record<string, string> = {
  exam_request: "exam_request: quando o médico pede/solicita exame(s). REGRA DE AGRUPAMENTO: Agrupe TODOS os exames laboratoriais (sangue, urina, fezes — ex: hemograma, glicose, ureia, creatinina, sódio, potássio, magnésio, cálcio, troponina, TGO, TGP, PCR, EAS, etc.) em UM ÚNICO intent com exam_category='laboratorial' e exam_list contendo a lista de exames. Para exames de IMAGEM (raio-X, tomografia, ressonância, ultrassom, ecocardiograma) ou PROCEDIMENTOS (ECG, EEG, endoscopia, colonoscopia, biópsia), gere UM intent SEPARADO para cada um com exam_category='imagem' ou 'procedimento'.",
  prescription: "prescription: quando prescreve/receita medicamento(s). Gere UM intent por medicamento.",
  hospitalization: "hospitalization: quando decide internar o paciente.",
  high_cost_med: "high_cost_med: quando menciona medicamento de alto custo, medicamento especial, ou LME.",
  transfer: "transfer: quando decide transferir o paciente para outro setor/unidade.",
  discharge: "discharge: quando decide dar alta ao paciente.",
  nursing_note: "nursing_note: anotação de enfermagem, registro de cuidados, passagem de plantão, balanço hídrico.",
  nursing_evolution: "nursing_evolution: evolução de enfermagem com avaliação SOAPIE ou similar.",
  vital_signs: "vital_signs: registro de sinais vitais (PA, FC, FR, T, SpO2, etc.).",
  diet_prescription: "diet_prescription: prescrição dietética, avaliação nutricional, plano alimentar.",
  rehab_evolution: "rehab_evolution: evolução fisioterapêutica, avaliação funcional, plano de reabilitação.",
  speech_eval: "speech_eval: avaliação fonoaudiológica, evolução fono, teste de deglutição.",
  psych_eval: "psych_eval: avaliação psicológica, evolução psicológica, acompanhamento psicológico.",
  social_report: "social_report: relatório social, evolução social, avaliação socioeconômica.",
  medical_evolution: "medical_evolution: quando o médico dita/relata evolução clínica diária do paciente internado (formato SOAP — subjetivo, objetivo, avaliação, plano). Frases como 'paciente evoluiu bem', 'fazendo evolução', 'anotando evolução'.",
  icu_evolution: "icu_evolution: evolução específica de UTI, mencionando parâmetros ventilatórios, vasopressores, SOFA score, balanço hídrico, sedoanalgesia, CAM-ICU, Glasgow detalhado.",
  surgical_note: "surgical_note: quando o cirurgião descreve o procedimento operatório, técnica cirúrgica, achados intraoperatórios, intercorrências. Frases como 'ditando nota operatória', 'descrevendo cirurgia', 'o procedimento consistiu em'.",
  interconsult: "interconsult: quando solicita avaliação de outra especialidade, menciona 'interconsulta', 'chamar especialista', 'solicitar avaliação de [especialidade]'.",
  handoff_isbar: "handoff_isbar: passagem de plantão, handoff, relato de turno, 'passando o plantão para', 'relatório de enfermagem para o turno', 'ISBAR'. Gerado para médicos E enfermeiros.",
};

function buildAllowedIntents(userRoles: string[]): string[] {
  const allowed = new Set<string>();
  for (const role of userRoles) {
    const intents = ROLE_INTENT_MAP[role];
    if (intents) intents.forEach((i) => allowed.add(i));
  }
  // If no matching roles, default to medical intents
  if (allowed.size === 0) {
    ROLE_INTENT_MAP.medico.forEach((i) => allowed.add(i));
  }
  return Array.from(allowed);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcription, user_roles } = await req.json();
    if (!transcription || typeof transcription !== "string") {
      return new Response(JSON.stringify({ error: "Missing transcription" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roles: string[] = Array.isArray(user_roles) ? user_roles : [];
    const allowedIntents = buildAllowedIntents(roles);
    const intentDescriptions = allowedIntents.map((i) => INTENT_DESCRIPTIONS[i]).filter(Boolean).join("\n- ");

    const { content: aiContent } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um analisador de transcrições clínicas. Sua tarefa é detectar intenções clínicas (intents) na fala do profissional de saúde.

Analise cuidadosamente a transcrição e identifique TODAS as intenções clínicas presentes. Cada intent deve ser extraído separadamente.

Tipos de intent que você deve detectar (SOMENTE estes):
- ${intentDescriptions}

Para cada intent, extraia os detalhes relevantes da transcrição.
Para prescrições sem dose especificada, marque suggest_dose como true.
Para exames, identifique cada exame individualmente.
Se nenhum intent for detectado, retorne uma lista vazia.

Retorne SOMENTE um JSON válido (sem markdown, sem code blocks) no formato:
{
  "intents": [
    {
      "type": "um dos tipos permitidos: ${allowedIntents.join(", ")}",
      "details": {
        "name": "Nome do exame, medicamento, ou procedimento (se aplicável)",
        "exam_category": "laboratorial | imagem | procedimento (apenas para exam_request)",
        "exam_list": ["lista de exames agrupados (para exames laboratoriais)"],
        "dose": "Dose prescrita (se mencionada)",
        "frequency": "Frequência/posologia (se mencionada)",
        "duration": "Duração do tratamento (se mencionada)",
        "route": "Via de administração (se mencionada)",
        "suggest_dose": false,
        "is_controlled": false,
        "destination": "Setor/unidade de destino (para transferência)",
        "indication": "Indicação clínica extraída da história",
        "cid": "CID-10 inferido (se possível)",
        "justification": "Justificativa clínica",
        "bed_type": "Tipo de leito solicitado",
        "summary": "Resumo do conteúdo registrado",
        "observations": "Observações relevantes",
        "sector": "Setor (uti/emergencia/enfermaria/ambulatorio)",
        "specialty": "Especialidade solicitada — para interconsult",
        "urgency": "Urgência da interconsulta (rotina/urgente/emergência)",
        "procedure": "Nome do procedimento cirúrgico — para surgical_note"
      },
      "raw_text": "Trecho da transcrição que originou este intent"
    }
  ]
}
Inclua apenas os campos de details relevantes para cada tipo de intent. Omita campos não aplicáveis.`,
        },
        {
          role: "user",
          content: transcription,
        },
      ],
    });

    let parsed: { intents?: any[] } = { intents: [] };
    try {
      const jsonStr = aiContent.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.warn("Failed to parse AI response as JSON, returning empty intents");
    }
    // Double-check: filter out any intents not in allowed list
    const filteredIntents = (parsed.intents || []).filter((i: any) => allowedIntents.includes(i.type));

    return new Response(JSON.stringify({ intents: filteredIntents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-clinical-intents error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
