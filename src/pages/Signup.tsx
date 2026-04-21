import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mic, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle, ShieldAlert, Shield } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const roleLabels: Record<string, string> = {
  admin: "Administrador", medico: "Médico", enfermeiro: "Enfermeiro", tecnico: "Técnico",
  farmaceutico: "Farmacêutico", auditor: "Auditor", fisioterapeuta: "Fisioterapeuta",
  nutricionista: "Nutricionista", fonoaudiologo: "Fonoaudiólogo", psicologo: "Psicólogo",
  assistente_social: "Assistente Social",
};

interface Invitation {
  id: string;
  email: string;
  role: string;
  department_id: string | null;
  token: string;
  status: string;
  expires_at: string;
  department?: { name: string } | null;
}

export default function Signup() {
  const { signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(!!token);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Admin whitelist mode
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [whitelistChecking, setWhitelistChecking] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvitationLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, department:departments(name)")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();

      if (error || !data) {
        setInvitationError("Convite não encontrado ou já utilizado.");
        setInvitationLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setInvitationError("Este convite expirou. Solicite um novo ao administrador.");
        setInvitationLoading(false);
        return;
      }

      setInvitation(data as unknown as Invitation);
      setEmail(data.email);
      setInvitationLoading(false);
    };

    fetchInvitation();
  }, [token]);

  const checkWhitelist = async () => {
    if (!email.trim()) {
      setWhitelistError("Digite seu e-mail.");
      return;
    }
    setWhitelistChecking(true);
    setWhitelistError(null);
    try {
      const { data } = await supabase
        .from("admin_whitelist")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (data) {
        setIsAdminMode(true);
        setShowAdminForm(true);
      } else {
        setWhitelistError("E-mail não autorizado. O cadastro é feito apenas por convite do administrador.");
      }
    } catch {
      setWhitelistError("Erro ao verificar e-mail.");
    } finally {
      setWhitelistChecking(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (!lgpdConsent) {
      toast({ title: "Consentimento necessário", description: "Você precisa aceitar a política de privacidade.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const metadata: Record<string, string> = { full_name: fullName.trim() };
      if (token) metadata.invitation_token = token;
      if (isAdminMode) metadata.admin_whitelist = "true";

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: metadata,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        if (error.message.includes("already registered")) {
          toast({ title: "E-mail já cadastrado", description: "Use outro e-mail ou faça login.", variant: "destructive" });
        } else {
          toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
        }
      } else {
        setSuccess(true);
      }
    } catch {
      toast({ title: "Erro inesperado", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // No token — show admin access option
  if (!token && !showAdminForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="glass-card rounded-2xl p-8 space-y-5">
            <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro por convite</h2>
            <p className="text-muted-foreground">
              O cadastro nesta plataforma é feito apenas por convite do administrador.
              Solicite um convite ao administrador do seu hospital.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>

          {/* Admin direct access */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Acesso de Administrador</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Se você é administrador autorizado, insira seu e-mail para verificar.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setWhitelistError(null); }}
                className="rounded-xl h-11"
              />
              <Button onClick={checkWhitelist} disabled={whitelistChecking} className="rounded-xl whitespace-nowrap">
                {whitelistChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verificar"}
              </Button>
            </div>
            {whitelistError && (
              <p className="text-sm text-destructive">{whitelistError}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invitationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="glass-card rounded-2xl p-8 space-y-5">
            <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold">Convite inválido</h2>
            <p className="text-muted-foreground">{invitationError}</p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="glass-card rounded-2xl p-8 space-y-5">
            <CheckCircle className="w-16 h-16 text-secondary mx-auto" />
            <h2 className="text-2xl font-bold">Verifique seu e-mail</h2>
            <p className="text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique no link para ativar sua conta.
            </p>
            <p className="text-sm text-muted-foreground">Não recebeu? Verifique a pasta de spam.</p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Mic className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
          <p className="text-muted-foreground text-sm">Cadastre-se no VoiceHealth</p>
        </div>

        <div className="glass-card rounded-2xl p-7 space-y-5">
          {/* Invitation info or Admin info */}
          {invitation && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium">Convite para:</p>
              <p className="text-sm text-muted-foreground">{invitation.email}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{roleLabels[invitation.role] || invitation.role}</Badge>
                {invitation.department && (
                  <Badge variant="outline">{(invitation.department as any)?.name}</Badge>
                )}
              </div>
            </div>
          )}
          {isAdminMode && (
            <div className="bg-primary/10 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Acesso de Administrador</p>
              </div>
              <p className="text-sm text-muted-foreground">{email}</p>
              <Badge variant="secondary">Administrador</Badge>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="fullName" placeholder="Dr. João Silva" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 h-11 rounded-xl" required maxLength={100} autoComplete="name" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signupEmail">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="signupEmail" type="email" value={email} className="pl-10 h-11 rounded-xl bg-muted" readOnly />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signupPassword">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="signupPassword" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11 rounded-xl" required minLength={6} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Repita a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11 rounded-xl" required minLength={6} autoComplete="new-password" />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>

            <div className="flex items-start space-x-3 pt-1">
              <Checkbox id="lgpd" checked={lgpdConsent} onCheckedChange={(v) => setLgpdConsent(v === true)} className="mt-0.5" />
              <label htmlFor="lgpd" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                Li e aceito a{" "}
                <Link to="/privacy" className="underline text-primary hover:text-primary/80" target="_blank">
                  Política de Privacidade
                </Link>{" "}
                e consinto com o tratamento dos meus dados pessoais e de saúde conforme a LGPD.
              </label>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading || !lgpdConsent}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar conta
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-3 text-muted-foreground">ou</span></div>
          </div>

          <Button onClick={signInWithGoogle} className="w-full h-11 rounded-xl gap-3" variant="outline">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Cadastrar com Google
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
