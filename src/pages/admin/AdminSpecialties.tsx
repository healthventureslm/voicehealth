import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hospital, Lock } from "lucide-react";

export default function AdminSpecialties() {
  const { data: specialties, isLoading } = useQuery({
    queryKey: ["medical_specialties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_specialties")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          icon={<Hospital className="w-6 h-6" />}
          title="Especialidades"
          subtitle="Catálogo global de especialidades médicas. Mantido pela Health Ventures."
        />

        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 text-sm flex items-start gap-3">
            <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
            <div>
              Esta lista é gerenciada pelo super-admin Health Ventures e
              compartilhada por todos os hospitais. Para sugerir adição ou
              alteração, contate <code>contato@healthventures.com.br</code>.
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <EmptyState loading />
        ) : (specialties ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma especialidade"
            description="Catálogo global ainda não foi populado."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(specialties ?? []).map((s: any) => (
              <Card key={s.id} className="hv-card">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {s.slug}
                    </div>
                  </div>
                  {s.output_prompt && (
                    <Badge variant="outline" className="text-xs">
                      prompt configurado
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
