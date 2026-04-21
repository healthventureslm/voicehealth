/// <reference path="../types/speech.d.ts" />
import { useState, useRef, useCallback } from "react";

export interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  fullTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!isSupported) return;
    shouldListenRef.current = true;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: SpeechRecognition = new SpeechRecognitionCtor();

    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let newFinal = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          newFinal += r[0].transcript + " ";
        } else {
          interim += r[0].transcript;
        }
      }

      if (newFinal) setTranscript((prev) => prev + newFinal);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Ignore "no-speech" — it's expected during pauses
      if (event.error === "no-speech") return;
      console.warn("SpeechRecognition error:", event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be active (browser sometimes stops on its own)
      if (shouldListenRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Ignore if already started
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.warn("SpeechRecognition start failed:", e);
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    transcript,
    interimTranscript,
    fullTranscript: transcript + interimTranscript,
    isListening,
    isSupported,
    start,
    stop,
    reset,
  };
}
