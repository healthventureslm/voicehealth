// Passo de importar documento: upload + chamada à edge function
// template-schema-from-document. Recebe o schema extraído e devolve
// pro parent via onExtracted.

import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TemplateSchema } from "@/templates/types";

interface ImportDocumentStepProps {
  onExtracted: (schema: TemplateSchema) => void;
  onBack: () => void;
}

export function ImportDocumentStep({ onExtracted, onBack }: ImportDocumentStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = useCallback((f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Arquivo muito grande (limite 10 MB)");
      return;
    }
    const okTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(f.type)) {
      setError("Tipo de arquivo não suportado. Use PDF, PNG, JPEG ou WebP.");
      return;
    }
    setFile(f);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  async function handleProcess() {
    if (!file) return;
    setError(null);
    setIsProcessing(true);
    try {
      // Lê arquivo como base64
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);

      const { data, error: fnErr } = await supabase.functions.invoke(
        "template-schema-from-document",
        {
          body: {
            file_base64: base64,
            mime_type: file.type,
            hint: hint.trim() || undefined,
          },
        },
      );

      if (fnErr) throw fnErr;
      if (!data?.success || !data?.schema) {
        throw new Error(data?.error ?? "IA não retornou schema válido");
      }
      onExtracted(data.schema as TemplateSchema);
      toast.success("Template extraído. Revise abaixo.");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      toast.error(`Falha na extração: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Importar documento</h2>
        <p className="text-sm text-muted-foreground">
          Suba a foto ou PDF do formulário. A IA vai analisar e propor um template
          estruturado pra você revisar.
        </p>
      </div>

      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? "border-enf bg-enf/5" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <label className="block p-8 cursor-pointer text-center">
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            disabled={isProcessing}
          />
          {file ? (
            <div className="space-y-2">
              <FileText className="w-10 h-10 mx-auto text-enf" />
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · {file.type}
              </p>
              <p className="text-xs text-enf">Clique pra trocar</p>
            </div>
          ) : (
            <div className="space-y-2 text-muted-foreground">
              <Upload className="w-10 h-10 mx-auto" />
              <p className="font-medium text-foreground">
                Solte o arquivo aqui ou clique pra escolher
              </p>
              <p className="text-xs">PDF, PNG, JPEG ou WebP (até 10 MB)</p>
            </div>
          )}
        </label>
      </Card>

      <div className="space-y-1.5">
        <Label htmlFor="hint" className="text-sm">
          Dica sobre o documento (opcional)
        </Label>
        <Input
          id="hint"
          placeholder="ex: Evolução de enfermagem em UTI no padrão Rede D'Or"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          disabled={isProcessing}
        />
        <p className="text-xs text-muted-foreground">
          Ajuda a IA a entender o contexto se o documento não tiver título claro.
        </p>
      </div>

      {error && (
        <div className="flex gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isProcessing}>
          Voltar
        </Button>
        <Button
          onClick={handleProcess}
          disabled={!file || isProcessing}
          className="gap-2 bg-enf hover:bg-enf-hover text-white"
        >
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
          {isProcessing ? "IA analisando..." : "Extrair template"}
        </Button>
      </div>

      {isProcessing && (
        <div className="text-xs text-center text-muted-foreground italic">
          Pode levar 20–40 segundos. A IA está identificando seções, campos, escalas e checkboxes.
        </div>
      )}
    </div>
  );
}
