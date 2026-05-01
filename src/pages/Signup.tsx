import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle, ShieldAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthHero } from "@/components/auth/AuthHero";

const ROLE_LABELS: Record<string, string> = {
  hospital_admin: "Admin do Hospital",
  doctor:         "Médico(a)",
  nurse:          "Enfermeiro(a)",
  auditor:        "Auditor(a)",
};

interface InvitationPreview {
  id: string;
  email: string;
  role: string;
  hospital_id: string;
  ward_ids: string[];
  expires_at: string;
  status: string;
  hospital_name?: string;
  ward_names?: string[];
}

export default function Signup() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");

  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(!!token);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Busca convite (preview) ─────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setInvitationLoading(false);
      return;
    }

    (async () => {
      // Função RPC peek_invitation (SECURITY DEFINER) bypassa RLS — anon pode chamar.
      // Definida em db-rebuild/05_phase3_invitation_peek.sql
      const { data, error } = await supabase.rpc("peek_invitation" as any, {
        p_token: token,
      });

      if (error) {
        console.error("peek_invitation error:", error);
        setInvitationError("Não foi possível validar o convite. Verifique se o link está correto.");
        setInvitationLoading(false);
        return;
      }

      const row = Array.isArray(data) ? (data as any[])[0] : data;
      if (!row) {
        setInvitationError("Convite não encontrado.");
        setInvitationLoading(false);
        return;
      }
      if (row.status !== "pending") {
        setInvitationError(`Convite já está '${row.status}'.`);
        setInvitationLoading(false);
        return;
      }
      if (new Date(row.expires_at) < new Date()) {
        setInvitationError("Este convite expirou.");
        setInvitationLoading(false);
        return;
      }

      setInvitation({
        id: row.id,
        email: row.email,
        role: row.role,
        hospital_id: row.hospital_id,
        ward_ids: row.ward_ids ?? [],
        status: row.status,
        expires_at: row.expires_at,
        hospital_name: row.hospital_name ?? undefined,
        ward_names: row.ward_names ?? [],
      });
      setEmail(row.email);
      setInvitationLoading(false);
    })();
  }, [token]);

  // ── Submit ──────────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (!lgpdConsent) {
      toast({ title: "Consentimento necessário", description: "Aceite a política de privacidade.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            ...(token ? { invitation_token: token } : {}),
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "E-mail já cadastrado",
            description: "Faça login com a conta existente. Se foi você que criou, use 'Esqueci a senha'.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      // Se vier sessão imediata (auto-confirm), tentamos aceitar o convite agora.
      if (token && signUpData.session) {
        try {
          const { error: acceptErr } = await supabase.functions.invoke("accept-invitation", {
            body: { invitation_token: token },
          });
          if (acceptErr) {
            console.error("accept-invitation error:", acceptErr);
            toast({
              title: "Conta criada, mas convite falhou",
              description: "Avise o admin do hospital pra refazer o convite.",
              variant: "destructive",
            });
          }
        } catch (err) {
          console.error(err);
        }
        // O AuthContext detecta a sessão e redireciona ao Dashboard
        navigate("/", { replace: true });
        return;
      }

      // Se Supabase exige confirmação por e-mail, mostra mensagem
      toast({
        title: "Conta criada",
        description: "Verifique seu e-mail pra confirmar (ou peça ao admin pra ativar manualmente).",
      });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── Renderização ────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="glass-card rounded-2xl p-8 space-y-5">
            <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro apenas por convite</h2>
            <p className="text-muted-foreground">
              O VoiceHealth é uma plataforma fechada. Solicite um convite ao
              administrador do seu hospital — você receberá um link único.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/login">Voltar ao login</Link>
            </Button>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <AuthHero subtitle="Aceitar convite e criar sua conta" />

        <div className="glass-card rounded-2xl p-7 space-y-5">
          {invitation && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium">
                Convite para <span className="text-primary">{invitation.email}</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Badge variant="secondary">{ROLE_LABELS[invitation.role] ?? invitation.role}</Badge>
                {invitation.hospital_name && (
                  <Badge variant="outline">{invitation.hospital_name}</Badge>
                )}
                {invitation.ward_names?.map((wn) => (
                  <Badge key={wn} variant="outline">{wn}</Badge>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  placeholder="Maria Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-11 rounded-xl"
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  className="pl-10 h-11 rounded-xl bg-muted"
                  readOnly
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 rounded-xl"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl"
                  required
                  minLength={6}
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>

            <div className="flex items-start space-x-3 pt-1">
              <Checkbox
                id="lgpd"
                checked={lgpdConsent}
                onCheckedChange={(v) => setLgpdConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="lgpd" className="text-xs text-muted-foreground cursor-pointer">
                Li e aceito a{" "}
                <Link to="/privacy" className="underline text-primary" target="_blank">
                  Política de Privacidade
                </Link>{" "}
                e consinto com o tratamento dos dados conforme a LGPD.
              </label>
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading || !lgpdConsent}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Criando conta…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" /> Aceitar convite e criar conta
                </>
              )}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
