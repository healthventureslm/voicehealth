/**
 * Unit tests for clinical scenario fixtures and mock transcription service.
 *
 * These tests run without any API calls — they validate:
 * 1. Fixture data integrity (all required fields present and non-empty)
 * 2. expectedIntents are valid known intent types
 * 3. Transcriptions are non-empty in both modes
 * 4. Mock service returns correct data
 * 5. SOAP structure: evolução médica transcriptions contain S/O/A/P markers
 * 6. Noisy transcriptions differ from accurate transcriptions
 */

import { describe, it, expect } from "vitest";
import {
  CLINICAL_SCENARIOS,
  getScenarioById,
  getScenariosBySector,
  getScenariosByComplexity,
} from "@/lib/fixtures/clinicalScenarios";
import {
  getMockTranscription,
  getMockExpectedIntents,
  generateNoisyTranscription,
  listScenarios,
  buildMockTranscriptionResponse,
} from "@/lib/mocks/transcriptionMock";

// All valid intent types across the system (including the 5 new ones)
const VALID_INTENT_TYPES = new Set([
  "exam_request",
  "prescription",
  "hospitalization",
  "high_cost_med",
  "transfer",
  "discharge",
  "nursing_note",
  "nursing_evolution",
  "vital_signs",
  "diet_prescription",
  "rehab_evolution",
  "speech_eval",
  "psych_eval",
  "social_report",
  // New types:
  "medical_evolution",
  "icu_evolution",
  "surgical_note",
  "interconsult",
  "handoff_isbar",
]);

