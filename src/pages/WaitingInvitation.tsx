import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthHero } from "@/components/auth/AuthHero";

export default function WaitingInvitation() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <AuthHero subtitle="Sua conta está autenticada, mas ainda não foi vinculada a um hospital." />

        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex gap-3">
              <Mail className="w-5 h-5 flex-shrink-0 mt-1 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Aguardando convite</p>
                <p className="text-sm text-muted-foreground">
                  Solicite ao administrador do seu hospital que envie um convite para:
                </p>
                <code className="block px-2 py-1 bg-muted rounded text-sm break-all font-mono">
                  {user?.email}
                </code>
              </div>
            </div>

            <div className="flex gap-3">
              <Clock className="w-5 h-5 flex-shrink-0 mt-1 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Após receber o link</p>
                <p className="text-sm text-muted-foreground">
                  O convite chega com um link único. Ao clicar, sua conta é vinculada
                  automaticamente ao hospital, setor e papel corretos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
            Sair e entrar com outra conta
          </Button>
        </div>
      </div>
    </div>
  );
}
