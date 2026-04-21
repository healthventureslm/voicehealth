import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Lock, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setHasRecoveryToken(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoveryToken(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Erro ao redefinir", description: error.message, variant: "destructive" });
      } else {
        setSuccess(true);
        setTimeout(() => navigate("/dashboard"), 3000);
      }
    } catch {
      toast({ title: "Erro inesperado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!hasRecoveryToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center glass-card rounded-2xl p-8 space-y-4">
          <h2 className="text-xl font-bold">Link inválido ou expirado</h2>
          <p className="text-sm text-muted-foreground">Solicite um novo link de recuperação de senha.</p>
          <Button asChild className="rounded-xl">
            <Link to="/forgot-password">Solicitar novo link</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center glass-card rounded-2xl p-8 space-y-4">
          <CheckCircle className="w-16 h-16 text-secondary mx-auto" />
          <h2 className="text-2xl font-bold">Senha redefinida!</h2>
          <p className="text-sm text-muted-foreground">Você será redirecionado automaticamente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Mic className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nova senha</h1>
          <p className="text-muted-foreground text-sm">Defina sua nova senha de acesso</p>
        </div>

        <div className="glass-card rounded-2xl p-7">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11 rounded-xl" required minLength={6} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirmNewPassword" type={showPassword ? "text" : "password"} placeholder="Repita a nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11 rounded-xl" required minLength={6} autoComplete="new-password" />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Redefinir senha
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
