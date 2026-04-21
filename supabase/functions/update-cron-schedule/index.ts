import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed cron expressions (whitelist for safety)
const ALLOWED_SCHEDULES: Record<string, string> = {
  "0 0 * * *": "Meia-noite (00:00 UTC)",
  "0 3 * * *": "03:00 UTC",
  "0 6 * * *": "06:00 UTC",
  "0 9 * * *": "09:00 UTC",
  "0 12 * * *": "12:00 UTC",
  "0 15 * * *": "15:00 UTC",
  "0 18 * * *": "18:00 UTC",
  "0 21 * * *": "21:00 UTC",
  "0 */6 * * *": "A cada 6 horas",
  "0 */12 * * *": "A cada 12 horas",
  "0 */8 * * *": "A cada 8 horas",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth - must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { schedule } = await req.json();

    if (!schedule || !ALLOWED_SCHEDULES[schedule]) {
      return new Response(JSON.stringify({ error: "Invalid schedule. Use one of the allowed values." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the cron job via RPC
    const { error: rpcError } = await supabase.rpc("update_cron_schedule", { new_schedule: schedule });

    if (rpcError) {
      console.error("Failed to update cron:", rpcError);
      // Still update the setting even if cron update fails (cron extensions might not be enabled)
    }

    // Update the app_settings record
    const { error: settingsError } = await supabase
      .from("app_settings")
      .update({ value: schedule, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq("key", "cron_schedule");

    if (settingsError) {
      return new Response(JSON.stringify({ error: settingsError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      schedule,
      label: ALLOWED_SCHEDULES[schedule],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("update-cron-schedule error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
