import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, X } from "lucide-react";
import { Link } from "react-router-dom";

export function LgpdConsentBanner() {
  const { user, profile } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user && profile && !(profile as any).lgpd_consent_given) {
      setShow(true);
    }
  }, [user, profile]);

  const handleAccept = async () => {
    if (!user) return;

    // Record consent
    await supabase.from("lgpd_consent_records").insert({
      user_id: user.id,
      consent_type: "data_processing",
      granted: true,
      user_agent: navigator.userAgent,
    });

    // Update profile
    await supabase.from("profiles").update({
      lgpd_consent_given: true,
      lgpd_consent_date: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Audit log
    await supabase.from("lgpd_audit_logs").insert({
      user_id: user.id,
      action: "consent_granted",
      details: { consent_type: "data_processing", version: "1.0" },
    });

    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg p-4 md:p-6">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
        <Shield className="w-8 h-8 text-primary flex-shrink-0 mt-1 md:mt-0" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-foreground">Proteção de Dados — LGPD</p>
          <p className="text-sm text-muted-foreground">
            Este sistema processa dados pessoais e de saúde conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            Ao continuar, você consente com o tratamento dos seus dados para as finalidades descritas em nossa{" "}
            <Link to="/privacy" className="underline text-primary hover:text-primary/80">
              Política de Privacidade
            </Link>.
            Você pode revogar este consentimento a qualquer momento em Configurações → Privacidade.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link to="/privacy">Ver Política</Link>
          </Button>
          <Button size="sm" onClick={handleAccept} className="gap-1.5">
            <Shield className="w-4 h-4" /> Aceitar e Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
