import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Specialty = Tables<"medical_specialties">;

export function useSpecialties() {
  return useQuery({
    queryKey: ["specialties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_specialties")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Specialty[];
    },
    staleTime: 10 * 60 * 1000, // rarely changes
  });
}
