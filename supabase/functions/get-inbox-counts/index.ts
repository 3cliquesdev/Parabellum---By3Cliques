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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const startedAt = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[get-inbox-counts] Missing required environment variables");
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maybeWarmup = req.method === "POST" ? await req.json().catch(() => null) : null;
    if (maybeWarmup?.warmup === true) {
      return new Response(JSON.stringify({ success: true, warmed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: "public" },
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

    // Buscar departamento do perfil do usuário para visibilidade baseada em departamento
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("department")
      .eq("id", userId)
      .maybeSingle();
    
    const userDepartmentId = userProfile?.department ?? null;

    // Helper to apply non-management visibility constraints.
    // IMPORTANT: query must already have .select() called before passing to this function
    // ✅ MUDANÇA: Usar departamento do perfil do usuário ao invés de nomes hardcoded
    const applyVisibility = (query: any) => {
      if (isManager) return query;

      // Operational roles: mimic the existing behavior.
      if (role === "consultant" || role === "user") {
        return query.eq("assigned_to", userId);
      }

      // ✅ MUDANÇA: sales_rep, support_agent, financial_agent veem TODAS as conversas do departamento
      if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
        if (userDepartmentId) {
          // Agente vê: suas conversas OU todas do seu departamento OU pool geral (sem dept e sem assigned)
          return query.or(
            `assigned_to.eq.${userId},department.eq.${userDepartmentId},and(assigned_to.is.null,department.is.null)`
          );
        }
        // Sem departamento configurado: apenas atribuídas ao usuário OU pool geral
        return query.or(`assigned_to.eq.${userId},and(assigned_to.is.null,department.is.null)`);
      }

      // Outros roles operacionais: assigned only
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
        .is("assigned_to", null)
        .neq("ai_mode", "autopilot"),
    ]);

    const totalActive = totalActiveRes.count ?? 0;
    const totalClosed = totalClosedRes.count ?? 0;
    const mine = mineRes.count ?? 0;
    const aiQueue = aiQueueRes.count ?? 0;
    const humanQueue = humanQueueRes.count ?? 0;
    const unassigned = unassignedRes.count ?? 0;

    // -------- Derived counts from inbox_view (unread / sla / last_sender)
    // SLA é calculado DINAMICAMENTE baseado em timestamps (não usa campo estático sla_status)
    const slaTimestamp = Date.now();
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const oneHourAgo = new Date(slaTimestamp - ONE_HOUR_MS).toISOString();
    const fourHoursAgo = new Date(slaTimestamp - FOUR_HOURS_MS).toISOString();

    // Queries paralelas otimizadas para SLA (COUNT direto no SQL, sem trazer dados)
    const [
      { data: inboxRows, error: inboxErr },
      { count: slaCriticalCount },
      { count: slaWarningCount },
    ] = await Promise.all([
      // Query principal para unread e notResponded
      applyVisibility(
        supabaseAdmin.from("inbox_view").select("conversation_id, unread_count, last_sender_type, status, assigned_to")
      ).limit(5000),
      
      // SLA Critical: >= 4h sem resposta (COUNT direto)
      supabaseAdmin
        .from("inbox_view")
        .select("conversation_id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("last_sender_type", "contact")
        .lt("last_message_at", fourHoursAgo),
      
      // SLA Warning: 1h-4h sem resposta (COUNT direto)
      supabaseAdmin
        .from("inbox_view")
        .select("conversation_id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("last_sender_type", "contact")
        .lt("last_message_at", oneHourAgo)
        .gte("last_message_at", fourHoursAgo),
    ]);
    
    if (inboxErr) throw inboxErr;
    const inbox = inboxRows || [];

    const inboxActive = inbox.filter((i: any) => i.status !== "closed");
    const slaCritical = slaCriticalCount ?? 0;
    const slaWarning = slaWarningCount ?? 0;
    const notResponded = inboxActive.filter((i: any) => i.last_sender_type === "contact").length;
    
    console.log("[get-inbox-counts] SLA dinâmico calculado:", { slaCritical, slaWarning, fourHoursAgo, oneHourAgo });
    
    // Conversas do usuário atual com última mensagem do cliente (aguardando resposta do agente)
    // Query direta sem applyVisibility para garantir contagem precisa para o usuário
    const { count: myNotRespondedCount } = await supabaseAdmin
      .from("inbox_view")
      .select("conversation_id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("last_sender_type", "contact")
      .neq("status", "closed");
    
    const myNotResponded = myNotRespondedCount ?? 0;
    
    console.log("[get-inbox-counts] myNotResponded calculated:", {
      userId,
      myNotResponded,
      totalInboxActive: inboxActive.length,
      notResponded
    });
    
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
  } catch (error: any) {
    const errMsg = error?.message || error?.msg || (typeof error === 'string' ? error : JSON.stringify(error));
    console.error("[get-inbox-counts] Error:", errMsg, error);
    return new Response(
      JSON.stringify({ error: errMsg || "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
