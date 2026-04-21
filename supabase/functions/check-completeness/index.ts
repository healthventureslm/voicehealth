import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Critical fields per intent type that guided mode should ask about when missing
const CRITICAL_FIELDS: Record<string, Array<{ field: string; question: string }>> = {
  prescription: [
    { field: "dose", question: "Qual a dose do medicamento prescrito?" },
    { field: "frequency", question: "Qual a posologia (frequência de administração)?" },
    { field: "duration", question: "Por quantos dias o medicamento deve ser usado?" },
  ],
  exam_request: [
    { field: "indication", question: "Qual a indicação clínica para os exames solicitados?" },
  ],
  medical_evolution: [
    { field: "vital_signs", question: "Informe os sinais vitais: PA, FC, FR, temperatura e saturação." },
    { field: "physical_exam", question: "Há achados relevantes no exame físico para registrar?" },
    { field: "assessment", question: "Qual a avaliação diagnóstica atual do paciente?" },
  ],
  icu_evolution: [
    { field: "vital_signs", question: "Informe PA, FC, temperatura e saturação do paciente." },
    { field: "fluid_balance", question: "Qual o balanço hídrico das últimas 24h (entrada, saída, balanço)?" },
    { field: "ventilation", question: "O paciente está em ventilação mecânica? Se sim, quais os parâmetros (modo, FiO2, PEEP)?" },
    { field: "sofa", question: "Qual o SOFA score ou Glasgow do paciente?" },
  ],
  nursing_evolution: [
    { field: "vital_signs", question: "Quais os sinais vitais aferidos?" },
    { field: "assessment", question: "Qual o diagnóstico de enfermagem identificado?" },
  ],
  discharge: [
    { field: "discharge_medication", question: "Quais as medicações prescritas para o domicílio?" },
    { field: "follow_up", question: "Qual o prazo e local de retorno ambulatorial?" },
  ],
  surgical_note: [
    { field: "procedure", question: "Qual o nome completo do procedimento cirúrgico realizado?" },
    { field: "technique", question: "Descreva brevemente a técnica cirúrgica utilizada." },
    { field: "findings", question: "Quais foram os achados intraoperatórios relevantes?" },
  ],
  interconsult: [
    { field: "specialty", question: "Qual especialidade está sendo solicitada?" },
    { field: "reason", question: "Qual o motivo específico da interconsulta?" },
    { field: "urgency", question: "Qual a urgência: rotina (24h), urgente (4h) ou emergência (imediata)?" },
  ],
  hospitalization: [
    { field: "justification", question: "Qual a justificativa clínica para a internação?" },
    { field: "bed_type", question: "Qual tipo de leito é necessário (UTI, semi-intensiva, enfermaria)?" },
  ],
  handoff_isbar: [
    { field: "situation", question: "Qual o estado clínico atual do paciente?" },
    { field: "recommendations", question: "Quais as recomendações/pendências para o próximo turno?" },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcription, intent_types, sector } = await req.json();

    if (!transcription || !Array.isArray(intent_types) || intent_types.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing transcription or intent_types" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the list of fields to check for each intent type
    const fieldsToCheck = intent_types.flatMap((intentType: string) => {
      const fields = CRITICAL_FIELDS[intentType] || [];
      return fields.map((f) => ({ ...f, intent_type: intentType }));
    });

    if (fieldsToCheck.length === 0) {
      return new Response(
        JSON.stringify({ missing_fields: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fieldDescriptions = fieldsToCheck
      .map((f, i) => `${i + 1}. [${f.intent_type}] Campo: "${f.field}" — ${f.question}`)
      .join("\n");

    const systemPrompt = `Você é um assistente clínico que analisa transcrições médicas para identificar campos obrigatórios ausentes.

Setor: ${sector || "não especificado"}

Para cada campo listado abaixo, determine se a informação está PRESENTE ou AUSENTE na transcrição.
Responda APENAS com um JSON no formato:
{
  "missing": [lista de índices (1-based) dos campos que estão AUSENTES na transcrição]
}

Considere um campo como PRESENTE se a transcrição menciona qualquer dado relacionado a ele, mesmo que de forma resumida.
Considere AUSENTE apenas se não há nenhuma menção ou dado que preencha o campo.`;

    const userMessage = `Transcrição:
${transcription}

Campos a verificar:
${fieldDescriptions}`;

    const { content } = await aiCompleteJson({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    let parsed: { missing?: number[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { missing: [] };
    }

    const missingIndices = new Set(parsed.missing || []);
    const missingFields = fieldsToCheck.filter((_, i) => missingIndices.has(i + 1));

    return new Response(
      JSON.stringify({ missing_fields: missingFields }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("check-completeness error:", e);
    return new Response(
      JSON.stringify({ error: e.message, missing_fields: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
