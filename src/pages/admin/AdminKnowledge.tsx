import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, BookOpen, FileText, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

type KnowledgeDoc = {
  id: string;
  title: string;
  source: string;
  content: string;
  category: string | null;
  specialty_id: string | null;
  is_active: boolean;
  created_at: string;
  file_url: string | null;
  processing_status: string;
  chunks: any;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Specialty = {
  id: string;
  name: string;
  is_active: boolean;
};

export default function AdminKnowledge() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState("text");
  const [form, setForm] = useState({ title: "", source: "custom", content: "", category: "", specialty_id: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [dRes, sRes] = await Promise.all([
      supabase.from("knowledge_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("medical_specialties").select("*").eq("is_active", true).order("name"),
    ]);
    setDocs((dRes.data as unknown as KnowledgeDoc[]) || []);
    setSpecialties((sRes.data as Specialty[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveText = async () => {
    if (!form.title || !form.content) { toast.error("Título e conteúdo são obrigatórios"); return; }
    setUploading(true);
    try {
      const { data: inserted, error } = await (supabase.from("knowledge_documents") as any).insert({
        title: form.title,
        source: form.source,
        content: form.content,
        category: form.category || null,
        specialty_id: form.specialty_id || null,
        uploaded_by: user?.id,
        processing_status: "processing",
      }).select("id").single();
      if (error) throw error;

      toast.success("Documento salvo! Gerando embeddings...");
      setDialogOpen(false);
      setForm({ title: "", source: "custom", content: "", category: "", specialty_id: "" });
      load();

      // Process embeddings
      supabase.functions.invoke("process-knowledge-doc", {
        body: { document_id: inserted.id },
      }).then(() => {
        toast.success("Embeddings gerados com sucesso!");
        load();
      }).catch(() => {
        toast.error("Erro ao gerar embeddings");
        load();
      });
    } catch {
      toast.error("Erro ao salvar documento");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!form.title || !pdfFile) { toast.error("Título e arquivo PDF são obrigatórios"); return; }
    setUploading(true);
    try {
      const fileExt = pdfFile.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("knowledge-docs")
        .upload(filePath, pdfFile, { contentType: pdfFile.type });
      if (uploadError) throw uploadError;

      const { data: inserted, error } = await (supabase.from("knowledge_documents") as any).insert({
        title: form.title,
        source: form.source,
        content: "",
        category: form.category || null,
        specialty_id: form.specialty_id || null,
        uploaded_by: user?.id,
        file_url: filePath,
        processing_status: "processing",
      }).select("id").single();
      if (error) throw error;

      toast.success("PDF enviado! Processando e gerando embeddings...");
      setDialogOpen(false);
      setForm({ title: "", source: "custom", content: "", category: "", specialty_id: "" });
      setPdfFile(null);
      load();

      supabase.functions.invoke("process-knowledge-doc", {
        body: { document_id: inserted.id },
      }).then(() => {
        toast.success("PDF processado e embeddings gerados!");
        load();
      }).catch(() => {
        toast.error("Erro ao processar PDF");
        load();
      });
    } catch (err: any) {
      toast.error("Erro ao enviar PDF: " + (err.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("knowledge_chunks").delete().eq("document_id", id);
    await supabase.from("knowledge_documents").delete().eq("id", id);
    toast.success("Documento removido");
    load();
  };

  const handleReprocess = async (id: string) => {
    toast.info("Reprocessando embeddings...");
    await (supabase.from("knowledge_documents") as any).update({ processing_status: "processing" }).eq("id", id);
    load();
    supabase.functions.invoke("process-knowledge-doc", { body: { document_id: id } })
      .then(() => { toast.success("Reprocessado!"); load(); })
      .catch(() => { toast.error("Erro ao reprocessar"); load(); });
  };

  const getSpecName = (id: string | null) => {
    if (!id) return "Global";
    return specialties.find((s) => s.id === id)?.name || "—";
  };

  const sourceLabel: Record<string, string> = {
    harrison: "Harrison", manual: "Manual/Protocolo", custom: "Personalizado", guideline: "Diretriz",
  };

  const getChunkCount = (doc: KnowledgeDoc) => {
    if (!doc.chunks || !Array.isArray(doc.chunks)) return 0;
    return doc.chunks.length;
  };

  const statusIcon = (status: string) => {
    if (status === "processing") return <Loader2 className="w-4 h-4 animate-spin text-warning" />;
    if (status === "ready") return <CheckCircle2 className="w-4 h-4 text-primary" />;
    return <AlertCircle className="w-4 h-4 text-destructive" />;
  };

  const totalChunks = docs.reduce((sum, d) => sum + getChunkCount(d), 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Base de Conhecimento</h1>
            <p className="text-muted-foreground text-sm">Documentos médicos com busca vetorial (RAG + pgvector)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto"><Plus className="w-4 h-4" /> Adicionar Documento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Harrison - Insuficiência Cardíaca" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Fonte</Label>
                    <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="harrison">Harrison</SelectItem>
                        <SelectItem value="manual">Manual/Protocolo</SelectItem>
                        <SelectItem value="guideline">Diretriz</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex: Medicina Interna" />
                  </div>
                </div>
                <div>
                  <Label>Especialidade (opcional)</Label>
                  <Select value={form.specialty_id || "global"} onValueChange={(v) => setForm({ ...form, specialty_id: v === "global" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (todas)</SelectItem>
                      {specialties.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Tabs value={uploadTab} onValueChange={setUploadTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="text" className="flex-1 gap-2"><FileText className="w-4 h-4" />Texto</TabsTrigger>
                    <TabsTrigger value="pdf" className="flex-1 gap-2"><Upload className="w-4 h-4" />Upload PDF</TabsTrigger>
                  </TabsList>
                  <TabsContent value="text">
                    <div>
                      <Label>Conteúdo *</Label>
                      <Textarea
                        value={form.content}
                        onChange={(e) => setForm({ ...form, content: e.target.value })}
                        className="min-h-[250px] font-mono text-xs"
                        placeholder="Cole o conteúdo do documento médico aqui..."
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="pdf">
                    <div className="space-y-3">
                      <Label>Arquivo PDF *</Label>
                      <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
                        <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {pdfFile ? pdfFile.name : "Arraste ou clique para selecionar um PDF"}
                        </p>
                        {pdfFile && (
                          <p className="text-xs text-muted-foreground">
                            {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                        <Input
                          type="file"
                          accept=".pdf"
                          className="max-w-xs mx-auto"
                          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O PDF será processado automaticamente: extração de texto → chunking → embeddings vetoriais (OpenAI text-embedding-3-small).
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                <p className="text-xs text-muted-foreground">
                  O conteúdo será dividido em chunks e indexado com embeddings vetoriais para busca semântica (RAG).
                </p>
                <Button
                  onClick={uploadTab === "pdf" ? handleUploadPdf : handleSaveText}
                  className="w-full"
                  disabled={uploading}
                >
                  {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {uploadTab === "pdf" ? "Enviar PDF e Processar" : "Salvar Documento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{docs.length}</p>
            <p className="text-xs text-muted-foreground">Documentos</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalChunks}</p>
            <p className="text-xs text-muted-foreground">Chunks Vetoriais</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{docs.filter(d => d.file_url).length}</p>
            <p className="text-xs text-muted-foreground">PDFs</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{docs.filter(d => d.processing_status === "ready").length}</p>
            <p className="text-xs text-muted-foreground">Indexados</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{new Set(docs.map(d => d.specialty_id).filter(Boolean)).size}</p>
            <p className="text-xs text-muted-foreground">Especialidades</p>
          </CardContent></Card>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Chunks</TableHead>
                  <TableHead className="hidden md:table-cell">Especialidade</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {d.file_url ? <Upload className="w-4 h-4 text-primary flex-shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <span className="truncate max-w-[200px]">{d.title}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{sourceLabel[d.source] || d.source}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        {statusIcon(d.processing_status)}
                        <span className="text-xs">{d.processing_status === "ready" ? "Indexado" : d.processing_status === "processing" ? "Processando" : "Erro"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{getChunkCount(d)}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{getSpecName(d.specialty_id)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.processing_status !== "ready" && (
                          <Button variant="ghost" size="icon" onClick={() => handleReprocess(d.id)} title="Reprocessar">
                            <Loader2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {docs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhum documento na base de conhecimento</p>
                      <p className="text-xs mt-1">Adicione documentos médicos (texto ou PDF) para busca vetorial RAG</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
