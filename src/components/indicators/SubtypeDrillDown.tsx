import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, User, Calendar, MapPin, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface SubtypeDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: any;
}

type DrillLevel = "subtypes" | "events" | "detail";

export function SubtypeDrillDown({ open, onOpenChange, indicator }: SubtypeDrillDownProps) {
  const [level, setLevel] = useState<DrillLevel>("subtypes");
  const [subtypes, setSubtypes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedSubtype, setSelectedSubtype] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !indicator) return;
    setLevel("subtypes");
    setSelectedSubtype(null);
    setSelectedEvent(null);
    fetchSubtypes();
  }, [open, indicator]);

  const fetchSubtypes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("indicator_subtypes")
      .select("*")
      .eq("indicator_id", indicator.id)
      .eq("is_active", true)
      .order("code");

    const subtypesData = (data as any[]) || [];

    // Get event counts per subtype
    for (const st of subtypesData) {
      const { count } = await supabase
        .from("indicator_events")
        .select("id", { count: "exact", head: true })
        .eq("subtype_id", st.id);
      st._eventCount = count || 0;

      // Average bundle score
      const { data: scores } = await supabase
        .from("indicator_events")
        .select("bundle_score")
        .eq("subtype_id", st.id)
        .not("bundle_score", "is", null);
      if (scores && scores.length > 0) {
        st._avgScore = Math.round(scores.reduce((a: number, b: any) => a + (b.bundle_score || 0), 0) / scores.length);
      } else {
        st._avgScore = null;
      }
    }

    setSubtypes(subtypesData);
    setLoading(false);
  };

  const fetchEvents = async (subtype: any) => {
    setLoading(true);
    setSelectedSubtype(subtype);
    setLevel("events");
    const { data } = await supabase
      .from("indicator_events")
      .select("*, patients(full_name, bed), wards(name)")
      .eq("subtype_id", subtype.id)
      .order("event_date", { ascending: false })
      .limit(50);
    setEvents((data as any[]) || []);
    setLoading(false);
  };

  const openDetail = (event: any) => {
    setSelectedEvent(event);
    setLevel("detail");
  };

  const goBack = () => {
    if (level === "detail") { setLevel("events"); setSelectedEvent(null); }
    else if (level === "events") { setLevel("subtypes"); setSelectedSubtype(null); }
  };

  const getSeverityColor = (score: number | null, target?: number) => {
    if (score == null) return "muted";
    const t = target || 80;
    if (score >= t) return "success";
    if (score >= t * 0.75) return "warning";
    return "destructive";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {level !== "subtypes" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {level === "subtypes" && `Subtipos: ${indicator?.name}`}
            {level === "events" && `Eventos: ${selectedSubtype?.code} – ${selectedSubtype?.name}`}
            {level === "detail" && `Detalhe do Evento`}
          </DialogTitle>
        </DialogHeader>

        {/* Level 1: Subtypes */}
        {level === "subtypes" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {subtypes.length === 0 && !loading && (
              <p className="col-span-2 text-center text-muted-foreground py-8">
                Nenhum subtipo configurado. Configure em Admin → Indicadores.
              </p>
            )}
            {subtypes.map((st) => {
              const color = getSeverityColor(st._avgScore, st.target_value);
              return (
                <Card
                  key={st.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-${color}`}
                  onClick={() => fetchEvents(st)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="mb-1">{st.code}</Badge>
                        <p className="font-medium">{st.name}</p>
                        {st.description && <p className="text-xs text-muted-foreground mt-1">{st.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {st._avgScore != null ? `${st._avgScore}%` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{st._eventCount} eventos</p>
                      </div>
                    </div>
                    {st._avgScore != null && (
                      <Progress value={st._avgScore} className="h-1.5 mt-2" />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Level 2: Events */}
        {level === "events" && (
          <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Enfermaria</TableHead>
                  <TableHead>Bundle Score</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum evento registrado
                    </TableCell>
                  </TableRow>
                )}
                {events.map((ev) => (
                  <TableRow key={ev.id} className="cursor-pointer" onClick={() => openDetail(ev)}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(ev.event_date), "dd/MM/yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {(ev.patients as any)?.full_name || "—"}
                        {(ev.patients as any)?.bed && (
                          <Badge variant="outline" className="ml-1 text-xs">L{(ev.patients as any).bed}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {(ev.wards as any)?.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ev.bundle_score != null ? (
                        <Badge variant={ev.bundle_score >= 80 ? "default" : ev.bundle_score >= 60 ? "secondary" : "destructive"}>
                          {ev.bundle_score}%
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="text-xs">Ver</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Level 3: Event Detail */}
        {level === "detail" && selectedEvent && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Paciente</p>
                  <p className="font-medium">{(selectedEvent.patients as any)?.full_name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">{format(new Date(selectedEvent.event_date), "dd/MM/yyyy")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Enfermaria</p>
                  <p className="font-medium">{(selectedEvent.wards as any)?.name || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bundle Score</p>
                <p className="text-2xl font-bold">
                  {selectedEvent.bundle_score != null ? `${selectedEvent.bundle_score}%` : "—"}
                </p>
              </div>
            </div>

            {/* Bundle items detail */}
            {selectedSubtype?.bundle_items && Array.isArray(selectedSubtype.bundle_items) && (
              <div className="border rounded-lg p-4 space-y-2">
                <p className="font-semibold text-sm">Checklist de Bundle</p>
                {(selectedSubtype.bundle_items as any[]).map((item: any) => {
                  const compliant = selectedEvent.bundle_compliance?.[item.code];
                  return (
                    <div key={item.code} className={`flex items-center gap-3 p-2 rounded ${compliant ? "bg-success/5" : "bg-destructive/5"}`}>
                      {compliant ? (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm">{item.label}</p>
                        {item.reference && <p className="text-xs text-muted-foreground">{item.reference}</p>}
                      </div>
                      <Badge variant={compliant ? "default" : "destructive"} className="text-xs">
                        {compliant ? "Conforme" : "Não conforme"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedEvent.root_cause && (
              <div>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Causa Raiz
                </p>
                <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{selectedEvent.root_cause}</p>
              </div>
            )}

            {selectedEvent.corrective_action && (
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Ação Corretiva</p>
                <p className="text-sm mt-1 bg-muted/50 p-2 rounded">{selectedEvent.corrective_action}</p>
              </div>
            )}

            {selectedEvent.notes && (
              <div>
                <p className="text-xs text-muted-foreground font-semibold">Observações</p>
                <p className="text-sm mt-1">{selectedEvent.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
