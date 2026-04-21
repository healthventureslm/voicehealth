import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        setSent(true);
      }
    } catch {
      toast({ title: "Erro inesperado", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Mic className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Recuperar senha</h1>
          <p className="text-muted-foreground text-sm">Enviaremos um link para redefinir sua senha</p>
        </div>

        <div className="glass-card rounded-2xl p-7 space-y-5">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-14 h-14 text-secondary mx-auto" />
              <h2 className="text-lg font-semibold">E-mail enviado!</h2>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir sua senha.
              </p>
              <p className="text-xs text-muted-foreground">Não recebeu? Verifique o spam ou tente novamente.</p>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSent(false)}>
                  Tentar novamente
                </Button>
                <Button asChild size="sm" className="rounded-xl">
                  <Link to="/login">Voltar ao login</Link>
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail cadastrado</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 rounded-xl" required autoComplete="email" />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                Enviar link de recuperação
              </Button>
            </form>
          )}

          <div className="text-center pt-1">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
