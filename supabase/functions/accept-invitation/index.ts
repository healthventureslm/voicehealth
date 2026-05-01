// Edge function: accept-invitation
// Adaptada para o schema v2:
//   - removida tabela `admin_whitelist` (super_admin é definido via SQL/painel)
//   - usa `hospital_id` em vez de `department_id`
//   - aplica `ward_assignments` (N:N) baseado em `invitations.ward_ids`
//
// Recebe: { invitation_token: string }
// Retorna: { success, role, hospital_id, wards: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado (sem token de sessão)" }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const body = await req.json();
    const { invitation_token } = body;
    if (!invitation_token) return json({ error: "invitation_token é obrigatório" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca o convite
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from("invitations")
      .select("id, hospital_id, email, role, ward_ids, status, expires_at")
      .eq("token", invitation_token)
      .maybeSingle();

    if (fetchError || !invitation) {
      return json({ error: "Convite não encontrado" }, 404);
    }
    if (invitation.status !== "pending") {
      return json({ error: `Convite já está '${invitation.status}'` }, 410);
    }
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return json({ error: "Convite expirado" }, 410);
    }
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return json({ error: "E-mail do convite não bate com o da sua conta" }, 403);
    }

    // 1) Garante profile (caso o trigger não tenha rodado por algum motivo)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: user.id, full_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] },
        { onConflict: "user_id" },
      );

    // 2) Atribui role no hospital
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: user.id,
          hospital_id: invitation.hospital_id,
          role: invitation.role,
        },
        { onConflict: "user_id,hospital_id,role" },
      );

    if (roleError) {
      console.error("Erro ao atribuir role:", roleError);
      return json({ error: "Falha ao atribuir papel: " + roleError.message }, 500);
    }

    // 3) Atribui ward_assignments (se houver)
    const wardIds: string[] = invitation.ward_ids ?? [];
    if (wardIds.length > 0) {
      const inserts = wardIds.map((wid) => ({ user_id: user.id, ward_id: wid }));
      // Limpa atribuições antigas que podem existir e estejam ativas (evita duplicatas)
      const { error: waError } = await supabaseAdmin
        .from("ward_assignments")
        .upsert(inserts, { onConflict: "user_id,ward_id" });
      if (waError) {
        console.error("Erro ao atribuir wards:", waError);
        // Não fatal — role já foi atribuída
      }
    }

    // 4) Marca convite como aceito
    await supabaseAdmin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    return json({
      success: true,
      role: invitation.role,
      hospital_id: invitation.hospital_id,
      wards: wardIds,
    });
  } catch (err) {
    console.error("accept-invitation error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
