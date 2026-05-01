import { Mic } from "lucide-react";

/**
 * Header padronizado das telas de auth (Login, Signup, Forgot, Reset, Waiting).
 * Aplica o wordmark VoiceHealth do brand HV: serif Light + Italic Sage + byline.
 */
export function AuthHero({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center mb-8">
      <div
        className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: "var(--hv-card)", border: "1px solid var(--hv-accent)" }}
      >
        <Mic className="w-5 h-5" style={{ color: "var(--hv-accent)" }} />
      </div>
      <h1 className="hv-wordmark text-3xl">
        Voice<em>Health</em>
      </h1>
      <p className="hv-byline mt-1">— by Health Ventures</p>
      {subtitle && (
        <p className="text-sm mt-3" style={{ color: "var(--hv-text-secondary)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
