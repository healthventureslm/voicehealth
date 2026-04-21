import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, specialty_id, match_count = 5, match_threshold = 0.3 } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for query
    const embResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query.substring(0, 8000),
      }),
    });

    if (!embResponse.ok) {
      throw new Error("Embedding generation failed: " + await embResponse.text());
    }

    const embResult = await embResponse.json();
    const queryEmbedding = embResult.data[0].embedding;

    // Call match function
    const { data: matches, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: match_threshold,
      match_count: match_count,
      filter_specialty_id: specialty_id || null,
    });

    if (error) {
      console.error("Match error:", error);
      throw new Error("Vector search failed: " + error.message);
    }

    // Format context for RAG
    const context = (matches || []).map((m: any) => 
      `### ${m.document_title} (similaridade: ${(m.similarity * 100).toFixed(1)}%)\n${m.content}`
    ).join("\n\n");

    return new Response(JSON.stringify({
      matches: matches || [],
      context,
      count: (matches || []).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("search-knowledge error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
