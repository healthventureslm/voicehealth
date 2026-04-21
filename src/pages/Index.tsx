import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, FileText, BarChart3, Shield, ArrowRight, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const sectors = [
  {
    name: "UTI",
    image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&q=80",
  },
  {
    name: "Centro Cirúrgico",
    image: "https://images.unsplash.com/photo-1551190822-a9ce113ac100?w=600&q=80",
  },
  {
    name: "Enfermaria",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80",
  },
  {
    name: "Ambulatório",
    image: "https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=600&q=80",
  },
];

const features = [
  {
    icon: Mic,
    title: "Gravação por Voz",
    description: "Capture atendimentos por áudio e obtenha transcrições automáticas com IA.",
  },
  {
    icon: FileText,
    title: "Relatórios com IA",
    description: "Gere relatórios clínicos estruturados a partir da transcrição, em segundos.",
  },
  {
    icon: BarChart3,
    title: "Indicadores em Tempo Real",
    description: "Acompanhe métricas de qualidade, segurança e conformidade do seu hospital.",
  },
];

const Index = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-24 md:py-36 text-center">
          <Badge variant="outline" className="mb-6 text-muted-foreground border-border">
            Parte da família Voxflow
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              VoiceHealth
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-3 font-medium">
            Prontuário Médico Conversacional
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Transforme a voz do profissional em documentação clínica estruturada.
            Menos tempo digitando, mais tempo cuidando.
          </p>
          <Button asChild size="lg" className="gradient-primary text-primary-foreground px-8">
            <Link to="/dashboard">
              Acessar o Sistema <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">O que é o VoiceHealth</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="glass-card">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Sectors */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Setores Atendidos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {sectors.map((s) => (
            <div key={s.name} className="relative rounded-lg overflow-hidden aspect-[4/3] group">
              <img
                src={s.image}
                alt={s.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-background/60 flex items-end p-4">
                <span className="font-semibold text-sm md:text-base">{s.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Voxflow Family */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="glass-card rounded-2xl p-8 md:p-12">
          <Shield className="h-10 w-10 text-secondary mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold mb-3">Ecossistema Voxflow</h2>
          <p className="text-muted-foreground leading-relaxed">
            O VoiceHealth faz parte da família de soluções Voxflow — plataformas inteligentes
            que utilizam voz e inteligência artificial para digitalizar processos em saúde,
            garantindo conformidade, segurança e eficiência operacional.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} VoiceHealth · Voxflow</span>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
