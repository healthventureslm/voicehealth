import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TeleprompterPanel } from "@/components/consultation/TeleprompterPanel";
import type { ScriptFieldWithStatus } from "@/hooks/useScriptMatching";

const makeFields = (covered: boolean[]): ScriptFieldWithStatus[] =>
  covered.map((c, i) => ({
    id: `field_${i}`,
    label: `Campo ${i + 1}`,
    required: i === 0,
    keywords: [`keyword${i}`],
    covered: c,
  }));

describe("TeleprompterPanel", () => {
  it("shows correct covered/total count", () => {
    render(
      <TeleprompterPanel
        scriptName="Script Teste"
        fields={makeFields([true, false, false])}
        isListening={true}
      />
    );
    expect(screen.getByText("1/3 cobertos")).toBeInTheDocument();
  });

  it("shows 'Escutando' indicator when listening", () => {
    render(
      <TeleprompterPanel
        scriptName="Script"
        fields={makeFields([false])}
        isListening={true}
      />
    );
    expect(screen.getByText(/Escutando/i)).toBeInTheDocument();
  });

  it("shows hint when not listening", () => {
    render(
      <TeleprompterPanel
        scriptName="Script"
        fields={makeFields([false])}
        isListening={false}
      />
    );
    expect(screen.getByText(/Inicie a gravação/i)).toBeInTheDocument();
  });

  it("applies line-through to covered fields", () => {
    render(
      <TeleprompterPanel
        scriptName="Script"
        fields={makeFields([true, false])}
        isListening={true}
      />
    );
    const coveredEl = screen.getByText("Campo 1");
    expect(coveredEl.className).toContain("line-through");
  });

  it("shows required badge on uncovered required fields", () => {
    const fields: ScriptFieldWithStatus[] = [
      { id: "f1", label: "Campo Req", required: true, keywords: [], covered: false },
    ];
    render(
      <TeleprompterPanel scriptName="Script" fields={fields} isListening={true} />
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows all-covered message when complete", () => {
    render(
      <TeleprompterPanel
        scriptName="Script"
        fields={makeFields([true, true])}
        isListening={true}
      />
    );
    expect(screen.getByText(/Todos os campos cobertos/i)).toBeInTheDocument();
  });

  it("shows script name in subtitle", () => {
    render(
      <TeleprompterPanel
        scriptName="Evolução UTI — Sepse"
        fields={makeFields([false])}
        isListening={false}
      />
    );
    expect(screen.getByText("Evolução UTI — Sepse")).toBeInTheDocument();
  });
});
