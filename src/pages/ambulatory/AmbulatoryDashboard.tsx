import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Stethoscope, Heart, Brain, Eye, Ear, Baby, Wind, Activity, Bone, Scan, CircleDot, Utensils } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Specialty = Tables<"medical_specialties">;

const iconMap: Record<string, any> = {
  Heart, Brain, Eye, Ear, Baby, Wind, Activity, Bone, Scan, CircleDot, Utensils, Stethoscope,
};

export default function AmbulatoryDashboard() {
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("medical_specialties")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setSpecialties(data || []);

      // Get consultation counts per specialty
      const { data: consultations } = await supabase
        .from("consultations")
        .select("specialty_id")
        .not("specialty_id", "is", null);

      const c: Record<string, number> = {};
      consultations?.forEach((con: any) => {
        c[con.specialty_id] = (c[con.specialty_id] || 0) + 1;
      });
      setCounts(c);
    };
    load();
  }, []);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ambulatório</h1>
            <p className="text-muted-foreground text-sm">Selecione a especialidade para iniciar uma consulta</p>
          </div>
          <Button onClick={() => navigate("/ambulatory/new")} className="gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Nova Consulta
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {specialties.map((spec) => {
            const Icon = iconMap[spec.icon || "Stethoscope"] || Stethoscope;
            const count = counts[spec.id] || 0;
            return (
              <Card
                key={spec.id}
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
                onClick={() => navigate(`/ambulatory/new?specialty=${spec.id}`)}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{spec.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{spec.description}</p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {count} {count === 1 ? "consulta" : "consultas"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {specialties.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Stethoscope className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Nenhuma especialidade cadastrada.</p>
              <p className="text-sm mt-1">Peça ao administrador para configurar as especialidades.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
