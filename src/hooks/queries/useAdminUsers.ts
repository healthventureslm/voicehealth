import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export interface HospitalUserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  professional_role: string | null;
  roles: Enums<"app_role">[];
  ward_ids: string[];
}

/**
 * Lista usuários do hospital — junta profile + user_roles + ward_assignments.
 * Filtra por hospital_id (admin do hospital só vê seu hospital).
 */
export function useHospitalUsers(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["hospital_users", hospitalId],
    enabled: !!hospitalId,
    queryFn: async (): Promise<HospitalUserRow[]> => {
      // 1) Quais user_ids têm role neste hospital?
      const { data: roleRows, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("hospital_id", hospitalId!);
      if (rolesErr) throw rolesErr;

      const userIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
      if (userIds.length === 0) return [];

      // 2) Profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, professional_role")
        .in("user_id", userIds);

      // 3) Wards (apenas active assignments)
      const { data: wards } = await supabase
        .from("ward_assignments")
        .select("user_id, ward_id")
        .in("user_id", userIds)
        .is("ended_at", null);

      // 4) Auth users para email — service_role only, então precisamos de outra rota.
      // Como cliente, não conseguimos ler auth.users diretamente.
      // Por enquanto, deixamos email em null; se admin precisar, implementamos via edge function.
      // Se o profile tiver e-mail em metadata, dá pra usar — mas no nosso schema profiles não tem email.

      const rolesByUser = new Map<string, Enums<"app_role">[]>();
      (roleRows ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as Enums<"app_role">);
        rolesByUser.set(r.user_id, arr);
      });

      const wardsByUser = new Map<string, string[]>();
      (wards ?? []).forEach((w) => {
        const arr = wardsByUser.get(w.user_id) ?? [];
        arr.push(w.ward_id);
        wardsByUser.set(w.user_id, arr);
      });

      const profilesByUser = new Map(
        (profiles ?? []).map((p) => [p.user_id, p]),
      );

      return userIds.map((id) => {
        const p = profilesByUser.get(id);
        return {
          user_id: id,
          full_name: p?.full_name ?? null,
          email: null, // sem acesso direto a auth.users no cliente
          professional_role: p?.professional_role ?? null,
          roles: rolesByUser.get(id) ?? [],
          ward_ids: wardsByUser.get(id) ?? [],
        };
      });
    },
  });
}

// ─── Atualizar atribuições de ward de um usuário ─────────────────────
export function useSetUserWards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, wardIds }: { userId: string; wardIds: string[] }) => {
      // Estratégia: encerra assignments ativos NÃO listados, e abre os que faltam.
      const { data: active } = await supabase
        .from("ward_assignments")
        .select("id, ward_id")
        .eq("user_id", userId)
        .is("ended_at", null);

      const activeMap = new Map((active ?? []).map((a) => [a.ward_id, a.id]));
      const desired = new Set(wardIds);

      const toEnd = (active ?? []).filter((a) => !desired.has(a.ward_id));
      const toAdd = wardIds.filter((wid) => !activeMap.has(wid));

      if (toEnd.length > 0) {
        const { error } = await supabase
          .from("ward_assignments")
          .update({ ended_at: new Date().toISOString() })
          .in("id", toEnd.map((a) => a.id));
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("ward_assignments")
          .insert(toAdd.map((wid) => ({ user_id: userId, ward_id: wid })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital_users"] });
    },
  });
}

// ─── Atualizar role de um usuário num hospital ───────────────────────
export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId, hospitalId, newRole, oldRole,
    }: {
      userId: string;
      hospitalId: string;
      newRole: Enums<"app_role">;
      oldRole?: Enums<"app_role">;
    }) => {
      // Remove role antiga (se especificada)
      if (oldRole && oldRole !== newRole) {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("hospital_id", hospitalId)
          .eq("role", oldRole);
      }

      // Insere a nova
      const { error } = await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, hospital_id: hospitalId, role: newRole },
          { onConflict: "user_id,hospital_id,role" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital_users"] });
    },
  });
}

// ─── Remover usuário do hospital (apaga roles + encerra wards) ──────
export function useRemoveUserFromHospital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, hospitalId }: { userId: string; hospitalId: string }) => {
      // Apaga todas as roles do user no hospital
      const { error: rerr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("hospital_id", hospitalId);
      if (rerr) throw rerr;

      // Encerra todos os ward_assignments ativos do user nas wards desse hospital
      const { data: hospitalWards } = await supabase
        .from("wards")
        .select("id")
        .eq("hospital_id", hospitalId);
      const wardIds = (hospitalWards ?? []).map((w) => w.id);

      if (wardIds.length > 0) {
        await supabase
          .from("ward_assignments")
          .update({ ended_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("ended_at", null)
          .in("ward_id", wardIds);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital_users"] });
    },
  });
}

// ─── Convites ────────────────────────────────────────────────────────
export function useInvitations(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["invitations", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("hospital_id", hospitalId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email, role, hospitalId, wardIds,
    }: {
      email: string;
      role: Enums<"app_role">;
      hospitalId: string;
      wardIds: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("send-invitation", {
        body: { email, role, hospital_id: hospitalId, ward_ids: wardIds },
      });
      if (error || data?.error) {
        throw new Error(data?.error ?? error?.message ?? "Falha desconhecida");
      }
      return data.invitation as {
        id: string;
        token: string;
        email: string;
        role: Enums<"app_role">;
        ward_ids: string[];
        expires_at: string;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", invitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}
