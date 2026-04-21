import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSpecialties } from "@/hooks/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, User, ShieldCheck, Stethoscope, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const registryTypes = [
  { value: "CRM", label: "CRM – Conselho Regional de Medicina" },
  { value: "COREN", label: "COREN – Conselho Regional de Enfermagem" },
  { value: "CRF", label: "CRF – Conselho Regional de Farmácia" },
  { value: "CREFITO", label: "CREFITO – Fisioterapia / T.O." },
  { value: "CRN", label: "CRN – Conselho Regional de Nutrição" },
  { value: "CRFa", label: "CRFa – Conselho Regional de Fonoaudiologia" },
  { value: "CRP", label: "CRP – Conselho Regional de Psicologia" },
  { value: "CRESS", label: "CRESS – Serviço Social" },
];

const professionalRoles = [
  { value: "medico", label: "Médico(a)" },
  { value: "enfermeiro", label: "Enfermeiro(a)" },
  { value: "tecnico", label: "Técnico(a) de Enfermagem" },
  { value: "farmaceutico", label: "Farmacêutico(a)" },
  { value: "fisioterapeuta", label: "Fisioterapeuta" },
  { value: "nutricionista", label: "Nutricionista" },
  { value: "fonoaudiologo", label: "Fonoaudiólogo(a)" },
  { value: "psicologo", label: "Psicólogo(a)" },
  { value: "assistente_social", label: "Assistente Social" },
  { value: "auditor", label: "Auditor(a)" },
];

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: specialties = [] } = useSpecialties();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [registryType, setRegistryType] = useState("");
  const [registryNumber, setRegistryNumber] = useState("");
  const [digitalSignature, setDigitalSignature] = useState(false);
  const [preferredSpecialty, setPreferredSpecialty] = useState("");

  // Populate form from profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setProfessionalRole(profile.professional_role || "");
      setRegistryType(profile.professional_registry_type || "");
      setRegistryNumber(profile.professional_registry || "");
      setDigitalSignature(profile.digital_signature_enabled || false);
    }
  }, [profile]);

  // Load preferred specialty from app_settings
  useEffect(() => {
    if (!user) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", `preferred_specialty_${user.id}`)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setPreferredSpecialty(data.value);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          professional_role: professionalRole || null,
          professional_registry_type: registryType || null,
          professional_registry: registryNumber.trim() || null,
          digital_signature_enabled: digitalSignature,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Save preferred specialty
      if (preferredSpecialty) {
        const { error: settError } = await supabase
          .from("app_settings")
          .upsert(
            {
              key: `preferred_specialty_${user.id}`,
              value: preferredSpecialty,
              description: "Especialidade preferida do profissional",
              updated_by: user.id,
            },
            { onConflict: "key" }
          );
        if (settError) console.error("Error saving specialty preference:", settError);
      }

      await refreshProfile();
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const initials = fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus dados profissionais e preferências</p>
        </div>

        {/* Avatar & basic info */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-lg truncate">{fullName || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                {professionalRole && (
                  <Badge variant="secondary" className="mt-1">
                    {professionalRoles.find((r) => r.value === professionalRole)?.label || professionalRole}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Professional data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" /> Dados Profissionais
            </CardTitle>
            <CardDescription>Informações exibidas nos documentos clínicos gerados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. João Silva" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Função profissional</Label>
              <Select value={professionalRole} onValueChange={setProfessionalRole}>
                <SelectTrigger id="role"><SelectValue placeholder="Selecione sua função" /></SelectTrigger>
                <SelectContent>
                  {professionalRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registryType">Tipo de registro</Label>
                <Select value={registryType} onValueChange={setRegistryType}>
                  <SelectTrigger id="registryType"><SelectValue placeholder="CRM, COREN..." /></SelectTrigger>
                  <SelectContent>
                    {registryTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registryNumber">Número do registro</Label>
                <Input
                  id="registryNumber"
                  value={registryNumber}
                  onChange={(e) => setRegistryNumber(e.target.value)}
                  placeholder="123456/SP"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Specialty preference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="w-4 h-4" /> Especialidade Preferida
            </CardTitle>
            <CardDescription>Pré-seleciona esta especialidade ao iniciar novas consultas</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={preferredSpecialty} onValueChange={setPreferredSpecialty}>
              <SelectTrigger><SelectValue placeholder="Nenhuma preferência" /></SelectTrigger>
              <SelectContent>
                {specialties.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Digital signature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4" /> Assinatura Digital
            </CardTitle>
            <CardDescription>
              Habilita a inclusão automática de assinatura digital nos documentos clínicos exportados (Lei 14.063/2020)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Assinatura digital habilitada</p>
                <p className="text-xs text-muted-foreground">
                  {registryType && registryNumber
                    ? `Será assinado como ${registryType} ${registryNumber}`
                    : "Preencha o registro profissional acima para usar"}
                </p>
              </div>
              <Switch
                checked={digitalSignature}
                onCheckedChange={setDigitalSignature}
                disabled={!registryType || !registryNumber.trim()}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <Button onClick={handleSave} disabled={saving} className="w-full gap-2" size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Perfil
        </Button>
      </div>
    </AppLayout>
  );
}