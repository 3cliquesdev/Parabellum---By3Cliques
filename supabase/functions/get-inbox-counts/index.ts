import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AppRole =
  | "admin"
  | "general_manager"
  | "manager"
  | "support_manager"
  | "cs_manager"
  | "financial_manager"
  | "sales_rep"
  | "support_agent"
  | "financial_agent"
  | "consultant"
  | "user";

type InboxCounts = {
  total: number;
  mine: number;
  aiQueue: number;
  humanQueue: number;
  slaCritical: number;
  slaWarning: number;
  notResponded: number;
  myNotResponded: number; // Conversas do usuário atual aguardando resposta
  unassigned: number;
  unread: number;
  closed: number;
  byDepartment: Array<{ id: string; name: string; color: string | null; count: number }>;
  byTag: Array<{ id: string; name: string; color: string | null; count: number }>;
};

type CacheEntry = {
  expiresAt: number;
  value: { counts: InboxCounts; role: AppRole };
};

// Small in-memory cache to absorb UI burst traffic and prevent cold-start thrash.
// Keyed by userId + role (role affects visibility rules).
const CACHE_TTL_MS = 4_000;
const cache = new Map<string, CacheEntry>();

function isManagementRole(role: AppRole | null | undefined) {
  return (
    role === "admin" ||
    role === "manager" ||
    role === "general_manager" ||
    role === "support_manager" ||
    role === "cs_manager" ||
    role === "financial_manager"
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const startedAt = Date.now();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const role = (roleRow?.role as AppRole | undefined) ?? undefined;
    if (!role) {
      return new Response(JSON.stringify({ error: "Papel de usuário não configurado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache hit (after role is known, since visibility depends on role).
    const cacheKey = `${userId}:${role}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return new Response(JSON.stringify({ ...cached.value, cached: true }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Counts-Cache": "hit",
        },
      });
    }

    // Base filters: for non-management roles we restrict by department rules similar to the UI.
    // For management roles, return global counts.
    const isManager = isManagementRole(role);

    // Meta (run in parallel)
    const [{ data: deptsData }, { data: tagsData }] = await Promise.all([
      supabaseAdmin.from("departments").select("id, name, color").eq("is_active", true),
      supabaseAdmin.from("tags").select("id, name, color"),
    ]);

    const departments = (deptsData || []) as Array<{ id: string; name: string; color: string | null }>;
    const tags = (tagsData || []) as Array<{ id: string; name: string; color: string | null }>;

    // Helper to apply non-management visibility constraints.
    // IMPORTANT: query must already have .select() called before passing to this function
    const applyVisibility = (query: any) => {
      if (isManager) return query;

      // Operational roles: mimic the existing behavior.
      if (role === "consultant" || role === "user") {
        return query.eq("assigned_to", userId);
      }

      if (role === "sales_rep") {
        // assigned OR (unassigned AND open AND (dept in Sales OR dept null))
        const salesDeptIds = departments
          .filter((d) => d.name === "Comercial" || d.name === "Vendas")
          .map((d) => d.id);

        if (salesDeptIds.length > 0) {
          return query.or(
            `assigned_to.eq.${userId},and(status.eq.open,assigned_to.is.null,department.in.(${salesDeptIds.join(",")})),and(status.eq.open,assigned_to.is.null,department.is.null)`
          );
        }
        return query.or(`assigned_to.eq.${userId},and(status.eq.open,assigned_to.is.null,department.is.null)`);
      }

      if (role === "support_agent") {
        const supportDeptIds = departments.filter((d) => d.name === "Suporte").map((d) => d.id);
        if (supportDeptIds.length > 0) {
          return query.or(
            `assigned_to.eq.${userId},and(status.eq.open,assigned_to.is.null,department.in.(${supportDeptIds.join(",")})),and(status.eq.open,assigned_to.is.null,department.is.null)`
          );
        }
        return query.or(`assigned_to.eq.${userId},and(status.eq.open,assigned_to.is.null,department.is.null)`);
      }

      // financial_agent or other operational: assigned only
      return query.eq("assigned_to", userId);
    };

    // -------- Core counts from conversations (true source of "total")
    // FIX: Apply visibility AFTER .select() so .or() method is available
    const [
      totalActiveRes,
      totalClosedRes,
      mineRes,
      aiQueueRes,
      humanQueueRes,
      unassignedRes,
    ] = await Promise.all([
      applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })).neq(
        "status",
        "closed"
      ),
      applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })).eq(
        "status",
        "closed"
      ),
      supabaseAdmin
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .neq("status", "closed")
        .eq("assigned_to", userId),
      applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }))
        .neq("status", "closed")
        .eq("ai_mode", "autopilot"),
      applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }))
        .neq("status", "closed")
        .neq("ai_mode", "autopilot"),
      applyVisibility(supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }))
        .neq("status", "closed")
        .is("assigned_to", null),
    ]);

    const totalActive = totalActiveRes.count ?? 0;
    const totalClosed = totalClosedRes.count ?? 0;
    const mine = mineRes.count ?? 0;
    const aiQueue = aiQueueRes.count ?? 0;
    const humanQueue = humanQueueRes.count ?? 0;
    const unassigned = unassignedRes.count ?? 0;

    // -------- Derived counts from inbox_view (unread / sla / last_sender)
    const { data: inboxRows, error: inboxErr } = await applyVisibility(
      supabaseAdmin.from("inbox_view").select("conversation_id, sla_status, unread_count, last_sender_type, status")
    ).limit(5000);
    
    if (inboxErr) throw inboxErr;
    const inbox = inboxRows || [];

    const inboxActive = inbox.filter((i: any) => i.status !== "closed");
    const slaCritical = inbox.filter((i: any) => i.sla_status === "critical").length;
    const slaWarning = inbox.filter((i: any) => i.sla_status === "warning").length;
    const notResponded = inboxActive.filter((i: any) => i.last_sender_type === "contact").length;
    // Novo: Conversas do usuário atual com última mensagem do cliente (aguardando resposta do agente)
    const myNotResponded = inboxActive.filter(
      (i: any) => i.last_sender_type === "contact" && i.assigned_to === userId
    ).length;
    const unread = inbox.reduce((sum: number, i: any) => sum + (i.unread_count || 0), 0);

    // -------- byDepartment (active)
    const byDepartment = await Promise.all(
      departments.map(async (dept) => {
        const { count = 0 } = await applyVisibility(
          supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })
        )
          .neq("status", "closed")
          .eq("department", dept.id);
        return { id: dept.id, name: dept.name, color: dept.color, count };
      })
    );

    // -------- byTag (active)
    // Get active conversation ids (bounded). This is safe for current scale and avoids raw SQL.
    const { data: activeConvIdsRows } = await applyVisibility(
      supabaseAdmin.from("conversations").select("id")
    )
      .neq("status", "closed")
      .limit(5000);
    const activeConvIds = (activeConvIdsRows || []).map((r: any) => r.id);

    let tagCounts = new Map<string, number>();
    if (activeConvIds.length > 0) {
      const { data: convTags } = await supabaseAdmin
        .from("conversation_tags")
        .select("conversation_id, tag_id")
        .in("conversation_id", activeConvIds);
      for (const ct of convTags || []) {
        tagCounts.set(ct.tag_id, (tagCounts.get(ct.tag_id) || 0) + 1);
      }
    }

    const byTag = tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: tagCounts.get(t.id) || 0,
    }));

    const counts: InboxCounts = {
      total: totalActive || 0,
      mine: mine || 0,
      aiQueue: aiQueue || 0,
      humanQueue: humanQueue || 0,
      slaCritical,
      slaWarning,
      notResponded,
      myNotResponded,
      unassigned: unassigned || 0,
      unread,
      closed: totalClosed || 0,
      byDepartment,
      byTag,
    };

    // Store in cache
    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: { counts, role },
    });

    return new Response(JSON.stringify({ counts, role, cached: false, tookMs: Date.now() - startedAt }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Counts-Cache": "miss",
      },
    });
  } catch (error) {
    console.error("[get-inbox-counts] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
