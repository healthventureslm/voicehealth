import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

interface FilterOpts {
  wardType?: Enums<"ward_type">;
  role?: Enums<"app_role">;
}

/**
 * Templates aplicáveis ao usuário, filtrados por ward_type e/ou role.
 * RLS já restringe a globais (hospital_id NULL) + do hospital do usuário.
 */
export function useTemplates(opts?: FilterOpts) {
  return useQuery({
    queryKey: ["report_templates", opts],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      const all = data ?? [];
      const matches = (t: typeof all[number]) => {
        if (opts?.wardType && t.applicable_ward_types?.length > 0
            && !t.applicable_ward_types.includes(opts.wardType)) return false;
        if (opts?.role && t.applicable_roles?.length > 0
            && !t.applicable_roles.includes(opts.role)) return false;
        return true;
      };
      const filtered = all.filter(matches);
      // Se o filtro estrito apaga tudo, devolve todos os ativos — preferimos
      // mostrar opções a deixar a UI vazia (o filtro é dica, não regra dura)
      return filtered.length > 0 ? filtered : all;
    },
  });
}
