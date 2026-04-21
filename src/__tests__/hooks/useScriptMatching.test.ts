import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useScriptMatching } from "@/hooks/useScriptMatching";
import type { ScriptField } from "@/hooks/useScriptMatching";

const FIELDS: ScriptField[] = [
  { id: "identificacao", label: "Identificação do paciente", required: true, keywords: ["paciente", "anos"] },
  { id: "diagnostico", label: "Diagnóstico principal", required: true, keywords: ["diagnostico", "icc", "sepse"] },
  { id: "prescricao", label: "Prescrição completa", required: true, keywords: ["mg", "prescricao", "comprimido", "ev"] },
  { id: "plano", label: "Plano terapêutico", required: false, keywords: ["plano", "alta", "proximo"] },
];

describe("useScriptMatching", () => {
  it("returns empty array when fields is null", () => {
    const { result } = renderHook(() => useScriptMatching(null, "qualquer texto"));
    expect(result.current).toEqual([]);
  });

  it("returns empty array when fields is empty", () => {
    const { result } = renderHook(() => useScriptMatching([], "qualquer texto"));
    expect(result.current).toEqual([]);
  });

  it("marks all fields as uncovered for empty transcript", () => {
    const { result } = renderHook(() => useScriptMatching(FIELDS, ""));
    expect(result.current.every((f) => !f.covered)).toBe(true);
  });

  it("marks field as covered when keyword is present", () => {
    const { result } = renderHook(() =>
      useScriptMatching(FIELDS, "Paciente João, 67 anos")
    );
    expect(result.current.find((f) => f.id === "identificacao")?.covered).toBe(true);
    expect(result.current.find((f) => f.id === "diagnostico")?.covered).toBe(false);
  });

  it("handles accented characters correctly (pt-BR)", () => {
    const { result } = renderHook(() =>
      useScriptMatching(FIELDS, "diagnóstico de ICC descompensada")
    );
    expect(result.current.find((f) => f.id === "diagnostico")?.covered).toBe(true);
  });

  it("covers multiple fields from a realistic medical sentence", () => {
    const transcript =
      "Paciente Maria, 72 anos, diagnóstico de ICC. Prescrever furosemida 40mg EV.";
    const { result } = renderHook(() => useScriptMatching(FIELDS, transcript));
    const covered = result.current.filter((f) => f.covered).map((f) => f.id);
    expect(covered).toContain("identificacao");
    expect(covered).toContain("diagnostico");
    expect(covered).toContain("prescricao");
    expect(covered).not.toContain("plano"); // not mentioned
  });

  it("is case-insensitive", () => {
    const { result } = renderHook(() =>
      useScriptMatching(FIELDS, "DIAGNÓSTICO DE SEPSE GRAVE")
    );
    expect(result.current.find((f) => f.id === "diagnostico")?.covered).toBe(true);
  });

  it("preserves required flag and label in output", () => {
    const { result } = renderHook(() => useScriptMatching(FIELDS, ""));
    const field = result.current.find((f) => f.id === "identificacao")!;
    expect(field.required).toBe(true);
    expect(field.label).toBe("Identificação do paciente");
  });
});
