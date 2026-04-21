import { useMemo, useEffect, useRef, useState, useCallback } from "react";

export interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

export interface ScriptFieldWithStatus extends ScriptField {
  covered: boolean;
  /** "keyword" = matched by keyword, "ai" = confirmed by LLM, undefined = not covered */
  source?: "keyword" | "ai";
}

/** Lowercase + remove accents + collapse whitespace */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Generate bigrams (pairs of consecutive words) from text */
function toBigrams(text: string): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length < 2) return [];
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

/** Check if a keyword matches in the transcript using unigrams or bigrams */
function keywordMatches(normalizedKw: string, normalizedTranscript: string, transcriptBigrams: string[]): boolean {
  const kwWords = normalizedKw.split(" ").filter(Boolean);
  if (kwWords.length >= 2) {
    return normalizedTranscript.includes(normalizedKw) ||
      transcriptBigrams.some((bg) => bg === normalizedKw);
  }
  if (kwWords.length === 1 && kwWords[0].length <= 4) {
    const regex = new RegExp(`\\b${kwWords[0]}\\b`);
    return regex.test(normalizedTranscript);
  }
  return normalizedTranscript.includes(normalizedKw);
}

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-script-coverage`;

/**
 * For each field, check whether any of its keywords appear in the live transcript.
 * Also periodically calls LLM to confirm coverage with semantic understanding.
 */
export function useScriptMatching(
  fields: ScriptField[] | null | undefined,
  liveTranscript: string
): ScriptFieldWithStatus[] {
  const [aiCoveredIds, setAiCoveredIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAnalyzedRef = useRef("");
  const isAnalyzingRef = useRef(false);

  // Debounced LLM analysis
  const analyzeWithAI = useCallback(async (transcript: string, scriptFields: ScriptField[]) => {
    if (isAnalyzingRef.current) return;
    if (!transcript || transcript.length < 20) return;
    // Only re-analyze if transcript has grown significantly (50+ new chars)
    if (transcript.length - lastAnalyzedRef.current.length < 50) return;

    isAnalyzingRef.current = true;
    lastAnalyzedRef.current = transcript;

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          transcript,
          fields: scriptFields.map(f => ({ id: f.id, label: f.label, required: f.required, keywords: f.keywords })),
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.covered_ids?.length) {
          setAiCoveredIds(prev => {
            const next = new Set(prev);
            data.covered_ids.forEach((id: string) => next.add(id));
            return next;
          });
        }
      }
    } catch (e) {
      console.error("AI script analysis error:", e);
    }
    isAnalyzingRef.current = false;
  }, []);

  // Trigger LLM analysis when transcript changes (debounced 8s)
  useEffect(() => {
    if (!fields?.length || !liveTranscript) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      analyzeWithAI(liveTranscript, fields);
    }, 8000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [liveTranscript, fields, analyzeWithAI]);

  // Reset AI state when fields change
  useEffect(() => {
    setAiCoveredIds(new Set());
    lastAnalyzedRef.current = "";
  }, [fields]);

  return useMemo(() => {
    if (!fields?.length) return [];
    const normalizedTranscript = normalize(liveTranscript);
    const transcriptBigrams = toBigrams(normalizedTranscript);

    return fields.map((field) => {
      const keywordCovered = field.keywords.some((kw) =>
        keywordMatches(normalize(kw), normalizedTranscript, transcriptBigrams)
      );
      const aiCovered = aiCoveredIds.has(field.id);
      const covered = keywordCovered || aiCovered;

      return {
        ...field,
        covered,
        source: aiCovered ? "ai" as const : keywordCovered ? "keyword" as const : undefined,
      };
    });
  }, [fields, liveTranscript, aiCoveredIds]);
}
