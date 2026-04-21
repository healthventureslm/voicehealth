import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

interface BundleItem {
  code: string;
  label: string;
  reference?: string;
}

interface BundleChecklistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function BundleChecklist({ open, onOpenChange, onSaved }: BundleChecklistProps) {
  const { profile } = useAuth();
  const [indicators, setIndicators] = useState<any[]>([]);
  const [subtypes, setSubtypes] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState("");
  const [selectedSubtype, setSelectedSubtype] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [compliance, setCompliance] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("indicators").select("id, name").eq("is_active", true).order("name"),
      supabase.from("patients").select("id, full_name, bed").order("full_name"),
      supabase.from("wards").select("id, name").eq("is_active", true).order("name"),
    ]).then(([indRes, patRes, wardRes]) => {
      setIndicators(indRes.data || []);
      setPatients(patRes.data || []);
      setWards(wardRes.data || []);
    });
  }, [open]);

  useEffect(() => {
    if (!selectedIndicator) { setSubtypes([]); return; }
    supabase
      .from("indicator_subtypes")
      .select("*")
      .eq("indicator_id", selectedIndicator)
      .eq("is_active", true)
      .order("code")
      .then(({ data }) => {
        setSubtypes((data as any[]) || []);
        setSelectedSubtype("");
        setCompliance({});
      });
  }, [selectedIndicator]);

  const bundleItems: BundleItem[] = useMemo(() => {
    const st = subtypes.find((s) => s.id === selectedSubtype);
    if (!st?.bundle_items) return [];
    return Array.isArray(st.bundle_items) ? st.bundle_items : [];
  }, [subtypes, selectedSubtype]);

  useEffect(() => {
    if (bundleItems.length > 0) {
      const init: Record<string, boolean> = {};
      bundleItems.forEach((item) => { init[item.code] = true; });
      setCompliance(init);
    }
  }, [bundleItems]);

  const score = useMemo(() => {
    if (bundleItems.length === 0) return 100;
    const conforming = Object.values(compliance).filter(Boolean).length;
    return Math.round((conforming / bundleItems.length) * 100);
  }, [compliance, bundleItems]);

  const handleSave = async () => {
    if (!selectedIndicator || !selectedPatient) {
      toast.error("Selecione indicador e paciente");
      return;
    }
    setSaving(true);
    try {
      const { data: event, error } = await supabase.from("indicator_events").insert({
        indicator_id: selectedIndicator,
        subtype_id: selectedSubtype || null,
        patient_id: selectedPatient,
        department_id: profile?.department_id!,
        ward_id: selectedWard || null,
        event_date: eventDate,
        bundle_compliance: compliance,
        bundle_score: score,
        notes: notes || null,
        recorded_by: profile?.user_id!,
        root_cause: rootCause || null,
      }).select("id").single();

      if (error) throw error;

      // Check bundle compliance via edge function
      if (event && selectedSubtype) {
        supabase.functions.invoke("check-bundle-compliance", {
          body: { event_id: event.id },
        }).catch(console.error);
      }

      toast.success("Evento registrado com sucesso");
      onOpenChange(false);
      onSaved?.();
      // Reset
      setSelectedIndicator("");
      setSelectedSubtype("");
      setSelectedPatient("");
      setNotes("");
      setRootCause("");
      setCompliance({});
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Registrar Evento de Indicador
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Indicador *</Label>
              <Select value={selectedIndicator} onValueChange={setSelectedIndicator}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {indicators.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subtipo</Label>
              <Select value={selectedSubtype} onValueChange={setSelectedSubtype} disabled={subtypes.length === 0}>
                <SelectTrigger><SelectValue placeholder={subtypes.length === 0 ? "Sem subtipos" : "Selecione..."} /></SelectTrigger>
                <SelectContent>
                  {subtypes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paciente *</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name} {p.bed ? `(Leito ${p.bed})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Enfermaria</Label>
              <Select value={selectedWard} onValueChange={setSelectedWard}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do Evento</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
          </div>

          {/* Bundle Checklist */}
          {bundleItems.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Checklist de Bundle</Label>
                <div className="flex items-center gap-2">
                  {score < 100 && <AlertTriangle className="w-4 h-4 text-warning" />}
                  {score === 100 && <CheckCircle2 className="w-4 h-4 text-success" />}
                  <Badge variant={score === 100 ? "default" : score >= 80 ? "secondary" : "destructive"}>
                    {score}% adesão
                  </Badge>
                </div>
              </div>
              <Progress value={score} className="h-2" />
              <div className="space-y-2">
                {bundleItems.map((item) => (
                  <div key={item.code} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.reference && (
                        <p className="text-xs text-muted-foreground">{item.reference}</p>
                      )}
                    </div>
                    <Switch
                      checked={compliance[item.code] ?? true}
                      onCheckedChange={(v) => setCompliance({ ...compliance, [item.code]: v })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {score < 100 && bundleItems.length > 0 && (
            <div>
              <Label>Causa Raiz (para itens não conformes)</Label>
              <Textarea
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="Descreva a causa raiz das falhas identificadas..."
                rows={2}
              />
            </div>
          )}

          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={2} />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-white border-0">
            {saving ? "Salvando..." : "Registrar Evento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
