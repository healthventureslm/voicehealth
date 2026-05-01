// Edge function: send-invitation
// Adaptada para o schema v2:
//   - usa hospital_id (não department_id)
//   - aceita ward_ids[]
//   - valida que quem convida é hospital_admin do hospital alvo (ou super_admin)
//
// Recebe: { email, role, hospital_id, ward_ids?: string[] }
// Retorna: { invitation: { id, email, role, token, expires_at, ... } }

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

const ALLOWED_ROLES = new Set(["hospital_admin", "doctor", "nurse", "auditor"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const body = await req.json();
    const email: string = (body.email ?? "").trim().toLowerCase();
    const role: string = body.role;
    const hospital_id: string | undefined = body.hospital_id;
    const ward_ids: string[] = Array.isArray(body.ward_ids) ? body.ward_ids : [];

    if (!email || !role || !hospital_id) {
      return json({ error: "email, role e hospital_id são obrigatórios" }, 400);
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json({ error: `role inválida: ${role}` }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "e-mail inválido" }, 400);
    }

    // Verifica permissão: super_admin OU hospital_admin do hospital alvo
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role, hospital_id")
      .eq("user_id", user.id);

    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");
    const isHospitalAdminHere = (roles ?? []).some(
      (r) => r.role === "hospital_admin" && r.hospital_id === hospital_id,
    );

    if (!isSuperAdmin && !isHospitalAdminHere) {
      return json({ error: "Permissão negada — só admin do hospital pode convidar" }, 403);
    }

    // Valida que cada ward_id pertence ao hospital alvo
    if (ward_ids.length > 0) {
      const { data: wards } = await supabaseAdmin
        .from("wards")
        .select("id")
        .eq("hospital_id", hospital_id)
        .in("id", ward_ids);
      if ((wards?.length ?? 0) !== ward_ids.length) {
        return json({ error: "Algum ward_id não pertence ao hospital" }, 400);
      }
    }

    // Já existe convite pendente?
    const { data: existing } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("email", email)
      .eq("hospital_id", hospital_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return json({ error: "Já existe um convite pendente para este e-mail neste hospital" }, 409);
    }

    // Cria convite (token e expires_at vêm do default da tabela)
    const { data: invitation, error: insertError } = await supabaseAdmin
      .from("invitations")
      .insert({
        email,
        role,
        hospital_id,
        ward_ids,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return json({ error: insertError.message }, 500);
    }

    return json({ invitation });
  } catch (err) {
    console.error("send-invitation error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
