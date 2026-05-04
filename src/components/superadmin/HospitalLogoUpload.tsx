import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateHospital } from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  hospital: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export function HospitalLogoUpload({ hospital }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const update = useUpdateHospital();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-upload do mesmo arquivo
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG, SVG ou WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo maior que 2 MB.");
      return;
    }

    setUploading(true);
    try {
      // Path com timestamp pra forçar cache-bust
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${hospital.id}/logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("hospital-logos")
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
        });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("hospital-logos")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await update.mutateAsync({
        id: hospital.id,
        patch: { logo_url: publicUrl },
      });

      toast.success("Logo atualizada");
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao subir logo: ${e?.message ?? e}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!hospital.logo_url) return;
    if (!confirm("Remover a logo atual?")) return;
    try {
      // Extrai o path a partir da URL pública (depois de hospital-logos/)
      const m = /\/hospital-logos\/(.+)$/.exec(hospital.logo_url);
      if (m?.[1]) {
        await supabase.storage.from("hospital-logos").remove([m[1]]);
      }
      await update.mutateAsync({
        id: hospital.id,
        patch: { logo_url: null },
      });
      toast.success("Logo removida");
    } catch (e: any) {
      toast.error(`Falha ao remover: ${e?.message ?? e}`);
    }
  }

  return (
    <Card className="hv-card">
      <CardHeader>
        <CardTitle className="heading-section flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Logo do hospital
        </CardTitle>
        <CardDescription>
          Aparece no PDF de relatórios. PNG ou SVG quadrado fica melhor. Máx 2 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0"
          >
            {hospital.logo_url ? (
              <img
                src={hospital.logo_url}
                alt={`Logo ${hospital.name}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED.join(",")}
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {hospital.logo_url ? "Trocar logo" : "Fazer upload"}
                </>
              )}
            </Button>
            {hospital.logo_url && (
              <Button
                variant="ghost"
                onClick={handleRemove}
                disabled={uploading}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" /> Remover
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
