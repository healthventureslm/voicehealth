import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseRealtimeTranscriptionResult {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useRealtimeTranscription(
  lang: string = "pt-BR",
): UseRealtimeTranscriptionResult {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRestartRef = useRef(false);
  const SR = getSpeechRecognition();
  const isSupported = SR !== null;

  const initRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (!SR) return null;
    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) finalChunk += text;
        else interim += text;
      }
      if (finalChunk) {
        setTranscript((prev) =>
          prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim(),
        );
      }
      setInterimTranscript(interim);
    };

    r.onerror = (event: any) => {
      const code = event?.error ?? "unknown";
      // 'no-speech' e 'aborted' são esperados — não tratamos como erro fatal
      if (code !== "no-speech" && code !== "aborted") {
        setError(`Erro de reconhecimento: ${code}`);
      }
    };

    r.onend = () => {
      // Browsers param o reconhecimento periodicamente; reinicia se ainda devemos escutar
      if (shouldRestartRef.current) {
        try {
          r.start();
        } catch {
          setIsListening(false);
          shouldRestartRef.current = false;
        }
      } else {
        setIsListening(false);
        setInterimTranscript("");
      }
    };

    return r;
  }, [SR, lang]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }
    setError(null);
    shouldRestartRef.current = true;
    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }
    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {
      // já estava rodando — ignora
    }
  }, [initRecognition, isSupported]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    start,
    stop,
    reset,
  };
}
