import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indicator_value_id } = await req.json();
    if (!indicator_value_id) {
      return new Response(JSON.stringify({ error: "Missing indicator_value_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the indicator value with its indicator
    const { data: iv, error: ivError } = await supabase
      .from("indicator_values")
      .select("*, indicators(*)")
      .eq("id", indicator_value_id)
      .single();

    if (ivError || !iv) throw new Error("Indicator value not found");

    const indicator = iv.indicators;
    if (!indicator?.target_value) {
      return new Response(JSON.stringify({ message: "No target configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const value = iv.calculated_value ?? 0;
    const target = indicator.target_value;
    const warning = indicator.warning_threshold;
    const critical = indicator.critical_threshold;

    let severity = "green";
    if (critical != null && value <= critical) severity = "red";
    else if (warning != null && value <= warning) severity = "yellow";

    // Only notify on warning or critical
    if (severity === "green") {
      return new Response(JSON.stringify({ message: "Within target" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users in the department to notify
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("department_id", iv.department_id);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ message: "No users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = severity === "red"
      ? `⚠️ CRÍTICO: ${indicator.name}`
      : `⚡ Atenção: ${indicator.name}`;

    const message = `Valor atual: ${value.toFixed(1)}${indicator.unit} (Meta: ${target}${indicator.unit})`;

    // Insert notifications for all department users
    const notifications = profiles.map((p: any) => ({
      user_id: p.user_id,
      type: severity === "red" ? "critical" : "warning",
      title,
      message,
      link: "/indicators",
    }));

    await supabase.from("notifications").insert(notifications);

    // Also create indicator_alert record
    await supabase.from("indicator_alerts").insert({
      indicator_id: indicator.id,
      indicator_value_id: iv.id,
      department_id: iv.department_id,
      severity,
      message: `${indicator.name}: ${value.toFixed(1)}${indicator.unit} (meta: ${target}${indicator.unit})`,
      current_value: value,
      target_value: target,
    });

    return new Response(JSON.stringify({ success: true, severity, notified: profiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("check-indicator-alert error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
