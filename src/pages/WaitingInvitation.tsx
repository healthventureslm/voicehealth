import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Mail, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function WaitingInvitation() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Acesso pendente</h1>
          <p className="text-muted-foreground">
            Sua conta está autenticada, mas ainda não foi vinculada a nenhum hospital.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex gap-3">
              <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <div className="space-y-1">
                <p className="font-medium">Aguardando convite</p>
                <p className="text-sm text-muted-foreground">
                  Solicite ao administrador do seu hospital que envie um convite para o e-mail:
                </p>
                <code className="block px-2 py-1 bg-muted rounded text-sm break-all">
                  {user?.email}
                </code>
              </div>
            </div>

            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <div className="space-y-1">
                <p className="font-medium">Após receber o link</p>
                <p className="text-sm text-muted-foreground">
                  O convite vai chegar por e-mail com um link único. Ao clicar, sua conta será
                  automaticamente vinculada ao hospital, setor e papel corretos.
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
