import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Mic } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Department = Tables<"departments">;

export default function SelectDepartment() {
  const { user, refreshProfile, signOut } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    supabase.from("departments").select("*").order("name").then(({ data, error }) => {
      if (error) toast.error("Erro ao carregar departamentos");
      setDepartments(data || []);
      setLoading(false);
    });
  }, []);

  const selectDepartment = async (deptId: string) => {
    if (!user) return;
    setSelecting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ department_id: deptId })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao selecionar departamento");
      setSelecting(false);
      return;
    }
    await refreshProfile();
    setSelecting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Selecione seu Departamento</h1>
          <p className="text-muted-foreground">Escolha o departamento onde você atua</p>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Carregando...</div>
        ) : departments.length === 0 ? (
          <Card className="text-center p-8">
            <CardContent>
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Nenhum departamento cadastrado.</p>
              <p className="text-sm text-muted-foreground">Peça ao administrador para criar departamentos.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map((dept) => (
              <Card key={dept.id} className="cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    {dept.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{dept.description || "Sem descrição"}</p>
                  <Button
                    onClick={() => selectDepartment(dept.id)}
                    disabled={selecting}
                    className="w-full"
                  >
                    Selecionar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
