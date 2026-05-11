import { useTemplates } from "@/hooks/queries";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Enums } from "@/integrations/supabase/types";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  wardType?: Enums<"ward_type">;
  role?: Enums<"app_role">;
  required?: boolean;
}

export function TemplatePicker({ value, onChange, wardType, role, required }: Props) {
  const { data: templates, isLoading } = useTemplates({ wardType, role });

  return (
    <div className="space-y-2">
      <Label>Template do relatório{required && " *"}</Label>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando…" : "Selecione um template"} />
        </SelectTrigger>
        <SelectContent>
          {(templates ?? []).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {templates && templates.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum template aplicável encontrado pra este setor.
        </p>
      )}
    </div>
  );
}
