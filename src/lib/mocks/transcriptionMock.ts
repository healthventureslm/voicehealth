/**
 * Mock transcription service for development and Vitest tests.
 *
 * Usage in tests:
 *   const text = getMockTranscription("uti-sepse-01", "accurate");
 *
 * Usage in dev (intercept real API call):
 *   if (import.meta.env.DEV && mockMode) return getMockTranscription(scenarioId, mode);
 */

import {
  CLINICAL_SCENARIOS,
  ClinicalScenario,
  getScenarioById,
  Sector,
} from "@/lib/fixtures/clinicalScenarios";

export type TranscriptionMode = "accurate" | "noisy";

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

export function getMockTranscription(
  scenarioId: string,
  mode: TranscriptionMode = "accurate"
): string {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`[MockTranscription] Scenario not found: ${scenarioId}`);
  }
  return mode === "noisy"
    ? scenario.transcriptionNoisy
    : scenario.transcriptionAccurate;
}

export function getMockExpectedIntents(scenarioId: string): string[] {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) return [];
  return scenario.expectedIntents;
}

export function getMockExpectedMissingFields(scenarioId: string): string[] {
  const scenario = getScenarioById(scenarioId);
  return scenario?.expectedMissingFields ?? [];
}

// ---------------------------------------------------------------------------
// Scenario listing helpers (for dev UI)
// ---------------------------------------------------------------------------

export interface ScenarioOption {
  id: string;
  title: string;
  sector: Sector;
  specialty: string;
  complexity: ClinicalScenario["complexity"];
}

export function listScenarios(): ScenarioOption[] {
  return CLINICAL_SCENARIOS.map(({ id, title, sector, specialty, complexity }) => ({
    id,
    title,
    sector,
    specialty,
    complexity,
  }));
}

export function listScenariosBySector(sector: Sector): ScenarioOption[] {
  return listScenarios().filter((s) => s.sector === sector);
}

// ---------------------------------------------------------------------------
// Simulate a "noisy" transcription by injecting common ASR artifacts
// (used when no pre-written noisy variant is needed for quick-gen scenarios)
// ---------------------------------------------------------------------------

const ASR_SUBSTITUTIONS: [RegExp, string][] = [
  [/\bsepse\b/gi, "seps"],
  [/\bpneumonia\b/gi, "pneumônia"],
  [/\bnoradrenalina\b/gi, "noradr... noradrenalina"],
  [/\bglicemia\b/gi, "glicemia capilar"],
  [/\bfrequência cardíaca\b/gi, "FC"],
  [/\bpressão arterial\b/gi, "PA"],
  [/\btemperatura\b/gi, "temperatura... temperatura"],
  [/\bsaturação\b/gi, "saturação de O2"],
  [/\bmeropenem\b/gi, "meropenen"],
  [/\benoxaparina\b/gi, "enox... enoxaparina"],
];

const FILLER_WORDS = ["ehn... ", "hmm... ", "então... ", "deixa eu ver... "];

function injectFillers(text: string): string {
  const sentences = text.split(". ");
  return sentences
    .map((s, i) =>
      i % 3 === 1
        ? FILLER_WORDS[i % FILLER_WORDS.length] + s
        : s
    )
    .join(". ");
}

export function generateNoisyTranscription(accurateText: string): string {
  let noisy = accurateText;
  for (const [pattern, replacement] of ASR_SUBSTITUTIONS) {
    noisy = noisy.replace(pattern, replacement);
  }
  return injectFillers(noisy);
}

// ---------------------------------------------------------------------------
// Simulated API response (mirrors the transcribe-audio edge function response)
// ---------------------------------------------------------------------------

export interface MockTranscriptionResponse {
  success: boolean;
  transcription: string;
  report: null;
  _mock: true;
  scenarioId: string;
  mode: TranscriptionMode;
}

export function buildMockTranscriptionResponse(
  scenarioId: string,
  mode: TranscriptionMode = "accurate"
): MockTranscriptionResponse {
  return {
    success: true,
    transcription: getMockTranscription(scenarioId, mode),
    report: null,
    _mock: true,
    scenarioId,
    mode,
  };
}
