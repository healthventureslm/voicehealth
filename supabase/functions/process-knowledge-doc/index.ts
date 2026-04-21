import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiCompleteJson } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple PDF text extraction using pdf-parse compatible approach for Deno
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  // Use a simple regex-based extraction for PDF text content
  const text = new TextDecoder("latin1").decode(pdfBytes);
  const textBlocks: string[] = [];
  
  // Extract text between BT and ET markers (PDF text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textBlocks.push(tjMatch[1]);
    }
    // TJ arrays
    const tjArrayRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const arrContent = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(arrContent)) !== null) {
        textBlocks.push(strMatch[1]);
      }
    }
  }
  
  let extracted = textBlocks.join(" ").replace(/\\n/g, "\n").replace(/\\r/g, "").trim();
  
  // If regex extraction yields little text, try stream decompression approach
  if (extracted.length < 100) {
    // Fallback: extract any readable ASCII sequences
    const readableRegex = /[\x20-\x7E]{10,}/g;
    const readable = text.match(readableRegex) || [];
    extracted = readable
      .filter(s => !s.includes("obj") && !s.includes("endobj") && !s.includes("/Type"))
      .join(" ")
      .trim();
  }
  
  return extracted;
}

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep overlap
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(overlap / 5));
      currentChunk = overlapWords.join(" ") + " " + sentence;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If no sentence splitting worked, chunk by character count
  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.substring(i, i + chunkSize));
    }
  }

  return chunks;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embedding error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase.from("knowledge_documents").update({ processing_status: "processing" }).eq("id", document_id);

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) throw new Error("Document not found");

    let textContent = doc.content || "";

    // If there's a file_url, download and extract PDF
    if (doc.file_url) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from("knowledge-docs")
        .download(doc.file_url);

      if (fileError) throw new Error("Failed to download file: " + fileError.message);

      const arrayBuffer = await fileData.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      // Try to extract text
      textContent = await extractTextFromPdf(pdfBytes);
      
      // If extraction failed, use AI to extract via OCR-like approach
      if (textContent.length < 50) {
        console.log("PDF text extraction yielded little content, using AI fallback");

        try {
          const { content: aiText } = await aiCompleteJson({
            model: "google/gemini-2.5-flash",
            messages: [{
              role: "user",
              content: `Extract all readable text from this document. The title is "${doc.title}". Return only the extracted text, no commentary. If you cannot read it, return a summary based on the title.`
            }],
          });
          if (aiText.length > textContent.length) {
            textContent = aiText;
          }
        } catch (aiErr) {
          console.warn("AI fallback for PDF extraction failed:", aiErr);
        }
      }

      // Update document content
      await supabase.from("knowledge_documents").update({ content: textContent }).eq("id", document_id);
    }

    if (!textContent || textContent.length < 10) {
      await supabase.from("knowledge_documents").update({ processing_status: "error" }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "No text content extracted" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete existing chunks
    await supabase.from("knowledge_chunks").delete().eq("document_id", document_id);

    // Chunk the text
    const chunks = chunkText(textContent, 1000, 200);
    console.log(`Document ${doc.title}: ${chunks.length} chunks created`);

    // Generate embeddings and insert chunks
    const insertedChunks: any[] = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i], openaiKey);
        
        const { error: insertError } = await supabase.from("knowledge_chunks").insert({
          document_id,
          chunk_index: i,
          content: chunks[i],
          embedding: JSON.stringify(embedding),
          token_count: Math.ceil(chunks[i].length / 4),
        });

        if (insertError) {
          console.error(`Chunk ${i} insert error:`, insertError);
        } else {
          insertedChunks.push(i);
        }

        // Rate limit: small delay between embedding calls
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (embError) {
        console.error(`Embedding error for chunk ${i}:`, embError);
      }
    }

    // Update document status and chunks metadata
    await supabase.from("knowledge_documents").update({
      processing_status: "ready",
      chunks: chunks.map((c, i) => ({ index: i, length: c.length, embedded: insertedChunks.includes(i) })),
    }).eq("id", document_id);

    return new Response(JSON.stringify({
      success: true,
      chunks_total: chunks.length,
      chunks_embedded: insertedChunks.length,
      text_length: textContent.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-knowledge-doc error:", e);
    
    // Try to update status on error
    try {
      const { document_id } = await new Response(req.body).json().catch(() => ({ document_id: null }));
      if (document_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("knowledge_documents").update({ processing_status: "error" }).eq("id", document_id);
      }
    } catch {}
    
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
