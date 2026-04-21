import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE_TABLES: Record<string, { table: string; dateColumn: string; deptColumn: string | null }> = {
  consultations: { table: "consultations", dateColumn: "created_at", deptColumn: "department_id" },
  patients: { table: "patients", dateColumn: "created_at", deptColumn: "department_id" },
  infections: { table: "infection_surveillance", dateColumn: "onset_date", deptColumn: "department_id" },
  ipsg_audits: { table: "ipsg_audit_records", dateColumn: "audit_date", deptColumn: "department_id" },
  ipsg_events: { table: "ipsg_events", dateColumn: "created_at", deptColumn: "department_id" },
  surgical_checklists: { table: "surgical_checklists", dateColumn: "created_at", deptColumn: "department_id" },
  clinical_reports: { table: "clinical_reports", dateColumn: "created_at", deptColumn: null },
  indicator_events: { table: "indicator_events", dateColumn: "event_date", deptColumn: "department_id" },
  bundle_alerts: { table: "bundle_alerts", dateColumn: "created_at", deptColumn: "department_id" },
  indicator_subtypes: { table: "indicator_subtypes", dateColumn: "created_at", deptColumn: null },
  indicator_alerts: { table: "indicator_alerts", dateColumn: "created_at", deptColumn: "department_id" },
  clinical_protocols: { table: "clinical_protocols", dateColumn: "created_at", deptColumn: "department_id" },
  high_alert_medications: { table: "high_alert_medications", dateColumn: "created_at", deptColumn: "department_id" },
  ipsg_action_plans: { table: "ipsg_action_plans", dateColumn: "created_at", deptColumn: "department_id" },
  wards: { table: "wards", dateColumn: "created_at", deptColumn: "department_id" },
};

// Allowed columns for aggregation (security whitelist)
const ALLOWED_AGG_COLUMNS = new Set([
  "bundle_score", "conformity_rate", "conforming_items", "total_items",
  "current_value", "target_value", "numerator_value", "denominator_value",
  "calculated_value", "bed_count",
]);

async function queryWithFilters(
  supabase: any,
  source: string,
  filters: Record<string, any>,
  departmentId: string,
  periodStart: string,
  periodEnd: string,
  operation: string,
  aggColumn?: string,
): Promise<number> {
  const config = SOURCE_TABLES[source];
  if (!config) return 0;

  // For count operations, use head+count
  if (operation === "count") {
    let query = supabase.from(config.table).select("id", { count: "exact", head: true });
    if (config.deptColumn) query = query.eq(config.deptColumn, departmentId);
    if (config.dateColumn) query = query.gte(config.dateColumn, periodStart).lte(config.dateColumn, periodEnd);
    if (filters && typeof filters === "object") {
      for (const [key, value] of Object.entries(filters)) {
        if (typeof key === "string" && /^[a-z_]+$/.test(key) && value !== undefined && value !== null && value !== "") {
          if (value === "true") query = query.eq(key, true);
          else if (value === "false") query = query.eq(key, false);
          else query = query.eq(key, value);
        }
      }
    }
    const { count, error } = await query;
    if (error) { console.error(`Count error for ${source}:`, error); return 0; }
    return count || 0;
  }

  // For sum, avg, count_distinct — fetch data and compute client-side
  const selectCol = (operation === "count_distinct" || !aggColumn) ? "id" : aggColumn;
  if (aggColumn && !ALLOWED_AGG_COLUMNS.has(aggColumn)) {
    console.error(`Blocked agg column: ${aggColumn}`);
    return 0;
  }

  let query = supabase.from(config.table).select(selectCol);
  if (config.deptColumn) query = query.eq(config.deptColumn, departmentId);
  if (config.dateColumn) query = query.gte(config.dateColumn, periodStart).lte(config.dateColumn, periodEnd);
  if (filters && typeof filters === "object") {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof key === "string" && /^[a-z_]+$/.test(key) && value !== undefined && value !== null && value !== "") {
        if (value === "true") query = query.eq(key, true);
        else if (value === "false") query = query.eq(key, false);
        else query = query.eq(key, value);
      }
    }
  }

  const { data, error } = await query;
  if (error) { console.error(`Query error for ${source}:`, error); return 0; }
  if (!data || data.length === 0) return 0;

  if (operation === "count_distinct") {
    const unique = new Set(data.map((r: any) => r[selectCol]));
    return unique.size;
  }

  const values = data.map((r: any) => Number(r[selectCol])).filter((v: number) => !isNaN(v));
  if (values.length === 0) return 0;

  if (operation === "sum") {
    return Math.round(values.reduce((a: number, b: number) => a + b, 0) * 100) / 100;
  }
  if (operation === "avg") {
    return Math.round((values.reduce((a: number, b: number) => a + b, 0) / values.length) * 100) / 100;
  }

  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indicator_id, department_id, period_start, period_end } = await req.json();

    if (!indicator_id || !department_id) {
      return new Response(JSON.stringify({ error: "Missing indicator_id or department_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: indicator, error: indError } = await supabase
      .from("indicators")
      .select("*")
      .eq("id", indicator_id)
      .single();

    if (indError || !indicator) {
      return new Response(JSON.stringify({ error: "Indicator not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!indicator.auto_enabled || !indicator.auto_source) {
      return new Response(JSON.stringify({ error: "Auto collection not enabled" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const pStart = period_start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const pEnd = period_end || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const operation = indicator.auto_operation || "count";
    const aggColumn = indicator.auto_agg_column || undefined;

    // Numerator
    const numerator = await queryWithFilters(
      supabase, indicator.auto_source, indicator.auto_numerator_filter || {},
      department_id, pStart, pEnd, operation, aggColumn
    );

    // Denominator
    let denominator = 0;
    if (indicator.calc_type !== "absolute") {
      const denomSource = indicator.auto_denominator_filter?.source || indicator.auto_source;
      const denomFilters = { ...(indicator.auto_denominator_filter || {}) };
      delete denomFilters.source;
      denominator = await queryWithFilters(
        supabase, denomSource, denomFilters,
        department_id, pStart, pEnd, operation, aggColumn
      );
    }

    // Calculate
    let calculated = numerator;
    if (indicator.calc_type === "percentage" && denominator > 0) {
      calculated = Math.round((numerator / denominator) * 10000) / 100;
    } else if (indicator.calc_type === "average" && denominator > 0) {
      calculated = Math.round((numerator / denominator) * 100) / 100;
    }

    // Upsert value
    const { data: inserted, error: insertError } = await supabase
      .from("indicator_values")
      .insert({
        indicator_id,
        department_id,
        period_start: pStart,
        period_end: pEnd,
        numerator_value: numerator,
        denominator_value: denominator,
        calculated_value: calculated,
        source: "auto",
        notes: `Coleta automática: ${operation}(${indicator.auto_source})`,
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check alerts
    if (inserted) {
      try {
        const alertUrl = `${supabaseUrl}/functions/v1/check-indicator-alert`;
        await fetch(alertUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ indicator_value_id: inserted.id }),
        });
      } catch (e: any) {
        console.error("Alert check failed:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      numerator,
      denominator,
      calculated_value: calculated,
      operation,
      period: { start: pStart, end: pEnd },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("collect-indicator-data error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
