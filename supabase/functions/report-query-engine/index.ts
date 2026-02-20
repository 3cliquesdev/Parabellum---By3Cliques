import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========== ALLOWLISTS ==========

const JOIN_ALLOWLIST: Record<string, Record<string, { fk: string; pk: string; alias: string }>> = {
  deals: {
    contacts: { fk: "contact_id", pk: "id", alias: "c" },
    stages: { fk: "stage_id", pk: "id", alias: "st" },
    pipelines: { fk: "pipeline_id", pk: "id", alias: "pl" },
    profiles: { fk: "assigned_to", pk: "id", alias: "pr" },
  },
  conversations: {
    contacts: { fk: "contact_id", pk: "id", alias: "c" },
    profiles: { fk: "assigned_to", pk: "id", alias: "pr" },
    departments: { fk: "department_id", pk: "id", alias: "dp" },
  },
  tickets: {
    contacts: { fk: "contact_id", pk: "id", alias: "c" },
    profiles: { fk: "assigned_to", pk: "id", alias: "pr" },
  },
};

const OPERATOR_MAP: Record<string, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
  contains: "ILIKE",
  not_contains: "NOT ILIKE",
  is_null: "IS NULL",
  is_not_null: "IS NOT NULL",
};

const AGGREGATION_MAP: Record<string, string> = {
  count: "COUNT",
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
  count_distinct: "COUNT(DISTINCT",
};

const TIME_GRAINS = ["day", "week", "month", "quarter", "year"];

// ========== HELPERS ==========

function sanitizeIdentifier(id: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(id)) throw new Error(`Invalid identifier: ${id}`);
  return id;
}

function sanitizeValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // ---- Check role ----
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    const userRole = roleData?.role || "user";
    const isPrivileged = ["admin", "manager", "general_manager"].includes(userRole);

    // ---- Parse body ----
    const body = await req.json();
    const { report_id, definition_inline, limit: rawLimit, offset: rawOffset } = body;
    const limit = Math.min(Math.max(Number(rawLimit) || 100, 1), 10000);
    const offset = Math.max(Number(rawOffset) || 0, 0);

    let definition: {
      base_entity: string;
      fields: Array<{ entity: string; field_name: string; alias?: string }>;
      metrics: Array<{ entity: string; field_name: string; aggregation: string; alias?: string }>;
      filters: Array<{ entity: string; field_name: string; operator: string; value?: unknown; value_end?: unknown }>;
      groupings: Array<{ entity: string; field_name: string; time_grain?: string }>;
    };

    if (report_id) {
      // Load from DB
      const { data: report, error: repErr } = await supabase
        .from("report_definitions")
        .select("base_entity")
        .eq("id", report_id)
        .single();
      if (repErr || !report) throw new Error("Report not found");

      const [fieldsRes, metricsRes, filtersRes, groupingsRes] = await Promise.all([
        supabase.from("report_fields").select("*").eq("report_id", report_id).order("sort_order"),
        supabase.from("report_metrics").select("*").eq("report_id", report_id).order("sort_order"),
        supabase.from("report_filters").select("*").eq("report_id", report_id),
        supabase.from("report_groupings").select("*").eq("report_id", report_id).order("sort_order"),
      ]);

      definition = {
        base_entity: report.base_entity,
        fields: (fieldsRes.data || []).map((f: any) => ({ entity: f.entity, field_name: f.field_name, alias: f.alias })),
        metrics: (metricsRes.data || []).map((m: any) => ({ entity: m.entity, field_name: m.field_name, aggregation: m.aggregation_type, alias: m.metric_name })),
        filters: (filtersRes.data || []).map((f: any) => ({ entity: f.entity, field_name: f.field_name, operator: f.operator, value: f.value })),
        groupings: (groupingsRes.data || []).map((g: any) => ({ entity: g.entity, field_name: g.field_name, time_grain: g.time_grain })),
      };
    } else if (definition_inline) {
      definition = definition_inline;
    } else {
      throw new Error("Either report_id or definition_inline is required");
    }

    // ---- Validate complexity ----
    const totalColumns = (definition.fields?.length || 0) + (definition.metrics?.length || 0);
    if (totalColumns > 25) throw new Error("Max 25 columns allowed");
    if ((definition.groupings?.length || 0) > 3) throw new Error("Max 3 groupings allowed");

    // ---- Collect entities for JOINs ----
    const allEntities = new Set<string>();
    allEntities.add(definition.base_entity);
    for (const f of [...(definition.fields || []), ...(definition.metrics || []), ...(definition.filters || []), ...(definition.groupings || [])]) {
      if (f.entity && f.entity !== definition.base_entity) allEntities.add(f.entity);
    }
    const joinEntities = [...allEntities].filter((e) => e !== definition.base_entity);
    if (joinEntities.length > 3) throw new Error("Max 3 joins allowed");

    // ---- Validate fields against data_catalog ----
    const allFields = [
      ...(definition.fields || []),
      ...(definition.metrics || []),
      ...(definition.filters || []),
      ...(definition.groupings || []),
    ];

    const { data: catalogFields, error: catErr } = await supabase
      .from("data_catalog")
      .select("entity, field_name, field_type, is_sensitive, allow_filter, allow_group, allow_aggregate")
      .in("entity", [...allEntities]);
    if (catErr) throw new Error("Failed to load data catalog");

    const catalogMap = new Map<string, any>();
    for (const cf of catalogFields || []) {
      catalogMap.set(`${cf.entity}.${cf.field_name}`, cf);
    }

    for (const f of allFields) {
      const key = `${f.entity}.${f.field_name}`;
      const cat = catalogMap.get(key);
      if (!cat) throw new Error(`Field not found in catalog: ${key}`);
      if (cat.is_sensitive && !isPrivileged) throw new Error(`Access denied to sensitive field: ${key}`);
    }

    // Validate filter fields
    for (const f of definition.filters || []) {
      const cat = catalogMap.get(`${f.entity}.${f.field_name}`);
      if (cat && !cat.allow_filter) throw new Error(`Filtering not allowed on: ${f.entity}.${f.field_name}`);
    }

    // Validate grouping fields
    for (const g of definition.groupings || []) {
      const cat = catalogMap.get(`${g.entity}.${g.field_name}`);
      if (cat && !cat.allow_group) throw new Error(`Grouping not allowed on: ${g.entity}.${g.field_name}`);
    }

    // Validate metric fields
    for (const m of definition.metrics || []) {
      const cat = catalogMap.get(`${m.entity}.${m.field_name}`);
      if (cat && !cat.allow_aggregate && m.aggregation !== "count") {
        throw new Error(`Aggregation not allowed on: ${m.entity}.${m.field_name}`);
      }
    }

    // ---- Build SQL ----
    const baseAlias = definition.base_entity.charAt(0);
    const entityAliases: Record<string, string> = { [definition.base_entity]: baseAlias };

    // Build JOINs
    const joinClauses: string[] = [];
    for (const je of joinEntities) {
      const joinConfig = JOIN_ALLOWLIST[definition.base_entity]?.[je];
      if (!joinConfig) throw new Error(`Join not allowed: ${definition.base_entity} -> ${je}`);
      entityAliases[je] = joinConfig.alias;
      joinClauses.push(
        `LEFT JOIN ${sanitizeIdentifier(je)} ${joinConfig.alias} ON ${baseAlias}.${sanitizeIdentifier(joinConfig.fk)} = ${joinConfig.alias}.${sanitizeIdentifier(joinConfig.pk)}`
      );
    }

    // SELECT columns
    const selectParts: string[] = [];

    // Grouping columns (with time_grain)
    for (const g of definition.groupings || []) {
      const alias = entityAliases[g.entity] || baseAlias;
      const col = `${alias}.${sanitizeIdentifier(g.field_name)}`;
      if (g.time_grain && TIME_GRAINS.includes(g.time_grain)) {
        selectParts.push(`date_trunc('${g.time_grain}', ${col}) AS ${sanitizeIdentifier(g.field_name)}_${g.time_grain}`);
      } else {
        selectParts.push(col);
      }
    }

    // Regular fields (not in groupings)
    const groupingKeys = new Set((definition.groupings || []).map((g) => `${g.entity}.${g.field_name}`));
    for (const f of definition.fields || []) {
      const key = `${f.entity}.${f.field_name}`;
      if (groupingKeys.has(key)) continue;
      const alias = entityAliases[f.entity] || baseAlias;
      const col = `${alias}.${sanitizeIdentifier(f.field_name)}`;
      const outputAlias = f.alias ? sanitizeIdentifier(f.alias) : sanitizeIdentifier(f.field_name);
      selectParts.push(`${col} AS ${outputAlias}`);
    }

    // Metrics
    for (const m of definition.metrics || []) {
      const alias = entityAliases[m.entity] || baseAlias;
      const col = `${alias}.${sanitizeIdentifier(m.field_name)}`;
      const aggFn = AGGREGATION_MAP[m.aggregation];
      if (!aggFn) throw new Error(`Invalid aggregation: ${m.aggregation}`);
      const outputAlias = m.alias || `${m.aggregation}_${m.field_name}`;
      if (m.aggregation === "count_distinct") {
        selectParts.push(`${aggFn} ${col}) AS ${sanitizeIdentifier(outputAlias)}`);
      } else {
        selectParts.push(`${aggFn}(${col}) AS ${sanitizeIdentifier(outputAlias)}`);
      }
    }

    if (selectParts.length === 0) throw new Error("No columns selected");

    // WHERE
    const whereParts: string[] = [];
    for (const f of definition.filters || []) {
      const alias = entityAliases[f.entity] || baseAlias;
      const col = `${alias}.${sanitizeIdentifier(f.field_name)}`;
      const op = f.operator;

      if (op === "is_null") {
        whereParts.push(`${col} IS NULL`);
      } else if (op === "is_not_null") {
        whereParts.push(`${col} IS NOT NULL`);
      } else if (op === "between") {
        whereParts.push(`${col} BETWEEN ${sanitizeValue(f.value)} AND ${sanitizeValue(f.value_end)}`);
      } else if (op === "in") {
        const vals = Array.isArray(f.value) ? f.value.map(sanitizeValue).join(", ") : sanitizeValue(f.value);
        whereParts.push(`${col} IN (${vals})`);
      } else if (op === "contains") {
        whereParts.push(`${col} ILIKE ${sanitizeValue(`%${f.value}%`)}`);
      } else if (op === "not_contains") {
        whereParts.push(`${col} NOT ILIKE ${sanitizeValue(`%${f.value}%`)}`);
      } else {
        const sqlOp = OPERATOR_MAP[op];
        if (!sqlOp) throw new Error(`Invalid operator: ${op}`);
        whereParts.push(`${col} ${sqlOp} ${sanitizeValue(f.value)}`);
      }
    }

    // GROUP BY
    const groupByParts: string[] = [];
    for (const g of definition.groupings || []) {
      const alias = entityAliases[g.entity] || baseAlias;
      const col = `${alias}.${sanitizeIdentifier(g.field_name)}`;
      if (g.time_grain && TIME_GRAINS.includes(g.time_grain)) {
        groupByParts.push(`date_trunc('${g.time_grain}', ${col})`);
      } else {
        groupByParts.push(col);
      }
    }

    // Assemble SQL
    let sql = `SELECT ${selectParts.join(", ")} FROM ${sanitizeIdentifier(definition.base_entity)} ${baseAlias}`;
    if (joinClauses.length > 0) sql += ` ${joinClauses.join(" ")}`;
    if (whereParts.length > 0) sql += ` WHERE ${whereParts.join(" AND ")}`;
    if (groupByParts.length > 0) sql += ` GROUP BY ${groupByParts.join(", ")}`;
    if (groupByParts.length > 0) sql += ` ORDER BY ${groupByParts[0]}`;
    sql += ` LIMIT ${limit + 1} OFFSET ${offset}`;

    console.log("[report-query-engine] Generated SQL:", sql);

    // ---- Execute via RPC ----
    const { data: result, error: rpcErr } = await supabase.rpc("exec_report_sql", { p_sql: sql });
    if (rpcErr) throw new Error(`RPC error: ${rpcErr.message}`);

    const rows = Array.isArray(result) ? result : [];
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    return new Response(
      JSON.stringify({ rows, has_more: hasMore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[report-query-engine] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
