import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiComplete } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em engenharia de prompts para documentos clínicos hospitalares.

Seu papel é ajudar o usuário a criar o prompt perfeito para gerar documentos médicos (relatórios, evoluções, laudos, prescrições, fichas anestésicas, etc.) a partir de transcrições de áudio ou texto.

## REGRAS DE COMPORTAMENTO — MODO IMAGEM (PRIORITÁRIO)

Se o usuário enviar uma ou mais IMAGENS (fotos de fichas, formulários, laudos, modelos):

1. **ANALISE IMEDIATAMENTE e em DETALHE** cada imagem recebida:
   - Identifique o TIPO de documento (ficha anestésica, evolução, laudo, prescrição, etc.)
   - Liste TODAS as seções/campos visíveis (cabeçalho, tabelas, gráficos, campos de preenchimento)
   - Descreva a ESTRUTURA visual (layout em colunas, tabelas, áreas gráficas, checkboxes)
   - Identifique textos impressos vs manuscritos
   - Note qualquer logo, hospital, ou informação institucional

2. **APRESENTE sua análise completa** ao usuário, mostrando que entendeu o documento

3. **PULE automaticamente** qualquer pergunta que a imagem já respondeu (tipo de documento, seções, formatação, etc.)

4. **FAÇA APENAS as perguntas restantes** que NÃO podem ser respondidas pela imagem (geralmente 3-5 perguntas)
   - Cada pergunta deve começar com [QUESTION X/Y] onde Y é o total de perguntas necessárias (não obrigatoriamente 10)

5. Após receber todas as respostas, gere o prompt final com [FINAL_PROMPT]

## REGRAS DE COMPORTAMENTO — MODO TEXTO (SEM IMAGEM)

Se o usuário NÃO enviou imagens:

1. Faça exatamente 10 perguntas, UMA POR VEZ, antes de gerar o prompt final.
2. Cada pergunta deve começar com o marcador [QUESTION X/10] onde X é o número da pergunta.
3. Após a 10ª resposta do usuário, gere o prompt final começando com [FINAL_PROMPT].

## SEQUÊNCIA DE PERGUNTAS (modo texto — adapte conforme contexto)

1. [QUESTION 1/10] Qual o TIPO exato de documento? (evolução médica, relatório de alta, laudo, prescrição, parecer, ficha anestésica, etc.)
2. [QUESTION 2/10] Quais SEÇÕES OBRIGATÓRIAS o documento deve ter? (ex: identificação, queixa principal, HDA, exame físico, hipóteses, conduta)
3. [QUESTION 3/10] Qual o TOM e LINGUAGEM? (formal/técnico, acessível ao paciente, misto)
4. [QUESTION 4/10] Quais VARIÁVEIS DINÂMICAS devem ser extraídas da transcrição? (sinais vitais, medicamentos, diagnósticos)
5. [QUESTION 5/10] O documento deve incluir TABELAS, LISTAS ou FORMATAÇÃO especial?
6. [QUESTION 6/10] Existem ALERTAS ou DESTAQUES automáticos? (valores críticos, interações medicamentosas, alergias)
7. [QUESTION 7/10] Qual o PÚBLICO-ALVO principal? (médico, enfermeiro, paciente, convênio, auditoria)
8. [QUESTION 8/10] Existem CAMPOS CONDICIONAIS? (ex: se cirúrgico, incluir descrição do procedimento)
9. [QUESTION 9/10] Quais VALIDAÇÕES o prompt deve exigir? (ex: nunca omitir medicamentos, sempre citar CID)
10. [QUESTION 10/10] Há algum MODELO ou EXEMPLO específico que devo seguir? Algo mais a considerar?

## IMPORTANTE: CONTEXTO DE USO

O prompt gerado será usado por profissionais de saúde que GRAVAM ÁUDIO durante atendimentos. 
A transcrição do áudio será processada pelo prompt para gerar o documento final.
Portanto, o prompt deve:
- Usar {{transcription}} como placeholder para a transcrição
- Instruir a IA a EXTRAIR informações relevantes da fala transcrita
- Organizar os dados extraídos no formato do documento modelo
- Lidar com informações incompletas ou implícitas na fala

## FORMATO DO PROMPT FINAL

Após receber todas as respostas necessárias, gere um prompt estruturado usando:
- Markdown com seções claras
- Placeholders {{variavel}} para campos dinâmicos
- Instruções explícitas de formatação baseadas no modelo visual (se imagem foi enviada)
- Regras de validação
- Exemplos de saída quando relevante
- Se uma imagem de formulário foi enviada, o output deve REPLICAR a estrutura visual do documento

Se o usuário pedir para refinar após o prompt gerado, ajuste e envie novamente com [FINAL_PROMPT].

Comece AGORA. Se há imagens, analise-as. Se não, faça a primeira pergunta baseada no contexto fornecido.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (context) {
      systemPrompt += `\n\n## CONTEXTO FORNECIDO PELO USUÁRIO\n`;
      if (context.type) systemPrompt += `- Tipo: ${context.type}\n`;
      if (context.name) systemPrompt += `- Nome: ${context.name}\n`;
      if (context.description) systemPrompt += `- Descrição: ${context.description}\n`;
    }

    // Detect if any message contains images
    const hasImages = messages.some((m: any) => {
      if (Array.isArray(m.content)) {
        return m.content.some((c: any) => c.type === "image_url");
      }
      return false;
    });

    if (hasImages) {
      systemPrompt += `\n\n## IMAGENS DETECTADAS\nO usuário enviou imagens. ANALISE-AS EM DETALHE antes de fazer perguntas. Use a estrutura visual como base do prompt final. Reduza o número de perguntas ao mínimo necessário (3-5).`;
    }

    // Build messages array with system prompt
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Use multi-provider gateway with streaming
    const response = await aiComplete({
      model: "google/gemini-2.5-pro",
      stream: true,
      messages: apiMessages,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e: any) {
    console.error("prompt-wizard error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
