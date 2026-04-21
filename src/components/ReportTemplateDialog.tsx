import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Search, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Tables } from "@/integrations/supabase/types";

type ReportTemplate = Tables<"report_templates">;

interface ReportTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (templateIds: string[]) => void;
  isSubmitting?: boolean;
  selectedRecordingsCount?: number;
}

export function ReportTemplateDialog({ open, onClose, onSubmit, isSubmitting, selectedRecordingsCount }: ReportTemplateDialogProps) {
  const { roles, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewTemplate = useMemo(
    () => templates.find((t) => t.id === previewId),
    [templates, previewId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setSearch("");
    setPreviewId(null);
    setLoading(true);
    supabase
      .from("report_templates")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const all = data || [];
        const byRole = isAdmin ? all : all.filter((t) => {
          const appRoles = (t.applicable_roles as string[]) || [];
          if (appRoles.length === 0) return true;
          return roles.some((r) => appRoles.includes(r));
        });
        setTemplates(byRole);
        setLoading(false);
      });
  }, [open, roles]);

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Check serial validation for selected templates
  const serialWarning = useMemo(() => {
    if (!selectedRecordingsCount || selectedRecordingsCount < 1) return null;
    for (const id of selectedIds) {
      const t = templates.find((tpl) => tpl.id === id);
      if (t && (t as any).requires_serial && selectedRecordingsCount < ((t as any).min_recordings || 2)) {
        return `O template "${t.name}" requer pelo menos ${(t as any).min_recordings || 2} gravações seriadas. Você selecionou ${selectedRecordingsCount}.`;
      }
    }
    return null;
  }, [selectedIds, templates, selectedRecordingsCount]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecione os Tipos de Relatório</DialogTitle>
          <DialogDescription>
            Escolha um ou mais templates para gerar relatórios a partir da transcrição
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum template disponível para o seu perfil.
          </p>
        ) : (
          <>
            {templates.length > 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar template..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum template encontrado para "{search}"
                </p>
              ) : (
                filtered.map((t) => {
                  const isSelected = selectedIds.includes(t.id);
                  const isSerial = (t as any).requires_serial;
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTemplate(t.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleTemplate(t.id)}
                          className="mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{t.name}</p>
                            {isSerial && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
                                Seriado ({(t as any).min_recordings || 2}+)
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewId(previewId === t.id ? null : t.id);
                          }}
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          {previewId === t.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {previewTemplate && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Prompt: {previewTemplate.name}</p>
            <ScrollArea className="max-h-[200px] rounded-md border bg-muted/30 p-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {previewTemplate.prompt_template}
              </pre>
            </ScrollArea>
          </div>
        )}

        {serialWarning && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{serialWarning}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => selectedIds.length > 0 && !serialWarning && onSubmit(selectedIds)}
            disabled={selectedIds.length === 0 || isSubmitting || !!serialWarning}
            className="gap-2"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting
              ? "Processando..."
              : selectedIds.length === 0
                ? "Selecione template(s)"
                : `Enviar (${selectedIds.length} selecionado${selectedIds.length > 1 ? "s" : ""})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
