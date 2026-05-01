import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  useWards, useSetUserWards, useSetUserRole,
} from "@/hooks/queries";
import type { HospitalUserRow } from "@/hooks/queries";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

interface Props {
  user: HospitalUserRow | null;
  hospitalId: string;
  onClose: () => void;
}

const ROLES: Array<{ value: Enums<"app_role">; label: string }> = [
  { value: "hospital_admin", label: "Administrador do Hospital" },
  { value: "doctor",         label: "Médico(a)" },
  { value: "nurse",          label: "Enfermeiro(a)" },
  { value: "auditor",        label: "Auditor(a)" },
];

export function EditUserDialog({ user, hospitalId, onClose }: Props) {
  const { data: wards } = useWards();
  const setWards = useSetUserWards();
  const setRole = useSetUserRole();

  const [selectedWards, setSelectedWards] = useState<Set<string>>(new Set());
  const [role, setRoleState] = useState<Enums<"app_role">>("nurse");

  const hospitalWards = (wards ?? []).filter((w) => w.hospital_id === hospitalId);
  const initialRole = user?.roles[0] ?? "nurse";

  useEffect(() => {
    if (user) {
      setSelectedWards(new Set(user.ward_ids));
      setRoleState(user.roles[0] ?? "nurse");
    }
  }, [user]);

  if (!user) return null;

  function toggleWard(wardId: string) {
    setSelectedWards((prev) => {
      const next = new Set(prev);
      if (next.has(wardId)) next.delete(wardId);
      else next.add(wardId);
      return next;
    });
  }

  async function handleSave() {
    if (!user) return;
    try {
      // Atualiza role se mudou
      if (role !== initialRole) {
        await setRole.mutateAsync({
          userId: user.user_id,
          hospitalId,
          newRole: role,
          oldRole: initialRole,
        });
      }
      // Atualiza wards
      await setWards.mutateAsync({
        userId: user.user_id,
        wardIds: Array.from(selectedWards),
      });
      toast.success("Usuário atualizado");
      onClose();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? e}`);
    }
  }

  const showWards = role === "doctor" || role === "nurse";

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {user.full_name ?? "usuário"}</DialogTitle>
          <DialogDescription>
            Mude o papel e os setores onde este usuário atua. Mudanças entram em vigor
            no próximo login (ou refresh) dele.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Papel</Label>
            <Select
              value={role}
              onValueChange={(v) => setRoleState(v as Enums<"app_role">)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showWards && (
            <div>
              <Label className="mb-2 block">Setores</Label>
              <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto">
                {hospitalWards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum setor cadastrado.
                  </p>
                ) : (
                  hospitalWards.map((w) => (
                    <div key={w.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`ed-ward-${w.id}`}
                        checked={selectedWards.has(w.id)}
                        onCheckedChange={() => toggleWard(w.id)}
                      />
                      <Label htmlFor={`ed-ward-${w.id}`} className="cursor-pointer text-sm font-normal">
                        {w.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={setWards.isPending || setRole.isPending}>
            {(setWards.isPending || setRole.isPending) ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
