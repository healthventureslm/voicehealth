import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle2, User, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export function BundleAlertPanel() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("bundle_alerts")
      .select("*, patients(full_name), indicator_subtypes(code, name), indicators(name)")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setAlerts((data as any[]) || []);
  };

  useEffect(() => {
    fetchAlerts();
    // Realtime subscription
    const channel = supabase
      .channel("bundle-alerts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bundle_alerts" }, () => {
        fetchAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleResolve = async (alertId: string) => {
    const { error } = await supabase
      .from("bundle_alerts")
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: profile?.user_id,
        resolution_notes: resolutionNotes || null,
      })
      .eq("id", alertId);

    if (error) {
      toast.error("Erro ao resolver alerta");
    } else {
      toast.success("Alerta resolvido");
      setResolvingId(null);
      setResolutionNotes("");
      fetchAlerts();
    }
  };

  if (alerts.length === 0) return null;

  return (
    <Card className="glass-card border-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          Alertas de Bundle Ativos
          <Badge variant="destructive" className="ml-auto">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border ${
              alert.severity === "critical" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"} className="text-xs">
                    {alert.severity === "critical" ? "CRÍTICO" : "ATENÇÃO"}
                  </Badge>
                  {(alert.indicator_subtypes as any)?.code && (
                    <Badge variant="outline" className="text-xs">
                      {(alert.indicator_subtypes as any).code}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {(alert.patients as any)?.full_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {(alert.patients as any).full_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {format(new Date(alert.created_at), "dd/MM HH:mm")}
                  </span>
                </div>
                {/* Failed items */}
                {Array.isArray(alert.failed_items) && alert.failed_items.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(alert.failed_items as any[]).map((item: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                        <XCircle className="w-2.5 h-2.5" /> {item.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {resolvingId === alert.id ? (
                  <div className="space-y-2 w-48">
                    <Input
                      placeholder="Ação tomada..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleResolve(alert.id)}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResolvingId(null)}>
                        ×
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setResolvingId(alert.id)}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Resolver
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
