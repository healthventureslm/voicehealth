import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center gap-4">
            <Construction className="w-12 h-12 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">
              {description ??
                "Esta tela está sendo refeita para a nova arquitetura. Disponível na próxima fase."}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