describe("clinicalScenarios — fixture integrity", () => {
  it("should have exactly 12 scenarios", () => {
    expect(CLINICAL_SCENARIOS).toHaveLength(12);
  });

  it("each scenario should have required fields", () => {
    for (const s of CLINICAL_SCENARIOS) {
      expect(s.id, `${s.id}: missing id`).toBeTruthy();
      expect(s.title, `${s.id}: missing title`).toBeTruthy();
      expect(s.sector, `${s.id}: missing sector`).toBeTruthy();
      expect(s.specialty, `${s.id}: missing specialty`).toBeTruthy();
      expect(s.complexity, `${s.id}: missing complexity`).toBeTruthy();
      expect(s.patientData?.name, `${s.id}: missing patient name`).toBeTruthy();
      expect(s.patientData?.age, `${s.id}: missing patient age`).toBeGreaterThan(0);
      expect(s.transcriptionAccurate, `${s.id}: missing accurate transcription`).toBeTruthy();
      expect(s.transcriptionNoisy, `${s.id}: missing noisy transcription`).toBeTruthy();
      expect(s.expectedIntents, `${s.id}: missing expectedIntents`).toBeInstanceOf(Array);
      expect(s.expectedIntents.length, `${s.id}: expectedIntents is empty`).toBeGreaterThan(0);
    }
  });

  it("each scenario id should be unique", () => {
    const ids = CLINICAL_SCENARIOS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("expectedIntents should only contain valid intent types", () => {
    for (const s of CLINICAL_SCENARIOS) {
      for (const intent of s.expectedIntents) {
        expect(
          VALID_INTENT_TYPES.has(intent),
          `${s.id}: unknown intent type "${intent}"`
        ).toBe(true);
      }
    }
  });

  it("sectors should be one of the four valid values", () => {
    const validSectors = new Set(["uti", "emergencia", "enfermaria", "ambulatorio"]);
    for (const s of CLINICAL_SCENARIOS) {
      expect(validSectors.has(s.sector), `${s.id}: invalid sector "${s.sector}"`).toBe(true);
    }
  });

  it("complexity should be low, med, or high", () => {
    const valid = new Set(["low", "med", "high"]);
    for (const s of CLINICAL_SCENARIOS) {
      expect(valid.has(s.complexity), `${s.id}: invalid complexity "${s.complexity}"`).toBe(true);
    }
  });

  it("noisy transcription should differ from accurate transcription", () => {
    for (const s of CLINICAL_SCENARIOS) {
      expect(s.transcriptionNoisy).not.toBe(s.transcriptionAccurate);
    }
  });
});

describe("clinicalScenarios — sector distribution", () => {
  it("should have at least 2 UTI scenarios", () => {
    expect(getScenariosBySector("uti").length).toBeGreaterThanOrEqual(2);
  });

  it("should have at least 2 emergência scenarios", () => {
    expect(getScenariosBySector("emergencia").length).toBeGreaterThanOrEqual(2);
  });

  it("should have at least 3 enfermaria scenarios", () => {
    expect(getScenariosBySector("enfermaria").length).toBeGreaterThanOrEqual(3);
  });

  it("should have at least 4 ambulatório scenarios", () => {
    expect(getScenariosBySector("ambulatorio").length).toBeGreaterThanOrEqual(4);
  });

  it("should have at least 1 high-complexity scenario per UTI and Emergência", () => {
    const utiHigh = CLINICAL_SCENARIOS.filter(
      (s) => s.sector === "uti" && s.complexity === "high"
    );
    const emerHigh = CLINICAL_SCENARIOS.filter(
      (s) => s.sector === "emergencia" && s.complexity === "high"
    );
    expect(utiHigh.length).toBeGreaterThanOrEqual(1);
    expect(emerHigh.length).toBeGreaterThanOrEqual(1);
  });
});

describe("clinicalScenarios — SOAP structure in evolução médica", () => {
  const evolutionScenarios = CLINICAL_SCENARIOS.filter((s) =>
    s.expectedIntents.includes("medical_evolution") ||
    s.expectedIntents.includes("icu_evolution")
  );

  it("should have at least 4 scenarios with medical/ICU evolution", () => {
    expect(evolutionScenarios.length).toBeGreaterThanOrEqual(4);
  });

  it("medical/ICU evolution transcriptions should contain SOAP keywords", () => {
    const soapKeywords = ["subjetivo", "objetivo", "avaliação", "plano"];
    for (const s of evolutionScenarios) {
      const lowerText = s.transcriptionAccurate.toLowerCase();
      const foundKeys = soapKeywords.filter((kw) => lowerText.includes(kw));
      expect(
        foundKeys.length,
        `${s.id}: expected SOAP keywords (${soapKeywords.join(", ")}), found only: ${foundKeys.join(", ")}`
      ).toBeGreaterThanOrEqual(2); // at least 2 SOAP sections mentioned
    }
  });
});

describe("mockTranscriptionService", () => {
  it("getMockTranscription returns accurate transcription by default", () => {
    const text = getMockTranscription("uti-sepse-01");
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(100);
    expect(text).toContain("Carlos"); // patient from that fixture
  });

  it("getMockTranscription returns noisy transcription when requested", () => {
    const accurate = getMockTranscription("uti-sepse-01", "accurate");
    const noisy = getMockTranscription("uti-sepse-01", "noisy");
    expect(noisy).not.toBe(accurate);
    expect(noisy.length).toBeGreaterThan(100);
  });

  it("getMockTranscription throws for unknown scenario id", () => {
    expect(() => getMockTranscription("non-existent-id")).toThrow();
  });

  it("getMockExpectedIntents returns non-empty array", () => {
    const intents = getMockExpectedIntents("uti-sepse-01");
    expect(intents).toBeInstanceOf(Array);
    expect(intents.length).toBeGreaterThan(0);
  });

  it("listScenarios returns all 12 scenarios", () => {
    expect(listScenarios()).toHaveLength(12);
  });

  it("buildMockTranscriptionResponse has correct shape", () => {
    const res = buildMockTranscriptionResponse("amb-has-08", "accurate");
    expect(res.success).toBe(true);
    expect(res._mock).toBe(true);
    expect(res.report).toBeNull();
    expect(res.transcription).toBeTruthy();
    expect(res.scenarioId).toBe("amb-has-08");
    expect(res.mode).toBe("accurate");
  });

  it("generateNoisyTranscription produces a different string", () => {
    const original = "Fazendo evolução. Diagnóstico de sepse. Noradrenalina em curso.";
    const noisy = generateNoisyTranscription(original);
    expect(noisy).not.toBe(original);
  });
});

describe("getScenarioById", () => {
  it("returns scenario for valid id", () => {
    const s = getScenarioById("uti-iam-02");
    expect(s).toBeDefined();
    expect(s?.id).toBe("uti-iam-02");
  });

  it("returns undefined for unknown id", () => {
    expect(getScenarioById("does-not-exist")).toBeUndefined();
  });
});

describe("getScenariosByComplexity", () => {
  it("returns only high-complexity scenarios", () => {
    const result = getScenariosByComplexity("high");
    expect(result.every((s) => s.complexity === "high")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("pediatric scenario", () => {
  it("should have a pediatric scenario", () => {
    const pediatric = CLINICAL_SCENARIOS.find((s) => s.id === "amb-pediatria-11");
    expect(pediatric).toBeDefined();
    expect(pediatric?.patientData.age).toBeLessThan(18);
    expect(pediatric?.sector).toBe("ambulatorio");
  });
});

describe("UTI scenarios — critical data completeness", () => {
  const utiScenarios = CLINICAL_SCENARIOS.filter((s) => s.sector === "uti");

  it("UTI transcriptions mention vital signs", () => {
    for (const s of utiScenarios) {
      const text = s.transcriptionAccurate.toLowerCase();
      const hasVitals =
        text.includes("pressão arterial") ||
        text.includes("pa ") ||
        text.includes("frequência cardíaca") ||
        text.includes("fc ");
      expect(hasVitals, `${s.id}: missing vital signs in transcription`).toBe(true);
    }
  });

  it("UTI transcriptions mention fluid balance or ventilation", () => {
    for (const s of utiScenarios) {
      const text = s.transcriptionAccurate.toLowerCase();
      const hasCritical =
        text.includes("balanço hídrico") ||
        text.includes("ventilação mecânica") ||
        text.includes("fio2") ||
        text.includes("noradrenalina");
      expect(hasCritical, `${s.id}: missing ICU-specific data in transcription`).toBe(true);
    }
  });
});
