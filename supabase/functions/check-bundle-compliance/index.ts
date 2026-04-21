import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get event with subtype
    const { data: event, error: evError } = await supabase
      .from("indicator_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (evError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subtype bundle items
    let bundleItems: any[] = [];
    if (event.subtype_id) {
      const { data: subtype } = await supabase
        .from("indicator_subtypes")
        .select("bundle_items")
        .eq("id", event.subtype_id)
        .single();
      if (subtype?.bundle_items) {
        bundleItems = Array.isArray(subtype.bundle_items) ? subtype.bundle_items : [];
      }
    }

    if (bundleItems.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No bundle items to check" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evaluate compliance
    const compliance = event.bundle_compliance || {};
    const failedItems: any[] = [];
    let conforming = 0;

    for (const item of bundleItems) {
      const code = item.code;
      const val = compliance[code];
      if (val === true) {
        conforming++;
      } else {
        failedItems.push({ code, label: item.label, reference: item.reference });
      }
    }

    const score = bundleItems.length > 0
      ? Math.round((conforming / bundleItems.length) * 10000) / 100
      : 100;

    // Update event bundle_score
    await supabase
      .from("indicator_events")
      .update({ bundle_score: score })
      .eq("id", event_id);

    // Create alert if there are failures
    if (failedItems.length > 0) {
      const severity = score < 50 ? "critical" : "warning";
      const message = `Falha de bundle: ${failedItems.length}/${bundleItems.length} itens não conformes (${score}% adesão)`;

      await supabase.from("bundle_alerts").insert({
        event_id: event.id,
        indicator_id: event.indicator_id,
        subtype_id: event.subtype_id,
        patient_id: event.patient_id,
        department_id: event.department_id,
        ward_id: event.ward_id,
        failed_items: failedItems,
        severity,
        message,
      });

      // Notify admins/auditors in the department
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "auditor"]);

      if (managers && managers.length > 0) {
        const notifications = managers.map((m: any) => ({
          user_id: m.user_id,
          type: severity === "critical" ? "error" : "warning",
          title: `Alerta de Bundle: ${severity === "critical" ? "CRÍTICO" : "Atenção"}`,
          message,
          link: "/indicators",
        }));
        await supabase.from("notifications").insert(notifications);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      bundle_score: score,
      failed_count: failedItems.length,
      total_items: bundleItems.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("check-bundle-compliance error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
