import { useMemo } from "react";

export interface ScriptField {
  id: string;
  label: string;
  required: boolean;
  keywords: string[];
}

export interface ScriptFieldWithStatus extends ScriptField {
  covered: boolean;
}

const COMBINING_MARKS = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");
}

export function useScriptMatching(
  fields: ScriptField[] | null,
  transcript: string,
): ScriptFieldWithStatus[] {
  return useMemo(() => {
    if (!fields || fields.length === 0) return [];
    const normalizedTranscript = normalize(transcript);
    return fields.map((f) => {
      const covered =
        normalizedTranscript.length > 0 &&
        f.keywords.some((kw) => {
          const nk = normalize(kw);
          return nk.length > 0 && normalizedTranscript.includes(nk);
        });
      return { ...f, covered };
    });
  }, [fields, transcript]);
}
