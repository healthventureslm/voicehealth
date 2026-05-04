import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Log como warn (não error) — 404 é comportamento esperado pra rotas inexistentes
    console.warn("[404] rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-6">
        <p className="hv-eyebrow">Erro 404</p>
        <h1
          className="font-display"
          style={{
            fontWeight: 300,
            fontSize: "clamp(3rem, 8vw, 5rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          Página não <em style={{ fontStyle: "italic", color: "var(--hv-accent)" }}>encontrada</em>
        </h1>
        <p style={{ color: "var(--hv-text-secondary)" }}>
          A rota <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{location.pathname}</code> não existe ou foi removida.
        </p>
        <Button asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" /> Voltar pra home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
