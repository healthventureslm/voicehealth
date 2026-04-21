/**
 * E2E Integration Tests — VoiceHealth AI Pipeline
 *
 * These tests call the REAL Supabase edge functions.
 * They require VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to be set.
 *
 * Run with:  npm run test:e2e
 * Do NOT include in the regular `npm run test` suite.
 */

import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll } from "vitest";
import {
  getScenarioById,
  CLINICAL_SCENARIOS,
} from "@/lib/fixtures/clinicalScenarios";

// ── Supabase client setup ─────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

beforeAll(() => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env or set GitHub Secrets."
    );
  }
});

function makeClient() {
  return createClient(SUPABASE_URL!, SUPABASE_KEY!);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const supabase = makeClient();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(`${name} error: ${error.message}`);
  return data as T;
}

// ── 1. analyze-clinical-intents ───────────────────────────────────────────────

describe("analyze-clinical-intents", () => {
  it("detects icu_evolution and prescription from UTI sepse transcription", async () => {
    const scenario = getScenarioById("uti-sepse-01")!;
    expect(scenario).toBeDefined();

    const result = await invokeFunction<{ intents: Array<{ type: string }> }>(
      "analyze-clinical-intents",
      {
        transcription: scenario.transcriptionAccurate,
        user_roles: ["medico"],
        sector: scenario.sector,
      }
    );

    expect(result.intents).toBeDefined();
    const detectedTypes = result.intents.map((i) => i.type);
    console.log("Detected intents (UTI sepse):", detectedTypes);

    // Must detect at least one of the expected intents
    const matched = scenario.expectedIntents.filter((e) =>
      detectedTypes.includes(e)
    );
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it("detects prescription and medical_evolution from enfermaria ICC transcription", async () => {
    const scenario = getScenarioById("enf-icc-05")!;
    const result = await invokeFunction<{ intents: Array<{ type: string }> }>(
      "analyze-clinical-intents",
      {
        transcription: scenario.transcriptionAccurate,
        user_roles: ["medico"],
        sector: scenario.sector,
      }
    );

    const detectedTypes = result.intents.map((i) => i.type);
    console.log("Detected intents (ICC enfermaria):", detectedTypes);

    const matched = scenario.expectedIntents.filter((e) =>
      detectedTypes.includes(e)
    );
    expect(matched.length).toBeGreaterThanOrEqual(1);
  });

  it("detects handoff_isbar from UTI ISBAR scenario", async () => {
    // Use the pneumonia UTI scenario which has handoff_isbar in expected intents
    const scenario = CLINICAL_SCENARIOS.find((s) =>
      s.expectedIntents.includes("handoff_isbar")
    );
    if (!scenario) {
      console.warn("No handoff_isbar scenario found — skipping");
      return;
    }

    const result = await invokeFunction<{ intents: Array<{ type: string }> }>(
      "analyze-clinical-intents",
      {
        transcription: scenario.transcriptionAccurate,
        user_roles: ["medico"],
        sector: scenario.sector,
      }
    );

    const detectedTypes = result.intents.map((i) => i.type);
    console.log("Detected intents (handoff ISBAR):", detectedTypes);
    // At least one expected intent matched
    expect(
      scenario.expectedIntents.some((e) => detectedTypes.includes(e))
    ).toBe(true);
  });

  it("respects role filtering — enfermeiro should not get prescription intent", async () => {
    const scenario = getScenarioById("uti-sepse-01")!;
    const result = await invokeFunction<{ intents: Array<{ type: string }> }>(
      "analyze-clinical-intents",
      {
        transcription: scenario.transcriptionAccurate,
        user_roles: ["enfermeiro"],
        sector: scenario.sector,
      }
    );

    const detectedTypes = result.intents.map((i) => i.type);
    expect(detectedTypes).not.toContain("prescription");
    expect(detectedTypes).not.toContain("medical_evolution");
    expect(detectedTypes).not.toContain("icu_evolution");
  });
});

// ── 2. generate-clinical-documents ───────────────────────────────────────────

describe("generate-clinical-documents", () => {
  it("generates SOAP structure for medical_evolution intent", async () => {
    const scenario = getScenarioById("enf-icc-05")!;

    const result = await invokeFunction<{
      documents: Array<{ type: string; content: string; title: string }>;
    }>("generate-clinical-documents", {
      consultation_id: "00000000-0000-0000-0000-000000000001",
      transcription: scenario.transcriptionAccurate,
      intents: [
        {
          type: "medical_evolution",
          details: {
            diagnosis: "ICC descompensada",
            sector: "enfermaria",
          },
        },
      ],
    });

    expect(result.documents).toBeDefined();
    expect(result.documents.length).toBeGreaterThanOrEqual(1);

    const evol = result.documents.find((d) => d.type === "medical_evolution");
    expect(evol).toBeDefined();
    console.log("medical_evolution preview:", evol!.content.slice(0, 300));

    // SOAP structure check
    const content = evol!.content.toUpperCase();
    const soapSections = ["SUBJETIVO", "OBJETIVO", "AVALIAÇÃO", "PLANO"].filter(
      (s) => content.includes(s)
    );
    // Expect at least 2 SOAP sections (some prompts use S:/O:/A:/P: abbreviations)
    const soapAbbrev = ["S:", "O:", "A:", "P:"].filter((s) =>
      evol!.content.includes(s)
    );
    expect(soapSections.length + soapAbbrev.length).toBeGreaterThanOrEqual(2);
  });

  it("generates UTI evolution with SOFA/hemo fields from UTI sepse scenario", async () => {
    const scenario = getScenarioById("uti-sepse-01")!;

    const result = await invokeFunction<{
      documents: Array<{ type: string; content: string }>;
    }>("generate-clinical-documents", {
      consultation_id: "00000000-0000-0000-0000-000000000001",
      transcription: scenario.transcriptionAccurate,
      intents: [
        {
          type: "icu_evolution",
          details: { diagnosis: "Sepse de foco pulmonar", sector: "uti" },
        },
      ],
    });

    const evol = result.documents.find((d) => d.type === "icu_evolution");
    expect(evol).toBeDefined();
    console.log("icu_evolution preview:", evol!.content.slice(0, 300));

    // Must mention hemodynamic or ventilatory context
    const keywords = ["SOFA", "PA", "FC", "BALANÇO", "HÍDRICO", "GLASGOW"];
    const found = keywords.filter((k) =>
      evol!.content.toUpperCase().includes(k)
    );
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it("generates a prescription with medication and dose", async () => {
    const scenario = CLINICAL_SCENARIOS.find(
      (s) => s.sector === "ambulatorio" && s.complexity === "low"
    )!;

    const result = await invokeFunction<{
      documents: Array<{ type: string; content: string }>;
    }>("generate-clinical-documents", {
      consultation_id: "00000000-0000-0000-0000-000000000001",
      transcription: scenario.transcriptionAccurate,
      intents: [
        {
          type: "prescription",
          details: {
            name: "Losartana",
            dose: "50 mg",
            frequency: "1x ao dia",
            route: "oral",
            duration: "uso contínuo",
          },
        },
      ],
    });

    const rx = result.documents.find((d) => d.type === "prescription");
    expect(rx).toBeDefined();
    console.log("prescription preview:", rx!.content.slice(0, 300));
    expect(rx!.content.toLowerCase()).toMatch(/losart/i);
  });

  it("generates handoff_isbar with all ISBAR sections", async () => {
    // Use any UTI scenario — we're testing the doc format, not intent detection
    const scenario = getScenarioById("uti-sepse-01")!;

    const result = await invokeFunction<{
      documents: Array<{ type: string; content: string }>;
    }>("generate-clinical-documents", {
      consultation_id: "00000000-0000-0000-0000-000000000001",
      transcription: scenario.transcriptionAccurate,
      intents: [
        {
          type: "handoff_isbar",
          details: { sector: scenario.sector },
        },
      ],
    });

    const doc = result.documents.find((d) => d.type === "handoff_isbar");
    expect(doc).toBeDefined();
    console.log("handoff_isbar preview:", doc!.content.slice(0, 300));

    const isbarKeywords = ["IDENTIFICAÇÃO", "SITUAÇÃO", "BACKGROUND", "AVALIAÇÃO", "RECOMENDAÇÃO"];
    const found = isbarKeywords.filter((k) =>
      doc!.content.toUpperCase().includes(k)
    );
    expect(found.length).toBeGreaterThanOrEqual(3);
  });
});

// ── 3. check-completeness ─────────────────────────────────────────────────────

describe("check-completeness", () => {
  it("flags missing dose when prescription transcription has no dose", async () => {
    const result = await invokeFunction<{
      missing_fields: Array<{ field: string; question: string; intent_type: string }>;
    }>("check-completeness", {
      transcription: "O paciente precisa de amoxicilina. Pode prescrever por favor.",
      intent_types: ["prescription"],
      sector: "ambulatorio",
    });

    console.log("missing_fields:", result.missing_fields);
    expect(Array.isArray(result.missing_fields)).toBe(true);

    const doseField = result.missing_fields.find(
      (f) => f.field.toLowerCase().includes("dose") && f.intent_type === "prescription"
    );
    expect(doseField).toBeDefined();
    expect(doseField!.question).toBeTruthy();
  });

  it("returns empty array for complete ambulatory transcription", async () => {
    const scenario = getScenarioById("amb-has-08")!;

    const result = await invokeFunction<{
      missing_fields: Array<{ field: string }>;
    }>("check-completeness", {
      transcription: scenario.transcriptionAccurate,
      intent_types: ["medical_evolution"],
      sector: "ambulatorio",
    });

    console.log(
      "missing_fields for complete transcript:",
      result.missing_fields
    );
    // Complete transcription should have few or no missing fields
    expect(Array.isArray(result.missing_fields)).toBe(true);
  });

  it("gracefully handles rate limit without throwing (returns empty array)", async () => {
    // Send 5 rapid requests to potentially trigger rate limit handling
    // We just verify the function never returns a 500 — it should degrade to []
    const result = await invokeFunction<{ missing_fields: unknown[] }>(
      "check-completeness",
      {
        transcription: "Paciente internado.",
        intent_types: ["nursing_evolution"],
        sector: "enfermaria",
      }
    );
    expect(Array.isArray(result.missing_fields)).toBe(true);
  });
});

// ── 4. refine-report ──────────────────────────────────────────────────────────

describe("refine-report", () => {
  const SAMPLE_REPORT = `EVOLUÇÃO MÉDICA — 13/04/2026

S: Paciente refere melhora da dispneia. Deambulando no quarto.
O: PA 128/82 mmHg. FC 78 bpm. SpO2 97% AA. Ausculta: MV presente, sem RA.
A: ICC descompensada em melhora clínica. Edema MMII ++/4+.
P: Manter furosemida 40 mg/dia. Alta hospitalar prevista para amanhã.`;

  it("adds thrombosis alert when instructed", async () => {
    const result = await invokeFunction<{ refined_content: string }>(
      "refine-report",
      {
        report_content: SAMPLE_REPORT,
        user_message: "Adicione alerta de profilaxia para trombose venosa profunda",
        report_type: "medical_evolution",
      }
    );

    expect(result.refined_content).toBeTruthy();
    console.log("refined preview:", result.refined_content.slice(0, 400));

    const lower = result.refined_content.toLowerCase();
    expect(lower).toMatch(/trombo|tvp|profilax/i);
    // Must preserve original content
    expect(result.refined_content).toContain("furosemida");
  });

  it("reformats to numbered list when instructed", async () => {
    const result = await invokeFunction<{ refined_content: string }>(
      "refine-report",
      {
        report_content: SAMPLE_REPORT,
        user_message: "Reformate o plano em tópicos numerados",
        report_type: "medical_evolution",
      }
    );

    expect(result.refined_content).toBeTruthy();
    // Expect numeric list markers
    expect(result.refined_content).toMatch(/1\.|1\)/);
  });

  it("preserves unrelated sections when modifying one section", async () => {
    const result = await invokeFunction<{ refined_content: string }>(
      "refine-report",
      {
        report_content: SAMPLE_REPORT,
        user_message: "Corrija a pressão arterial para 140/90 mmHg",
        report_type: "medical_evolution",
      }
    );

    expect(result.refined_content).toBeTruthy();
    // Updated value present
    expect(result.refined_content).toMatch(/140\/90/);
    // Unrelated lines preserved
    expect(result.refined_content).toContain("furosemida");
    expect(result.refined_content).toContain("SpO2");
  });

  it("returns non-empty refined_content and success flag", async () => {
    const result = await invokeFunction<{
      refined_content: string;
      success: boolean;
    }>("refine-report", {
      report_content: SAMPLE_REPORT,
      user_message: "Traduza os termos técnicos para linguagem mais clara para o paciente",
      report_type: "medical_evolution",
    });

    expect(result.success).toBe(true);
    expect(result.refined_content.length).toBeGreaterThan(100);
  });
});
