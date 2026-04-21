import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = user.id;
    const userEmail = user.email;

    const body = await req.json();
    const { invitation_token, admin_whitelist } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Admin whitelist mode ---
    if (admin_whitelist && !invitation_token) {
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "E-mail não encontrado" }), { status: 400, headers: corsHeaders });
      }

      const { data: whitelistEntry } = await supabaseAdmin
        .from("admin_whitelist")
        .select("id")
        .eq("email", userEmail.toLowerCase())
        .maybeSingle();

      if (!whitelistEntry) {
        return new Response(JSON.stringify({ error: "E-mail não autorizado" }), { status: 403, headers: corsHeaders });
      }

      // Assign admin role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

      if (roleError) {
        console.error("Role assignment error:", roleError);
      }

      return new Response(JSON.stringify({ success: true, role: "admin" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Invitation token mode ---
    if (!invitation_token) {
      return new Response(JSON.stringify({ error: "invitation_token is required" }), { status: 400, headers: corsHeaders });
    }

    // Fetch invitation
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", invitation_token)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchError || !invitation) {
      return new Response(JSON.stringify({ error: "Convite não encontrado ou já utilizado" }), { status: 404, headers: corsHeaders });
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return new Response(JSON.stringify({ error: "Convite expirado" }), { status: 410, headers: corsHeaders });
    }

    // Check email matches
    if (invitation.email.toLowerCase() !== userEmail?.toLowerCase()) {
      return new Response(JSON.stringify({ error: "E-mail não corresponde ao convite" }), { status: 403, headers: corsHeaders });
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: invitation.role }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    // Update profile department
    if (invitation.department_id) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ department_id: invitation.department_id })
        .eq("user_id", userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }
    }

    // Mark invitation as accepted
    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return new Response(JSON.stringify({ success: true, role: invitation.role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
