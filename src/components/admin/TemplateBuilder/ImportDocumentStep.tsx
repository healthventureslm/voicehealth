// Passo de importar documento: upload ou foto via câmera. Componente "dumb"
// controlado — o pai (StructureTab) é dono do estado de files/hint/processing
// e dispara a extração via prop. Sem botões internos; o avanço acontece pelo
// botão "Continuar" do rodapé do wizard.

import { useCallback, useState } from "react";
import { Upload, FileText, AlertCircle, Camera, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CameraCaptureDialog } from "@/components/CameraCaptureDialog";

const OK_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_PER_FILE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL = 20 * 1024 * 1024; // 20 MB

interface ImportDocumentStepProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  hint: string;
  onHintChange: (hint: string) => void;
  disabled?: boolean;
  /** Erro externo (ex: vindo do fetch da edge function). */
  externalError?: string | null;
}

export function ImportDocumentStep({
  files,
  onFilesChange,
  hint,
  onHintChange,
  disabled = false,
  externalError = null,
}: ImportDocumentStepProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const error = externalError ?? localError;

  const addFiles = useCallback(
    (incoming: File[]) => {
      setLocalError(null);
      if (incoming.length === 0) return;
      const accepted: File[] = [];
      const rejected: string[] = [];
      for (const f of incoming) {
        if (f.size > MAX_PER_FILE) {
          rejected.push(`${f.name} (>10MB)`);
          continue;
        }
        if (!OK_TYPES.includes(f.type)) {
          rejected.push(`${f.name} (tipo não suportado)`);
          continue;
        }
        accepted.push(f);
      }
      const merged = [...files, ...accepted];
      const total = merged.reduce((acc, f) => acc + f.size, 0);
      if (total > MAX_TOTAL) {
        setLocalError("Arquivos somam mais que 20 MB. Remova algum antes de continuar.");
      }
      onFilesChange(merged);
      if (rejected.length > 0) {
        setLocalError(`Alguns arquivos foram ignorados: ${rejected.join(", ")}`);
      }
    },
    [files, onFilesChange],
  );

  function removeFile(idx: number) {
    setLocalError(null);
    onFilesChange(files.filter((_, i) => i !== idx));
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Importar documento ou tirar foto</h2>
        <p className="text-sm text-muted-foreground">
          Suba um ou mais arquivos (PDFs ou fotos), ou tire fotos na hora. A IA vai
          consolidar tudo num único template estruturado pra você revisar.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
          <label className="block p-5 cursor-pointer text-center h-full">
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              multiple
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
              disabled={disabled}
            />
            <div className="space-y-2 text-muted-foreground">
              <Upload className="w-8 h-8 mx-auto" />
              <p className="font-medium text-sm text-foreground">Subir arquivos</p>
              <p className="text-xs">PDF, PNG, JPEG ou WebP (até 10 MB cada)</p>
              <p className="text-xs text-enf">Clique ou solte vários aqui</p>
            </div>
          </label>
        </Card>

        <Card className="border-2 border-dashed border-border">
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            disabled={disabled}
            className="w-full p-5 text-center h-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="space-y-2 text-muted-foreground">
              <Camera className="w-8 h-8 mx-auto" />
              <p className="font-medium text-sm text-foreground">Tirar foto agora</p>
              <p className="text-xs">Pode tirar várias seguidas</p>
            </div>
          </button>
        </Card>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">
              {files.length} {files.length === 1 ? "arquivo" : "arquivos"} selecionado
              {files.length === 1 ? "" : "s"}
              <span className="text-xs text-muted-foreground ml-2">
                ({(totalSize / 1024).toFixed(1)} KB)
              </span>
            </Label>
            <button
              type="button"
              onClick={() => onFilesChange([])}
              className="text-xs text-muted-foreground hover:text-destructive"
              disabled={disabled}
            >
              Limpar todos
            </button>
          </div>
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-3 py-2"
              >
                <FileText className="w-4 h-4 text-enf shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  disabled={disabled}
                  aria-label={`Remover ${f.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="hint" className="text-sm">
          Dica sobre o documento (opcional)
        </Label>
        <Input
          id="hint"
          placeholder="ex: Evolução de enfermagem em UTI no padrão Rede D'Or"
          value={hint}
          onChange={(e) => onHintChange(e.target.value)}
          disabled={disabled}
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

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(captured) => {
          addFiles([captured]);
          setCameraOpen(false);
        }}
      />
    </div>
  );
}
