import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wards visíveis ao usuário (filtradas via RLS por hospital).
 */
export function useWards() {
  return useQuery({
    queryKey: ["wards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wards")
        .select("id, name, ward_type, hospital_id, bed_count, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Apenas as wards onde o usuário está atribuído (ward_assignments active).
 * Usado pra restringir o ward que pode ser selecionado em forms de criação.
 */
export function useMyWards(userId: string | undefined) {
  return useQuery({
    queryKey: ["my_wards", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ward_assignments")
        .select("ward:wards(id, name, ward_type, hospital_id, bed_count, is_active)")
        .eq("user_id", userId!)
        .is("ended_at", null);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.ward)
        .filter((w: any) => w && w.is_active);
    },
  });
}
