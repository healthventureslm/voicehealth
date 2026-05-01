import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function Profile() {
  const { user, profile, roles, signOut } = useAuth();

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Meu perfil</h1>

        <Card>
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nome: </span>
              <span className="font-medium">{profile?.full_name || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">E-mail: </span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Função profissional: </span>
              <span className="font-medium">{profile?.professional_role || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Papéis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {roles.length === 0 ? (
              <p className="text-muted-foreground">Nenhum papel atribuído.</p>
            ) : (
              roles.map((r, i) => (
                <div key={i}>
                  <span className="font-medium">{r.role}</span>
                  {r.hospital_id && (
                    <span className="text-muted-foreground"> · hospital {r.hospital_id.slice(0, 8)}</span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Button variant="outline" onClick={signOut}>
          Sair
        </Button>
      </div>
    </AppLayout>
  );
}
