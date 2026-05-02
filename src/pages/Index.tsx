import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, FileText, ShieldCheck, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Mic,
    eyebrow: "01 · captura",
    title: "Atendimento por voz",
    description:
      "Profissional conduz o atendimento normalmente. O VoiceHealth grava, transcreve e organiza.",
  },
  {
    icon: FileText,
    eyebrow: "02 · documentação",
    title: "Relatório estruturado",
    description:
      "Templates por setor e papel. A IA gera evolução, anamnese ou alta — sem inventar dados.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "03 · governança",
    title: "Auditoria e LGPD",
    description:
      "Adendos append-only, lock automático após transferência, trilha de acessos. Pronto pra hospital.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="hv-wordmark text-xl">
            Voice<em>Health</em>
          </span>
          <span className="hv-byline">— by Health Ventures</span>
        </div>
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/login">
            Entrar <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
        <p className="hv-eyebrow mb-6">Documentação clínica conversacional</p>
        <h1
          className="font-display"
          style={{
            fontWeight: 300,
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          Devolvemos o tempo do <em style={{ fontStyle: "italic", color: "var(--hv-accent)" }}>profissional</em>
          <br />
          ao paciente.
        </h1>
        <p
          className="mt-6 max-w-xl mx-auto"
          style={{ color: "var(--hv-text-secondary)", fontSize: "1.05rem", lineHeight: 1.6 }}
        >
          Voz vira evolução clínica em segundos. Estruturada, auditável, integrada ao
          fluxo do hospital. Sem digitar.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <Button asChild size="lg" className="gap-2">
            <Link to="/login">
              Acessar o sistema <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/privacy">Política de privacidade</Link>
          </Button>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <p className="hv-eyebrow text-center mb-3">Como funciona</p>
        <h2 className="heading-page text-center mb-12">
          Três etapas. <em style={{ fontStyle: "italic", color: "var(--hv-accent)" }}>Zero</em> atrito.
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="hv-card">
              <CardContent className="p-6 space-y-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: "rgba(168,197,181,0.08)",
                    border: "1px solid var(--hv-accent)",
                  }}
                >
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="hv-eyebrow">{f.eyebrow}</p>
                <h3 className="heading-card">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--hv-text-secondary)" }}>
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── PRINCÍPIOS ── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <Card className="hv-card">
          <CardContent className="p-8 md:p-12 space-y-4">
            <p className="hv-eyebrow">Operator-first</p>
            <h2 className="heading-section">
              Construímos com quem está na ponta.
            </h2>
            <p style={{ color: "var(--hv-text-secondary)", lineHeight: 1.7 }}>
              VoiceHealth nasce dentro da Health Ventures, um venture builder operado por
              executivos de saúde. Cada feature responde a uma fricção real — relatada por
              médicos, enfermeiros e gestores que vivem o sistema todos os dias.
            </p>
            <p style={{ color: "var(--hv-text-muted)", fontSize: "0.85rem" }}>
              Progresso na velocidade da confiança.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/40 py-8 mt-12">
        <div
          className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
          style={{ color: "var(--hv-text-muted)" }}
        >
          <div className="flex items-baseline gap-2">
            <span className="hv-wordmark text-sm">
              Voice<em>Health</em>
            </span>
            <span className="hv-byline">— by Health Ventures · {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacidade & LGPD
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
