import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: indicators, error } = await supabase
      .from("indicators")
      .select("id, name, department_id, auto_source")
      .eq("auto_enabled", true)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching indicators:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!indicators || indicators.length === 0) {
      return new Response(JSON.stringify({ message: "No auto indicators found", collected: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: departments } = await supabase.from("departments").select("id, name");
    const deptMap = new Map((departments || []).map((d: any) => [d.id, d.name]));

    const batchId = crypto.randomUUID();
    const results: any[] = [];
    const logRows: any[] = [];
    const collectUrl = `${supabaseUrl}/functions/v1/collect-indicator-data`;

    for (const ind of indicators) {
      const deptIds = ind.department_id
        ? [ind.department_id]
        : (departments || []).map((d: any) => d.id);

      for (const deptId of deptIds) {
        try {
          const resp = await fetch(collectUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ indicator_id: ind.id, department_id: deptId }),
          });

          const body = await resp.json();
          const isSuccess = resp.ok;

          results.push({
            indicator: ind.name,
            department: deptId,
            status: isSuccess ? "success" : "error",
            detail: isSuccess ? `N=${body.numerator}, D=${body.denominator}, V=${body.calculated_value}` : body.error,
          });

          logRows.push({
            batch_id: batchId,
            indicator_id: ind.id,
            department_id: deptId,
            indicator_name: ind.name,
            department_name: deptMap.get(deptId) || deptId,
            status: isSuccess ? "success" : "error",
            numerator: isSuccess ? body.numerator : null,
            denominator: isSuccess ? body.denominator : null,
            calculated_value: isSuccess ? body.calculated_value : null,
            error_message: isSuccess ? null : (body.error || "Unknown error"),
          });
        } catch (e: any) {
          results.push({ indicator: ind.name, department: deptId, status: "error", detail: e.message });
          logRows.push({
            batch_id: batchId,
            indicator_id: ind.id,
            department_id: deptId,
            indicator_name: ind.name,
            department_name: deptMap.get(deptId) || deptId,
            status: "error",
            error_message: e.message,
          });
        }
      }
    }

    // Persist logs
    if (logRows.length > 0) {
      const { error: logError } = await supabase.from("collection_logs").insert(logRows);
      if (logError) console.error("Failed to persist collection logs:", logError);
    }

    const successCount = results.filter((r) => r.status === "success").length;
    console.log(`Scheduled collection: ${successCount}/${results.length} successful (batch ${batchId})`);

    return new Response(JSON.stringify({
      message: `Collected ${successCount}/${results.length} indicator-department pairs`,
      batch_id: batchId,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("scheduled-collect error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
