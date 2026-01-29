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
  unassigned: number;
  unread: number;
  closed: number;
  byDepartment: Array<{ id: string; name: string; color: string | null; count: number }>;
  byTag: Array<{ id: string; name: string; color: string | null; count: number }>;
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // Base filters: for non-management roles we restrict by department rules similar to the UI.
    // For management roles, return global counts.
    const isManager = isManagementRole(role);

    // Departments meta
    const { data: deptsData } = await supabaseAdmin
      .from("departments")
      .select("id, name, color")
      .eq("is_active", true);
    const departments = (deptsData || []) as Array<{ id: string; name: string; color: string | null }>;

    // Tags meta
    const { data: tagsData } = await supabaseAdmin.from("tags").select("id, name, color");
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
    const { count: totalActive = 0 } = await applyVisibility(
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })
    ).neq("status", "closed");

    const { count: totalClosed = 0 } = await applyVisibility(
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })
    ).eq("status", "closed");

    const { count: mine = 0 } = await supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed")
      .eq("assigned_to", userId);

    const { count: aiQueue = 0 } = await applyVisibility(
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })
    )
      .neq("status", "closed")
      .eq("ai_mode", "autopilot");

    const { count: humanQueue = 0 } = await applyVisibility(
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })
    )
      .neq("status", "closed")
      .neq("ai_mode", "autopilot");

    const { count: unassigned = 0 } = await applyVisibility(
      supabaseAdmin.from("conversations").select("id", { count: "exact", head: true })
    )
      .neq("status", "closed")
      .is("assigned_to", null);

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
      unassigned: unassigned || 0,
      unread,
      closed: totalClosed || 0,
      byDepartment,
      byTag,
    };

    return new Response(JSON.stringify({ counts, role }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
