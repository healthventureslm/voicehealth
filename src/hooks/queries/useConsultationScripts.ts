import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import type { ScriptField } from "@/hooks/useScriptMatching";

interface FilterOpts {
  wardType?: Enums<"ward_type">;
  /** Quando informado, prioriza scripts com mesmo nome (pareamento 1:1 com template). */
  templateName?: string;
}

export interface ConsultationScript {
  id: string;
  name: string;
  description: string | null;
  fields: ScriptField[];
  applicable_ward_types: Enums<"ward_type">[];
}

function parseFields(raw: unknown): ScriptField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? ""),
      label: String(f.label ?? ""),
      required: Boolean(f.required),
      keywords: Array.isArray(f.keywords) ? f.keywords.map(String) : [],
    }))
    .filter((f) => f.id && f.label);
}

/**
 * Scripts (roteiros) ativos. Quando wardType é informado, prioriza scripts
 * aplicáveis àquele setor; se nenhum específico bater, devolve scripts gerais
 * (sem applicable_ward_types definido).
 */
export function useConsultationScripts(opts?: FilterOpts) {
  return useQuery({
    queryKey: ["consultation_scripts", opts],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_scripts")
        .select("id, name, description, fields, applicable_ward_types")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const all: ConsultationScript[] = (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        fields: parseFields(row.fields),
        applicable_ward_types: row.applicable_ward_types ?? [],
      }));

      // 1) Match exato por nome (pareamento 1:1 com report_template)
      if (opts?.templateName) {
        const byName = all.filter((s) => s.name === opts.templateName);
        if (byName.length > 0) return byName;
      }

      // 2) Sem ward type → devolve tudo
      if (!opts?.wardType) return all;

      // 3) Filtra por ward type, com fallback pra scripts gerais
      const matching = all.filter((s) =>
        s.applicable_ward_types.includes(opts.wardType!),
      );
      if (matching.length > 0) return matching;
      return all.filter((s) => s.applicable_ward_types.length === 0);
    },
  });
}
