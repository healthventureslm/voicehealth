import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ClipboardList } from "lucide-react";
import { format } from "date-fns";

const statusLabel: Record<string, string> = {
  recording: "Gravando", transcribing: "Transcrevendo", transcribed: "Transcrito",
  editing: "Editando", completed: "Concluído",
};
const statusVariant: Record<string, string> = {
  completed: "bg-success/10 text-success", transcribed: "bg-primary/10 text-primary",
  editing: "bg-warning/10 text-warning", recording: "bg-muted text-muted-foreground",
  transcribing: "bg-muted text-muted-foreground",
};

export default function Consultations() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("consultations")
      .select("*, patients(full_name, bed, medical_record)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setConsultations(data || []));
  }, []);

  const filtered = consultations.filter((c) =>
    c.patients?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.patients?.medical_record?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Atendimentos</h1>
            <p className="text-muted-foreground">Histórico de todos os atendimentos</p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/consultations/new")}>
            <Plus className="w-4 h-4" /> Nova Gravação
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por paciente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum atendimento encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Leito</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" role="link" tabIndex={0} onClick={() => navigate(`/consultations/${c.id}/edit`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/consultations/${c.id}/edit`); } }}>
                      <TableCell className="font-medium">{c.patients?.full_name}</TableCell>
                      <TableCell>{c.patients?.bed || "—"}</TableCell>
                      <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusVariant[c.status] || ""}`}>
                          {statusLabel[c.status] || c.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
