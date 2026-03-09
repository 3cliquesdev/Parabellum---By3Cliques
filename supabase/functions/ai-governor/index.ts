import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pct(num: number, den: number): string {
  if (den === 0) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function collectDayMetrics(supabase: any, since: string, until: string) {
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, ai_mode, status, created_at, closed_at, channel')
    .gte('created_at', since)
    .lt('created_at', until);

  const totalConvs = convs?.length ?? 0;
  const closedByAI = convs?.filter((c: any) => c.status === 'closed' && c.ai_mode === 'autopilot').length ?? 0;
  const escalatedToHuman = convs?.filter((c: any) => c.ai_mode === 'waiting_human' || c.ai_mode === 'copilot').length ?? 0;
  const closedTotal = convs?.filter((c: any) => c.status === 'closed').length ?? 0;
  const openTotal = convs?.filter((c: any) => c.status === 'open').length ?? 0;

  // Breakdown por ai_mode
  const autopilotConvs = convs?.filter((c: any) => c.ai_mode === 'autopilot').length ?? 0;
  const copilotConvs = convs?.filter((c: any) => c.ai_mode === 'copilot').length ?? 0;
  const waitingHumanConvs = convs?.filter((c: any) => c.ai_mode === 'waiting_human').length ?? 0;
  const disabledConvs = convs?.filter((c: any) => c.ai_mode === 'disabled').length ?? 0;

  // Breakdown por status + ai_mode (detalhado)
  const closedAutopilot = convs?.filter((c: any) => c.status === 'closed' && c.ai_mode === 'autopilot').length ?? 0;
  const closedCopilot = convs?.filter((c: any) => c.status === 'closed' && c.ai_mode === 'copilot').length ?? 0;
  const closedDisabled = convs?.filter((c: any) => c.status === 'closed' && c.ai_mode === 'disabled').length ?? 0;
  const openAutopilot = convs?.filter((c: any) => c.status === 'open' && c.ai_mode === 'autopilot').length ?? 0;
  const openCopilot = convs?.filter((c: any) => c.status === 'open' && c.ai_mode === 'copilot').length ?? 0;

  // Breakdown por canal
  const channelCounts: Record<string, number> = {};
  convs?.forEach((c: any) => { if (c.channel) channelCounts[c.channel] = (channelCounts[c.channel] ?? 0) + 1; });

  const closedWithTime = convs?.filter((c: any) => c.closed_at && c.created_at) ?? [];
  const avgResolutionMin = closedWithTime.length > 0
    ? Math.round(closedWithTime.reduce((sum: number, c: any) => {
        return sum + (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000;
      }, 0) / closedWithTime.length)
    : null;

  // Contagem REAL de eventos IA no dia (sem cap de limit)
  const { count: totalAIEventsCount } = await supabase
    .from('ai_events')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .lt('created_at', until);

  // Fetch amostra para análise de intents/tipos (limit para performance)
  const { data: aiEvents } = await supabase
    .from('ai_events')
    .select('event_type, model, output_json, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(500);

  const totalAIEvents = totalAIEventsCount ?? aiEvents?.length ?? 0;
  const fallbackEvents = aiEvents?.filter((e: any) => e.output_json?.action === 'handoff' || e.output_json?.escalated === true).length ?? 0;
  const directEvents = aiEvents?.filter((e: any) => e.output_json?.action === 'direct').length ?? 0;

  const intentCount: Record<string, number> = {};
  aiEvents?.forEach((e: any) => {
    if (e.event_type) intentCount[e.event_type] = (intentCount[e.event_type] ?? 0) + 1;
  });
  const topIntents = Object.entries(intentCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v}x)`);

  const { data: anomalies } = await supabase
    .from('ai_anomaly_logs')
    .select('metric_type, severity, change_percent, created_at')
    .gte('created_at', since)
    .lt('created_at', until);

  const criticalAnomalies = anomalies?.filter((a: any) => a.severity === 'critical') ?? [];
  const warningAnomalies = anomalies?.filter((a: any) => a.severity === 'warning') ?? [];

  const { count: totalMessages } = await supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', since).lt('created_at', until);
  const { count: aiMessages } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('is_ai_generated', true).gte('created_at', since).lt('created_at', until);

  // CSAT do dia
  const { data: csatData } = await supabase
    .from('conversation_ratings')
    .select('rating')
    .gte('created_at', since)
    .lt('created_at', until);
  
  const csatCount = csatData?.length ?? 0;
  const csatAvg = csatCount > 0
    ? (csatData.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) / csatCount).toFixed(1)
    : null;

  // KB coverage: artigos ativos com embedding
  const { count: kbArticlesCount } = await supabase
    .from('knowledge_base_articles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .not('embedding', 'is', null);

  // Canais ativos no dia
  const activeChannels = Object.keys(channelCounts);

  // Configs atuais da IA
  const { data: aiCfgs } = await supabase
    .from('system_configurations')
    .select('key, value')
    .in('key', ['ai_strict_rag_mode', 'ai_rag_min_threshold', 'ai_confidence_direct', 'ai_block_financial']);

  const aiConfig = {
    strictRagMode: aiCfgs?.find((c: any) => c.key === 'ai_strict_rag_mode')?.value ?? 'N/A',
    ragMinThreshold: aiCfgs?.find((c: any) => c.key === 'ai_rag_min_threshold')?.value ?? 'N/A',
    confidenceDirect: aiCfgs?.find((c: any) => c.key === 'ai_confidence_direct')?.value ?? 'N/A',
    blockFinancial: aiCfgs?.find((c: any) => c.key === 'ai_block_financial')?.value ?? 'N/A',
  };

  // Top motivos de falha da IA
  const { data: failEvents } = await supabase
    .from('ai_events')
    .select('event_type, output_json')
    .gte('created_at', since)
    .lt('created_at', until)
    .in('event_type', ['ai_handoff_exit', 'ai_blocked_financial', 'ai_blocked_commercial', 'ai_transfer', 'ai_no_answer'])
    .limit(100);

  const failTopics: Record<string, number> = {};
  failEvents?.forEach((e: any) => {
    const t = e.event_type;
    failTopics[t] = (failTopics[t] ?? 0) + 1;
  });
  const topFailReasons = Object.entries(failTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v}x)`);

  // ═══ Tags de conversas do dia ═══
  const { data: convTagsData } = await supabase
    .from('conversation_tags')
    .select('tag_id, tags(name, color), conversation_id')
    .gte('created_at', since)
    .lt('created_at', until);

  const tagCountMap: Record<string, { name: string; count: number }> = {};
  convTagsData?.forEach((ct: any) => {
    const tagName = ct.tags?.name;
    if (tagName) {
      if (!tagCountMap[tagName]) tagCountMap[tagName] = { name: tagName, count: 0 };
      tagCountMap[tagName].count++;
    }
  });
  const topConversationTags = Object.values(tagCountMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ═══ Tickets do dia ═══
  const { data: ticketsToday } = await supabase
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, category, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(50);

  const ticketsTodayTotal = ticketsToday?.length ?? 0;
  const ticketsByPriority = {
    urgent: ticketsToday?.filter((t: any) => t.priority === 'urgent').length ?? 0,
    high: ticketsToday?.filter((t: any) => t.priority === 'high').length ?? 0,
    medium: ticketsToday?.filter((t: any) => t.priority === 'medium').length ?? 0,
    low: ticketsToday?.filter((t: any) => t.priority === 'low').length ?? 0,
  };
  const ticketsOpen = ticketsToday?.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length ?? 0;
  const ticketsTopSubjects = ticketsToday
    ?.filter((t: any) => t.priority === 'urgent' || t.priority === 'high')
    ?.slice(0, 5)
    ?.map((t: any) => ({ ticket_number: t.ticket_number, subject: t.subject, priority: t.priority })) ?? [];

  const ticketCatMap: Record<string, number> = {};
  ticketsToday?.forEach((t: any) => {
    const cat = t.category || 'Sem categoria';
    ticketCatMap[cat] = (ticketCatMap[cat] ?? 0) + 1;
  });
  const ticketsCategories = Object.entries(ticketCatMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    totalConvs, closedByAI, escalatedToHuman, closedTotal, openTotal, avgResolutionMin,
    totalAIEvents, fallbackEvents, directEvents, topIntents,
    criticalAnomalies, warningAnomalies,
    totalMessages: totalMessages ?? 0, aiMessages: aiMessages ?? 0,
    // Breakdown detalhado
    autopilotConvs, copilotConvs, waitingHumanConvs, disabledConvs,
    closedAutopilot, closedCopilot, closedDisabled,
    openAutopilot, openCopilot,
    channelCounts,
    // CSAT
    csatCount, csatAvg,
    // Contexto técnico
    kbArticlesCount: kbArticlesCount ?? 0,
    activeChannels,
    aiConfig,
    topFailReasons,
    // Tags de conversas
    topConversationTags,
    // Tickets do dia
    ticketsTodayTotal, ticketsByPriority, ticketsOpen, ticketsTopSubjects, ticketsCategories,
  };
}

async function collectSalesMetrics(supabase: any, since: string, until: string) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  // IDs do time comercial (pipeline_sales_reps)
  const { data: salesRepsData } = await supabase
    .from('pipeline_sales_reps')
    .select('user_id');
  const commercialRepsIds = [...new Set(salesRepsData?.map((r: any) => r.user_id) ?? [])];

  // Deals won hoje (filtro por closed_at = data do fechamento)
  const { data: wonToday } = await supabase
    .from('deals')
    .select('id, gross_value, affiliate_name, affiliate_commission, lead_source, kiwify_offer_id, tracking_code, is_organic_sale, pipeline_id, assigned_to, is_returning_customer')
    .eq('status', 'won')
    .gte('closed_at', since)
    .lt('closed_at', until);

  // Separar vendas novas vs recorrências
  const newSalesDeals = wonToday?.filter((d: any) => !d.is_returning_customer) ?? [];
  const recurrenceDeals = wonToday?.filter((d: any) => d.is_returning_customer === true) ?? [];
  const newSalesCount = newSalesDeals.length;
  const newSalesRevenue = newSalesDeals.reduce((s: number, d: any) => s + (Number(d.gross_value) || 0), 0);
  const recurrenceCount = recurrenceDeals.length;
  const recurrenceRevenue = recurrenceDeals.reduce((s: number, d: any) => s + (Number(d.gross_value) || 0), 0);

  // Deals perdidos hoje (filtro por closed_at)
  const { data: lostToday } = await supabase
    .from('deals')
    .select('id, lost_reason, gross_value')
    .eq('status', 'lost')
    .gte('closed_at', since)
    .lt('closed_at', until);

  const { count: newDealsCount } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .lt('created_at', until);

  // Classificação de origem — Hierarquia: assigned_to → recorrência → parceiro → formulário → canal → orgânico → kiwify → fallback
  const classifyOrigin = (deal: any): string => {
    // REGRA PRINCIPAL: vendedor atribuído = SEMPRE comercial (docs/architecture/sales-channel-attribution-rules.md)
    if (deal.assigned_to) return 'comercial_interno';

    const source = (deal.lead_source || '').toLowerCase().trim();

    // Recorrência / Renovação
    if (source === 'kiwify_recorrencia' || source === 'kiwify_renovacao') return 'kiwify:recorrencia';

    // Parceiros / Afiliados (sem vendedor)
    if (deal.affiliate_name) {
      if (deal.affiliate_name.toUpperCase().includes('CIRILO')) return 'parceiro:CIRILO Educação Digital';
      return `parceiro:${deal.affiliate_name}`;
    }

    // Formulários
    if (source === 'formulario' || source === 'form' || source === 'chat_widget') return `formulario:${deal.tracking_code || 'geral'}`;

    // Canais diretos
    if (source === 'whatsapp') return 'canal:whatsapp';
    if (source === 'webchat') return 'canal:webchat';

    // Orgânico
    if (deal.is_organic_sale) return 'kiwify:organico';

    // Kiwify automático
    if (source === 'kiwify_direto') return 'kiwify:direto';
    if (source === 'kiwify_novo_cliente') return 'kiwify:novo_cliente';

    // Recuperação
    if (deal.pipeline_id === '00000000-0000-0000-0000-000000000001') return 'recuperacao';

    return 'direto';
  };

  // Agregar por categoria principal
  const cats: Record<string, { deals: number; revenue: number; commission: number; label: string; emoji: string }> = {
    parceiros: { deals: 0, revenue: 0, commission: 0, label: 'Parceiros Afiliados', emoji: '🤝' },
    kiwify:    { deals: 0, revenue: 0, commission: 0, label: 'Kiwify (plataforma)', emoji: '🟠' },
    comercial: { deals: 0, revenue: 0, commission: 0, label: 'Time Comercial Interno', emoji: '👥' },
    formulario:{ deals: 0, revenue: 0, commission: 0, label: 'Formulários', emoji: '📝' },
    canais:    { deals: 0, revenue: 0, commission: 0, label: 'WhatsApp / WebChat', emoji: '💬' },
    organico:  { deals: 0, revenue: 0, commission: 0, label: 'Orgânico', emoji: '🌱' },
    outros:    { deals: 0, revenue: 0, commission: 0, label: 'Outros / Direto', emoji: '📌' },
  };

  // Parceiros detalhados
  const partnersMap: Record<string, { deals: number; revenue: number }> = {};
  // Reps performance hoje
  const repsMap: Record<string, { deals: number; revenue: number }> = {};

  let totalRevToday = 0;

  wonToday?.forEach((d: any) => {
    const origin = classifyOrigin(d);
    const rev = Number(d.gross_value) || 0;
    const comm = Number(d.affiliate_commission) || 0;
    totalRevToday += rev;

    let catKey = 'outros';
    if (origin.startsWith('parceiro:')) {
      catKey = 'parceiros';
      const pName = origin.replace('parceiro:', '');
      if (!partnersMap[pName]) partnersMap[pName] = { deals: 0, revenue: 0 };
      partnersMap[pName].deals++;
      partnersMap[pName].revenue += rev;
    } else if (origin.startsWith('kiwify:') || origin === 'kiwify:organico') {
      catKey = 'kiwify';
    } else if (origin === 'comercial_interno') {
      catKey = 'comercial';
      const repId = d.assigned_to;
      if (!repsMap[repId]) repsMap[repId] = { deals: 0, revenue: 0 };
      repsMap[repId].deals++;
      repsMap[repId].revenue += rev;
    } else if (origin.startsWith('formulario:')) {
      catKey = 'formulario';
    } else if (origin.startsWith('canal:')) {
      catKey = 'canais';
    } else if (origin === 'recuperacao') {
      catKey = 'outros';
    }

    cats[catKey].deals += 1;
    cats[catKey].revenue += rev;
    cats[catKey].commission += comm;
  });

  // Calcular percentuais
  const origins = Object.entries(cats)
    .filter(([, v]) => v.deals > 0)
    .map(([key, v]) => ({
      key, ...v,
      pct: totalRevToday > 0 ? Math.round((v.revenue / totalRevToday) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top parceiros
  const topPartners = Object.entries(partnersMap)
    .map(([name, v]) => ({ name, ...v, pct: totalRevToday > 0 ? Math.round((v.revenue / totalRevToday) * 100) : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Buscar nomes dos reps comerciais
  const repIds = Object.keys(repsMap);
  let topReps: any[] = [];
  if (repIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', repIds);
    topReps = repIds
      .map(id => ({
        name: profiles?.find((p: any) => p.id === id)?.full_name ?? 'Agente',
        ...repsMap[id],
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  // ═══ Pipeline Comercial — novos leads abertos hoje ═══
  const { data: pipelineNewToday } = await supabase
    .from('deals')
    .select('id, lead_source, tracking_code, assigned_to, value, created_at')
    .eq('status', 'open')
    .gte('created_at', since)
    .lt('created_at', until);

  const pipelineBySource: Record<string, number> = {};
  pipelineNewToday?.forEach((d: any) => {
    const src = d.lead_source === 'formulario' ? `📝 Formulário${d.tracking_code ? ': ' + d.tracking_code : ''}`
      : d.lead_source === 'whatsapp' ? '💬 WhatsApp'
      : d.lead_source === 'webchat' ? '🌐 WebChat'
      : d.lead_source?.startsWith('kiwify') ? '🟠 Kiwify'
      : '📌 Outro';
    pipelineBySource[src] = (pipelineBySource[src] ?? 0) + 1;
  });
  const newLeadsToday = pipelineNewToday?.length ?? 0;
  const topNewSources = Object.entries(pipelineBySource)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => `${k}: ${v} leads`);

  // ═══ Performance do time comercial no MÊS ═══
  const { data: wonMonthByRep } = await supabase
    .from('deals')
    .select('assigned_to, gross_value')
    .eq('status', 'won')
    .gte('closed_at', firstDayOfMonth)
    .not('assigned_to', 'is', null);

  const repMonthMap: Record<string, { deals: number; revenue: number }> = {};
  wonMonthByRep?.forEach((d: any) => {
    if (!d.assigned_to) return;
    if (!repMonthMap[d.assigned_to]) repMonthMap[d.assigned_to] = { deals: 0, revenue: 0 };
    repMonthMap[d.assigned_to].deals++;
    repMonthMap[d.assigned_to].revenue += Number(d.gross_value) || 0;
  });

  const repMonthIds = Object.keys(repMonthMap);
  let topRepsMonth: any[] = [];
  if (repMonthIds.length > 0) {
    const { data: monthProfiles } = await supabase.from('profiles').select('id, full_name').in('id', repMonthIds);
    topRepsMonth = repMonthIds
      .map(id => ({ name: monthProfiles?.find((p: any) => p.id === id)?.full_name ?? 'Agente', ...repMonthMap[id] }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }

  // Alertas de concentração
  const alerts: string[] = [];
  const partnerPct = origins.find(o => o.key === 'parceiros')?.pct ?? 0;
  if (partnerPct >= 50) alerts.push(`⚠️ Parceiros representam ${partnerPct}% da receita — risco de dependência`);
  if (topPartners[0]?.pct >= 35) alerts.push(`⚠️ "${topPartners[0].name}" concentra ${topPartners[0].pct}% da receita do dia`);
  
  // Alerta comercial inteligente (considera mês)
  if (cats.comercial.deals === 0 && totalRevToday > 0) {
    const monthDeals = topRepsMonth.reduce((s: number, r: any) => s + r.deals, 0);
    if (monthDeals === 0) alerts.push('📢 Time comercial: sem fechamentos hoje nem no mês — verificar pipeline');
    else alerts.push(`📢 Time comercial: sem fechamento hoje (${monthDeals} deals no mês)`);
  }

  // Período mês + MoM
  const { data: wonMonth } = await supabase
    .from('deals')
    .select('gross_value, assigned_to, affiliate_name, lead_source')
    .eq('status', 'won')
    .gte('closed_at', firstDayOfMonth);

  const { data: wonPrev } = await supabase
    .from('deals')
    .select('gross_value')
    .eq('status', 'won')
    .gte('closed_at', prevMonthStart)
    .lt('closed_at', firstDayOfMonth);

  const revenueMonth = wonMonth?.reduce((s: number, d: any) => s + (Number(d.gross_value) || 0), 0) ?? 0;
  const revenuePrev = wonPrev?.reduce((s: number, d: any) => s + (Number(d.gross_value) || 0), 0) ?? 0;
  const momGrowth = revenuePrev > 0 ? Math.round(((revenueMonth - revenuePrev) / revenuePrev) * 100) : null;

  // Pipeline
  const { data: pipeline } = await supabase.from('deals').select('value').not('status', 'in', '("won","lost")');
  const pipelineValue = pipeline?.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0) ?? 0;

  // Meta
  const { data: goals } = await supabase.from('sales_goals').select('target_value')
    .eq('period_month', now.getMonth() + 1).eq('period_year', now.getFullYear()).limit(1);
  const goalTarget = Number(goals?.[0]?.target_value) || 0;
  const goalProgress = goalTarget > 0 ? Math.round((revenueMonth / goalTarget) * 100) : null;

  // Lost reasons
  const lostReasons: Record<string, number> = {};
  lostToday?.forEach((d: any) => { const r = d.lost_reason || 'Não informado'; lostReasons[r] = (lostReasons[r] ?? 0) + 1; });
  const topLostReasons = Object.entries(lostReasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v}x)`);

  return {
    wonToday: wonToday?.length ?? 0,
    lostToday: lostToday?.length ?? 0,
    newDeals: newDealsCount ?? 0,
    revenueToday: totalRevToday,
    // Vendas novas vs recorrências
    newSalesCount,
    newSalesRevenue,
    recurrenceCount,
    recurrenceRevenue,
    origins,
    topPartners,
    topReps,
    alerts,
    topLostReasons,
    revenueMonth,
    revenuePrevMonth: revenuePrev,
    momGrowth,
    dealsWonMonth: wonMonth?.length ?? 0,
    goalTarget,
    goalProgress,
    pipelineValue,
    pipelineCount: pipeline?.length ?? 0,
    conversionRate: (newDealsCount || 0) > 0 ? Math.round(((wonToday?.length ?? 0) / (newDealsCount || 1)) * 100) : 0,
    newLeadsToday,
    topNewSources,
    topRepsMonth,
  };
}

async function generateAIAnalysis(metrics: any, salesMetrics: any, dateStr: string, openaiKey: string): Promise<string> {
  const aiRate = metrics.totalConvs > 0 ? ((metrics.closedByAI / metrics.totalConvs) * 100).toFixed(1) : '0';
  const escRate = metrics.totalConvs > 0 ? ((metrics.escalatedToHuman / metrics.totalConvs) * 100).toFixed(1) : '0';

  const channelBreakdown = Object.entries(metrics.channelCounts ?? {}).map(([ch, cnt]) => `${ch}: ${cnt}`).join(', ') || 'N/A';

  const prompt = `Voce e o analista executivo da Parabellum. Sua funcao e gerar um relatorio de diagnostico DIRETO e ACIONAVEL. Nao seja gentil — seja preciso e honesto.

Este relatorio e DIARIO. Foque no que aconteceu HOJE e como melhorar AMANHA.

===== HOJE (${dateStr}) =====

INBOX & IA (PRIORIDADE MAXIMA):
- Total conversas HOJE: ${metrics.totalConvs} (por canal: ${channelBreakdown})
- Abertas agora: ${metrics.openTotal} | Fechadas: ${metrics.closedTotal} | Fila humana: ${metrics.waitingHumanConvs}
- IA autopilot: resolveu ${metrics.closedAutopilot}, ativas ${metrics.openAutopilot} (${aiRate}% resolucao)
- Copilot: ${metrics.closedCopilot + metrics.openCopilot} total (${metrics.closedCopilot} fechadas, ${metrics.openCopilot} abertas)
- Desabilitado: ${metrics.disabledConvs} (${metrics.closedDisabled} fechadas)
- Escaladas para humano: ${metrics.escalatedToHuman} (${escRate}%)
- Tempo medio de resolucao: ${metrics.avgResolutionMin ?? 'N/A'} minutos
- Eventos IA: ${metrics.totalAIEvents} | Msgs: ${metrics.totalMessages} (${metrics.aiMessages} da IA)
- CSAT hoje: ${metrics.csatAvg ? `${metrics.csatAvg}/5 (${metrics.csatCount} avaliacoes)` : 'Sem avaliacoes'}
- Anomalias criticas: ${metrics.criticalAnomalies?.length ?? 0}

VENDAS HOJE:
- Vendas novas (primeiro pagamento): ${salesMetrics.newSalesCount} | R$ ${salesMetrics.newSalesRevenue.toLocaleString('pt-BR')}
- Recorrencias (renovacoes): ${salesMetrics.recurrenceCount} | R$ ${salesMetrics.recurrenceRevenue.toLocaleString('pt-BR')}
- Total fechamentos: ${salesMetrics.wonToday} | Receita total: R$ ${salesMetrics.revenueToday.toLocaleString('pt-BR')}
- Perdidos: ${salesMetrics.lostToday}${salesMetrics.topLostReasons.length ? ' | Motivos: ' + salesMetrics.topLostReasons.join(', ') : ''}
- Novos deals abertos: ${salesMetrics.newDeals}
- Canais: ${salesMetrics.origins.map((o: any) => `${o.label} ${o.pct}%`).join(' | ')}
- Time comercial HOJE: ${salesMetrics.topReps.length > 0 ? salesMetrics.topReps.map((r: any) => `${r.name}: ${r.deals} deals`).join(', ') : 'Sem fechamentos hoje'}

PIPELINE HOJE:
- Novos leads capturados: ${salesMetrics.newLeadsToday}
- Por fonte: ${salesMetrics.topNewSources.join(' | ') || 'Nenhum'}

TAGS DE CONVERSAS HOJE:
${(metrics.topConversationTags ?? []).length > 0 ? (metrics.topConversationTags ?? []).map((t: any) => `- ${t.name}: ${t.count}x`).join('\n') : '- Nenhuma tag registrada'}

TICKETS HOJE:
- Total: ${metrics.ticketsTodayTotal} | Urgentes: ${metrics.ticketsByPriority?.urgent ?? 0} | Alta: ${metrics.ticketsByPriority?.high ?? 0} | Media: ${metrics.ticketsByPriority?.medium ?? 0} | Baixa: ${metrics.ticketsByPriority?.low ?? 0}
- Abertos: ${metrics.ticketsOpen ?? 0}
${(metrics.ticketsCategories ?? []).length > 0 ? '- Top categorias: ' + (metrics.ticketsCategories ?? []).map((c: any) => `${c.category} (${c.count})`).join(', ') : ''}
${(metrics.ticketsTopSubjects ?? []).length > 0 ? '- Top tickets urgentes/alta:\n' + (metrics.ticketsTopSubjects ?? []).map((t: any) => `  #${t.ticket_number} ${t.subject} (${t.priority})`).join('\n') : ''}

===== MES (acumulado) =====
- Receita mes: R$ ${salesMetrics.revenueMonth.toLocaleString('pt-BR')} / ${salesMetrics.goalProgress !== null ? salesMetrics.goalProgress + '% da meta' : 'sem meta'}
- MoM: ${salesMetrics.momGrowth !== null ? (salesMetrics.momGrowth >= 0 ? '+' : '') + salesMetrics.momGrowth + '%' : 'N/A'}
- Deals won mes: ${salesMetrics.dealsWonMonth}
- Time comercial mes: ${salesMetrics.topRepsMonth.length > 0 ? salesMetrics.topRepsMonth.map((r: any) => `${r.name}: ${r.deals} deals / R$${r.revenue}`).join(' | ') : 'Sem fechamentos no mes'}
- Alertas: ${salesMetrics.alerts.join(' | ') || 'Nenhum'}

PARAMETROS DE SAUDE (use para avaliar):
IA resolucao SAUDAVEL: acima de 60%, ATENCAO: 30-60%, CRITICO: abaixo de 30%
Escalacao SAUDAVEL: abaixo de 20%, ATENCAO: 20-35%, CRITICO: acima de 35%
Tempo medio SAUDAVEL: abaixo de 15 min, ATENCAO: 15-30 min, CRITICO: acima de 30 min

===== CONTEXTO DO SISTEMA =====
- ai_strict_rag_mode=${metrics.aiConfig?.strictRagMode ?? 'N/A'}, threshold=${metrics.aiConfig?.ragMinThreshold ?? 'N/A'}, confidence_direct=${metrics.aiConfig?.confidenceDirect ?? 'N/A'}, block_financial=${metrics.aiConfig?.blockFinancial ?? 'N/A'}
- KB: ${metrics.kbArticlesCount ?? 0} artigos ativos com embedding
- Top falhas IA: ${metrics.topFailReasons?.length > 0 ? metrics.topFailReasons.join(', ') : 'Nenhum registrado'}

===== INSTRUCOES =====

PRIORIZE: Inbox e IA sao mais importantes que vendas.
Se IA resolveu abaixo de 30% isso DEVE ser o [ATENCAO] principal.
FOQUE NO DIA: analise o que aconteceu HOJE e o que fazer AMANHA para melhorar.
IMPORTANTE: Distinga vendas novas de recorrencias. Recorrencias NAO sao vendas novas — sao renovacoes automaticas.
TAGS: Se houver tags frequentes, sugira acoes especificas para resolver os problemas mais comuns.
TICKETS: Se houver tickets urgentes/alta, priorize sugestoes para resolve-los amanha.

[DESTAQUES] — O MELHOR dado do DIA. Cite numero exato.
[ATENCAO] — Diagnostico TECNICO. Cite configs, nos do fluxo, gaps na KB. NUNCA diga "falta de treinamento".
[SUGESTOES] — 4 acoes: 1) TECNICA 2) CONTEUDO 3) COMERCIAL 4) Baseada nas tags frequentes ou tickets urgentes.
[MOTIVACIONAL] — Varie. Use dados reais do DIA.

FORMATO: [TAG] texto (uma vez por tag, sem markdown, max 3 frases por tag)`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1200, temperature: 0.7 }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices[0]?.message?.content ?? 'Não foi possível gerar análise.';
}

async function sendWhatsAppReport(supabase: any, phoneNumbers: string[], message: string): Promise<{ sent: number; errors: number }> {
  const { data: metaInstance } = await supabase.from('whatsapp_meta_instances').select('id, status').eq('status', 'active').limit(1).maybeSingle();
  if (!metaInstance) return { sent: 0, errors: phoneNumbers.length };

  let sent = 0, errors = 0;
  for (const phone of phoneNumbers) {
    try {
      const { error } = await supabase.functions.invoke('send-meta-whatsapp', {
        body: { instance_id: metaInstance.id, phone_number: phone.replace(/\D/g, ''), message, skip_db_save: true, is_bot_message: true },
      });
      if (error) errors++; else sent++;
    } catch { errors++; }
  }
  return { sent, errors };
}

async function sendEmailReport(
  supabase: any,
  adminEmail: string,
  adminName: string,
  dateStr: string,
  aiAnalysis: string,
  metrics: any,
  salesMetrics: any
): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.log('[ai-governor] ⚠️ RESEND_API_KEY não configurada, pulando email');
    return false;
  }

  // Buscar branding interno (employee) e sender padrão
  let sender: any = null;
  let branding: any = null;
  try {
    const [senderRes, brandingRes] = await Promise.all([
      supabase.from('email_senders').select('*').eq('is_default', true).single(),
      supabase.from('email_branding').select('*').eq('is_default_employee', true).single(),
    ]);
    sender = senderRes.data;
    branding = brandingRes.data;
  } catch {}

  const fromName = sender?.from_name || brandName || 'Parabellum by 3Cliques';
  const fromEmail = sender?.from_email || 'contato@mail.3cliques.net';
  const headerColor = branding?.header_color || '#0f172a';
  const headerColorEnd = headerColor + 'dd';
  const brandName = branding?.name || 'Parabellum by 3Cliques';
  const logoUrl = branding?.logo_url;
  const footerText = branding?.footer_text || 'Parabellum by 3Cliques • Gerado automaticamente';
  const footerLogoUrl = branding?.footer_logo_url;

  const aiRate = metrics.totalConvs > 0 ? Math.round((metrics.closedByAI / metrics.totalConvs) * 100) : 0;
  const escRate = metrics.totalConvs > 0 ? Math.round((metrics.escalatedToHuman / metrics.totalConvs) * 100) : 0;
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Formatar análise da IA em blocos estruturados
  function formatAnalysisHtml(text: string): string {
    const sectionMap: Record<string, { icon: string; title: string; color: string; bg: string; border: string }> = {
      '[DESTAQUES]': { icon: '', title: 'Destaques', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
      '[ATENCAO]':   { icon: '', title: 'Atencao', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      '[SUGESTOES]': { icon: '', title: 'Sugestoes', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      '[MOTIVACIONAL]': { icon: '', title: '', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
    };

    let html = '';
    const lines = text.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      let matched = false;

      for (const [tag, cfg] of Object.entries(sectionMap)) {
        if (trimmed.toUpperCase().includes(tag)) {
          const content = trimmed.replace(new RegExp(`\\${tag.replace('[', '\\[')}`, 'gi'), '').trim();
          if (tag === '[MOTIVACIONAL]') {
            html += `<div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:10px;padding:16px 20px;margin:8px 0;text-align:center;">
              <p style="color:${cfg.color};font-size:15px;font-weight:600;margin:0;font-style:italic;">${cfg.icon} ${content}</p>
            </div>`;
          } else {
            html += `<div style="background:${cfg.bg};border-left:4px solid ${cfg.color};border-radius:0 10px 10px 0;padding:14px 18px;margin:8px 0;">
              <p style="color:${cfg.color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">${cfg.icon} ${cfg.title}</p>
              <p style="color:#334155;font-size:14px;margin:0;line-height:1.6;">${content}</p>
            </div>`;
          }
          matched = true;
          break;
        }
      }

      // Fallback for unstructured lines
      if (!matched && trimmed.length > 2) {
        html += `<p style="color:#475569;font-size:14px;margin:6px 0;line-height:1.6;">${trimmed}</p>`;
      }
    }

    return html;
  }

  const analysisHtml = formatAnalysisHtml(aiAnalysis);

  // Progress bar for goal
  const goalProgressPct = Math.min(salesMetrics.goalProgress ?? 0, 100);
  const goalColor = goalProgressPct >= 80 ? '#22c55e' : goalProgressPct >= 50 ? '#f59e0b' : '#ef4444';

  const goalSection = salesMetrics.goalProgress !== null ? `
        <tr><td style="padding:0 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
            <tr>
              <td style="color:#64748b;font-size:13px;">Receita acumulada</td>
              <td style="color:${goalColor};font-size:13px;font-weight:700;text-align:right;">${salesMetrics.goalProgress}% da meta</td>
            </tr>
          </table>
          <div style="background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden;">
            <div style="background:${goalColor};height:10px;border-radius:99px;width:${goalProgressPct}%;"></div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
            <tr>
              <td style="color:#22c55e;font-size:14px;font-weight:700;">${fmtBRL(salesMetrics.revenueMonth)}</td>
              <td style="color:#94a3b8;font-size:13px;text-align:right;">Meta: ${fmtBRL(salesMetrics.goalTarget)}</td>
            </tr>
          </table>
        </td></tr>` : `
        <tr><td style="padding:0 32px 8px;text-align:center;">
          <div style="color:#22c55e;font-size:28px;font-weight:700;">${fmtBRL(salesMetrics.revenueMonth)}</div>
          <div style="color:#64748b;font-size:13px;margin-top:4px;">${salesMetrics.dealsWonMonth} deals fechados | ${salesMetrics.conversionRate}% conversão</div>
        </td></tr>`;

  // Build origins HTML section
  const originsHtml = (salesMetrics.origins ?? []).length > 0 ? `
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#8b5cf6;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">HOJE — Canais de Venda</p>
        </td></tr>
        <tr><td style="padding:0 32px 12px;">
          ${(salesMetrics.origins ?? []).map((o: any) => {
            const barColor = o.pct >= 40 ? '#ef4444' : o.pct >= 20 ? '#f59e0b' : '#3b82f6';
            return `<div style="margin-bottom:10px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#334155;font-size:13px;font-weight:600;">${o.label}</td>
                  <td style="color:#64748b;font-size:12px;text-align:right;">${o.pct}% · ${o.deals} deal${o.deals !== 1 ? 's' : ''} · ${fmtBRL(o.revenue)}</td>
                </tr>
              </table>
              <div style="background:#e2e8f0;border-radius:99px;height:6px;overflow:hidden;margin-top:4px;">
                <div style="background:${barColor};height:6px;border-radius:99px;width:${Math.min(o.pct, 100)}%;"></div>
              </div>
            </div>`;
          }).join('')}
          ${(salesMetrics.alerts ?? []).length > 0 ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-top:8px;">
            ${(salesMetrics.alerts ?? []).map((a: string) => `<p style="color:#92400e;font-size:12px;margin:2px 0;">${a}</p>`).join('')}
          </div>` : ''}
        </td></tr>` : '';

  // Build pipeline leads HTML section
  const pipelineLeadsHtml = salesMetrics.newLeadsToday > 0 ? `
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#2563eb;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">HOJE — Novos Leads (Pipeline)</p>
        </td></tr>
        <tr><td style="padding:0 32px 12px;">
          ${(salesMetrics.topNewSources ?? []).map((s: string) => `<p style="color:#334155;font-size:13px;margin:4px 0;">• ${s}</p>`).join('')}
          <p style="color:#1e293b;font-size:13px;font-weight:700;margin:8px 0 0;">Total: ${salesMetrics.newLeadsToday} leads entraram</p>
        </td></tr>` : '';

  // Build team performance HTML section (daily)
  const teamHtml = (salesMetrics.topReps ?? []).length > 0 ? `
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#3b82f6;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">HOJE — Performance do Time</p>
          <p style="font-size:11px;color:#94a3b8;margin:0 0 12px;">Fechamentos diretos do dia (atribuídos ao time)</p>
        </td></tr>
        <tr><td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#f8fafc;">
              <td style="padding:8px 12px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;">#</td>
              <td style="padding:8px 12px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;">Vendedor</td>
              <td style="padding:8px 12px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;text-align:center;">Deals</td>
              <td style="padding:8px 12px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;text-align:right;">Receita</td>
            </tr>
            ${(salesMetrics.topReps ?? []).map((r: any, i: number) => {
              const medal = `${i + 1}`;
              const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
              return `<tr style="background:${bg};">
                <td style="padding:10px 12px;font-size:14px;">${medal}</td>
                <td style="padding:10px 12px;color:#1e293b;font-size:13px;font-weight:600;">${r.name}</td>
                <td style="padding:10px 12px;color:#1e293b;font-size:13px;text-align:center;font-weight:700;">${r.deals}</td>
                <td style="padding:10px 12px;color:#16a34a;font-size:13px;text-align:right;font-weight:700;">${fmtBRL(r.revenue)}</td>
              </tr>`;
            }).join('')}
          </table>
        </td></tr>` : '';

  // Build monthly team performance HTML section
  const teamMonthHtml = (salesMetrics.topRepsMonth ?? []).length > 0 ? `
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">MES — Time Comercial</p>
          <p style="font-size:11px;color:#94a3b8;margin:0 0 12px;">Ranking acumulado no mês atual</p>
        </td></tr>
        <tr><td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr style="background:#fffbeb;">
              <td style="padding:8px 12px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;">#</td>
              <td style="padding:8px 12px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;">Vendedor</td>
              <td style="padding:8px 12px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;text-align:center;">Deals</td>
              <td style="padding:8px 12px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;text-align:right;">Receita</td>
            </tr>
            ${(salesMetrics.topRepsMonth ?? []).map((r: any, i: number) => {
              const medal = `${i + 1}`;
              const bg = i % 2 === 0 ? '#ffffff' : '#fffbeb';
              return `<tr style="background:${bg};">
                <td style="padding:10px 12px;font-size:14px;">${medal}</td>
                <td style="padding:10px 12px;color:#1e293b;font-size:13px;font-weight:600;">${r.name}</td>
                <td style="padding:10px 12px;color:#1e293b;font-size:13px;text-align:center;font-weight:700;">${r.deals}</td>
                <td style="padding:10px 12px;color:#16a34a;font-size:13px;text-align:right;font-weight:700;">${fmtBRL(r.revenue)}</td>
              </tr>`;
            }).join('')}
          </table>
        </td></tr>` : '';

  // MoM section
  const momHtml = salesMetrics.momGrowth !== null ? `
        <p style="color:#64748b;font-size:12px;margin:4px 0 0;">
          MoM: <strong style="color:${salesMetrics.momGrowth >= 0 ? '#16a34a' : '#dc2626'};">${salesMetrics.momGrowth > 0 ? '+' : ''}${salesMetrics.momGrowth}%</strong> vs mes anterior
        </p>` : '';

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${headerColor} 0%,${headerColorEnd} 100%);padding:32px 32px 28px;text-align:center;">
          ${logoUrl 
            ? `<img src="${logoUrl}" alt="${brandName}" style="max-height:40px;max-width:200px;margin-bottom:8px;" />`
            : ''
          }
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Report Diário CRM 3Cliques</h1>
          <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Relatório ${dateStr}</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:24px 32px 16px;">
          <p style="color:#1e293b;font-size:15px;margin:0;">Ola, ${adminName}!</p>
        </td></tr>

        <!-- HOJE — Atendimento -->
        <tr><td style="padding:0 32px 6px;">
          <p style="color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">HOJE — Atendimento</p>
        </td></tr>
        <tr><td style="padding:0 32px 12px;">
          <table width="100%" cellpadding="0" cellspacing="6">
            <tr>
              <td style="background:#f8fafc;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#6366f1;font-size:28px;font-weight:800;line-height:1;">${metrics.totalConvs}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Conversas</div>
              </td>
              <td style="background:#f8fafc;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#22c55e;font-size:28px;font-weight:800;line-height:1;">${metrics.closedByAI}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Resolvidas IA (${aiRate}%)</div>
              </td>
              <td style="background:#f8fafc;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#f97316;font-size:28px;font-weight:800;line-height:1;">${metrics.escalatedToHuman}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Escaladas (${escRate}%)</div>
              </td>
              <td style="background:#f8fafc;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#8b5cf6;font-size:28px;font-weight:800;line-height:1;">${metrics.totalAIEvents}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Eventos IA</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Sub-metrics detalhados -->
        <tr><td style="padding:0 32px 20px;">
          <p style="color:#64748b;font-size:12px;margin:0;line-height:1.8;">
            Abertas agora: <strong style="color:#1e293b;">${metrics.openTotal}</strong> | Fechadas: <strong style="color:#1e293b;">${metrics.closedTotal}</strong> | Fila humana: <strong style="color:#dc2626;">${metrics.waitingHumanConvs}</strong><br/>
            Autopilot: resolveu <strong style="color:#22c55e;">${metrics.closedAutopilot}</strong>, ativas ${metrics.openAutopilot} | Copilot: <strong style="color:#1e293b;">${metrics.copilotConvs}</strong> | Desabilitado: ${metrics.disabledConvs}<br/>
            Tempo medio: <strong style="color:#1e293b;">${metrics.avgResolutionMin ? `${metrics.avgResolutionMin} min` : '—'}</strong> | Msgs: <strong style="color:#1e293b;">${metrics.totalMessages}</strong> (${metrics.aiMessages} da IA)
            ${metrics.csatAvg ? `<br/>CSAT hoje: <strong style="color:#f59e0b;">${metrics.csatAvg}/5</strong> (${metrics.csatCount} avaliacoes)` : ''}
            ${(metrics.criticalAnomalies?.length ?? 0) > 0 ? `<br/>Anomalias: <strong style="color:#dc2626;">${metrics.criticalAnomalies.length} criticas</strong>` : ''}
          </p>
        </td></tr>

        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- HOJE — Vendas (separadas) -->
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#22c55e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">HOJE — Vendas</p>
        </td></tr>
        <tr><td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="6">
            <tr>
              <td style="background:#f0fdf4;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #bbf7d0;">
                <div style="color:#16a34a;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.newSalesCount}</div>
                <div style="color:#16a34a;font-size:13px;font-weight:700;margin-top:4px;">${fmtBRL(salesMetrics.newSalesRevenue)}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Vendas Novas</div>
              </td>
              <td style="background:#eff6ff;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #bfdbfe;">
                <div style="color:#2563eb;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.recurrenceCount}</div>
                <div style="color:#2563eb;font-size:13px;font-weight:700;margin-top:4px;">${fmtBRL(salesMetrics.recurrenceRevenue)}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Recorrencias</div>
              </td>
              <td style="background:#fef2f2;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #fecaca;">
                <div style="color:#dc2626;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.lostToday}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:6px;font-weight:600;text-transform:uppercase;">Perdidos</div>
              </td>
              <td style="background:#f8fafc;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.newDeals}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:6px;font-weight:600;text-transform:uppercase;">Novos Deals</div>
              </td>
            </tr>
          </table>
          <p style="color:#64748b;font-size:11px;margin:8px 0 0;text-align:center;">
            Total: ${salesMetrics.wonToday} fechamentos | ${fmtBRL(salesMetrics.revenueToday)}
          </p>
        </td></tr>

        ${originsHtml}

        ${pipelineLeadsHtml}

        ${teamHtml}

        ${teamMonthHtml}

        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- MÊS — Performance Acumulada -->
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">MES — Performance Acumulada</p>
        </td></tr>
        ${goalSection}
        <tr><td style="padding:8px 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="6">
            <tr>
              <td style="background:#f8fafc;border-radius:10px;padding:12px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:22px;font-weight:800;">${salesMetrics.dealsWonMonth}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Deals won/mês</div>
              </td>
              <td style="background:#f8fafc;border-radius:10px;padding:12px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:22px;font-weight:800;">${salesMetrics.conversionRate}%</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Conversão</div>
              </td>
              <td style="background:#f8fafc;border-radius:10px;padding:12px 8px;text-align:center;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:22px;font-weight:800;">${salesMetrics.pipelineCount}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Em pipeline</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Pipeline value + MoM -->
        <tr><td style="padding:0 32px 20px;">
          <p style="color:#64748b;font-size:12px;margin:0;">Pipeline: ${salesMetrics.pipelineCount} deals abertos — <strong style="color:#1e293b;">${fmtBRL(salesMetrics.pipelineValue)}</strong></p>
          ${momHtml}
        </td></tr>

        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Análise da IA -->
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#7c3aed;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0;">Analise da IA</p>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          ${analysisHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${headerColor};padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          ${footerLogoUrl ? `<img src="${footerLogoUrl}" alt="${brandName}" style="max-height:30px;margin-bottom:10px;" /><br/>` : ''}
          <p style="color:#94a3b8;font-size:11px;margin:0;">${footerText}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [adminEmail],
        subject: `Report Diario CRM 3Cliques - Relatorio ${dateStr}`,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ai-governor] ❌ Email falhou para ${adminEmail}: ${res.status} ${errText}`);
      return false;
    }

    const result = await res.json();
    console.log(`[ai-governor] ✅ Email enviado para ${adminEmail}: ${result.id}`);
    return true;
  } catch (err: any) {
    console.error(`[ai-governor] ❌ Email erro para ${adminEmail}: ${err.message}`);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    // Buscar admins com notify_ai_governor = true
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id, whatsapp_number, full_name, notify_ai_governor')
      .eq('notify_ai_governor', true);

    let adminPhones: string[] = [];
    const adminEmails: { email: string; name: string }[] = [];

    for (const p of (adminProfiles ?? [])) {
      const num = (p.whatsapp_number || '').replace(/\D/g, '');
      if (num.length >= 10) {
        adminPhones.push(num);
      }
      console.log(`[ai-governor] 👤 Admin notificado: ${p.full_name} → ***${num.slice(-4)}`);

      try {
        const { data: userData } = await supabase.auth.admin.getUserById(p.id);
        if (userData?.user?.email) {
          adminEmails.push({ email: userData.user.email, name: p.full_name || 'Admin' });
          console.log(`[ai-governor] 📧 Email encontrado: ${userData.user.email}`);
        }
      } catch (err: any) {
        console.log(`[ai-governor] ⚠️ Não conseguiu buscar email do admin ${p.id}: ${err.message}`);
      }
    }

    // Fallback: system_configurations
    if (adminPhones.length === 0) {
      const { data: cfg } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_governor_admin_phones')
        .maybeSingle();
      try { adminPhones = JSON.parse(cfg?.value ?? '[]'); } catch {}
    }

    // Override via body (testes)
    let bodyOverride: any = {};
    try { bodyOverride = await req.json(); } catch {}
    if (bodyOverride.admin_phones?.length) adminPhones = bodyOverride.admin_phones;
    if (bodyOverride.admin_emails?.length) {
      bodyOverride.admin_emails.forEach((e: string) => {
        if (!adminEmails.find(a => a.email === e)) {
          adminEmails.push({ email: e, name: 'Admin' });
        }
      });
    }

    console.log(`[ai-governor] 📱 ${adminPhones.length} WhatsApp(s), 📧 ${adminEmails.length} email(s) para notificar`);

    const forceToday = bodyOverride.force_today === true;
    const now = new Date();
    let since: Date, until: Date;

    if (forceToday) {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      until = now;
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      since = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      until = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }

    // Coletar métricas em paralelo
    const [metrics, salesMetrics] = await Promise.all([
      collectDayMetrics(supabase, since.toISOString(), until.toISOString()),
      collectSalesMetrics(supabase, since.toISOString(), until.toISOString()),
    ]);

    const dateStr = formatDate(since);
    const aiAnalysis = await generateAIAnalysis(metrics, salesMetrics, dateStr, openaiKey);

    // WhatsApp message
    const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toLocaleString('pt-BR')}`;
    const channelsSummary = (salesMetrics.origins ?? []).map((o: any) => `${o.emoji} ${o.label}: ${o.pct}% (${o.deals})`).join('\n');

    // Canal breakdown
    const channelBreakdownWa = Object.entries(metrics.channelCounts ?? {}).map(([ch, cnt]) => `${ch} ${cnt}`).join(', ') || 'N/A';

    // ═══ HOJE — Atendimento (detalhado) ═══
    const inboxSummary = [
      `📞 *HOJE — Atendimento*`,
      `Conversas: ${metrics.totalConvs} (${channelBreakdownWa})`,
      `Abertas agora: ${metrics.openTotal} | Fechadas: ${metrics.closedTotal} | Fila humana: ${metrics.waitingHumanConvs}`,
      `IA autopilot: resolveu ${metrics.closedAutopilot}, ativas ${metrics.openAutopilot}`,
      `Copilot: ${metrics.copilotConvs} | Desabilitado: ${metrics.disabledConvs}`,
      `Tempo medio: ${metrics.avgResolutionMin ?? '—'} min`,
      `Eventos IA: ${metrics.totalAIEvents} | Msgs: ${metrics.totalMessages} (${metrics.aiMessages} da IA)`,
      metrics.csatAvg ? `CSAT hoje: ${metrics.csatAvg}/5 (${metrics.csatCount} avaliacoes)` : null,
      metrics.criticalAnomalies?.length > 0 ? `Anomalias: ${metrics.criticalAnomalies.length} criticas` : null,
    ].filter(Boolean).join('\n');

    // ═══ HOJE — Vendas (separadas) ═══
    const salesSummary = [
      `💰 *HOJE — Vendas*`,
      `Vendas novas: ${salesMetrics.newSalesCount} (${fmtK(salesMetrics.newSalesRevenue)})`,
      `Recorrencias: ${salesMetrics.recurrenceCount} (${fmtK(salesMetrics.recurrenceRevenue)})`,
      `Total: ${salesMetrics.wonToday} fechamentos | ${fmtK(salesMetrics.revenueToday)}`,
      `Perdidos: ${salesMetrics.lostToday} | Novos deals: ${salesMetrics.newDeals}`,
    ].join('\n');

    // ═══ HOJE — Pipeline ═══
    const pipelineSummaryToday = salesMetrics.newLeadsToday > 0
      ? `📥 *HOJE — Pipeline*\n${(salesMetrics.topNewSources ?? []).join('\n')}\nTotal: ${salesMetrics.newLeadsToday} leads entraram`
      : `📥 *HOJE — Pipeline*\nNenhum lead novo capturado`;

    // ═══ MÊS — Acumulado ═══
    const monthSummary = `📊 *MES — Acumulado*\nReceita: ${fmtK(salesMetrics.revenueMonth)}${salesMetrics.goalProgress !== null ? ` | Meta: ${salesMetrics.goalProgress}%` : ''}\nDeals won: ${salesMetrics.dealsWonMonth}${salesMetrics.momGrowth !== null ? ` | MoM: ${salesMetrics.momGrowth > 0 ? '+' : ''}${salesMetrics.momGrowth}%` : ''}`;

    // ═══ MÊS — Time Comercial ═══
    const teamMonthSummary = (salesMetrics.topRepsMonth ?? []).length > 0
      ? `👥 *MES — Time Comercial*\n` +
        (salesMetrics.topRepsMonth ?? []).slice(0, 5).map((r: any, i: number) =>
          `${i + 1}. ${r.name}: ${r.deals} deals | ${fmtK(r.revenue)}`
        ).join('\n')
      : `👥 *MES — Time Comercial*\nNenhum fechamento no mes ainda`;

    const channelsSummarySection = channelsSummary ? `\n📊 *Canais de Venda (Hoje):*\n${channelsSummary}` : '';

    const fullMessage = `*Report Diario CRM 3Cliques — Relatorio ${dateStr}*\n${'─'.repeat(30)}\n\n${inboxSummary}\n\n${salesSummary}\n\n${pipelineSummaryToday}\n${channelsSummarySection}\n\n${monthSummary}\n\n${teamMonthSummary}${(salesMetrics.alerts ?? []).length > 0 ? `\n\n⚠️ *Alertas:*\n${(salesMetrics.alerts ?? []).join('\n')}` : ''}\n\n${'─'.repeat(30)}\n\n${aiAnalysis}\n\n${'─'.repeat(30)}\n_Parabellum by 3Cliques — ${now.toLocaleTimeString('pt-BR')}_`;

    const { data: savedReport } = await supabase.from('ai_governor_reports').insert({
      date: since.toISOString().split('T')[0],
      metrics_snapshot: { ...metrics, sales: salesMetrics },
      ai_analysis: aiAnalysis,
      sent_to_phones: adminPhones,
      generated_at: now.toISOString(),
    }).select('id').maybeSingle();

    // Enviar WhatsApp
    let whatsappResult = { sent: 0, errors: 0 };
    if (adminPhones.length > 0) {
      whatsappResult = await sendWhatsAppReport(supabase, adminPhones, fullMessage);
    }

    // Enviar Email
    let emailResult = { sent: 0, errors: 0 };
    for (const admin of adminEmails) {
      const ok = await sendEmailReport(supabase, admin.email, admin.name, dateStr, aiAnalysis, metrics, salesMetrics);
      if (ok) emailResult.sent++; else emailResult.errors++;
    }

    console.log(`[ai-governor] 📊 Resultado: WhatsApp ${whatsappResult.sent}/${adminPhones.length} | Email ${emailResult.sent}/${adminEmails.length}`);

    return new Response(JSON.stringify({
      success: true,
      date: dateStr,
      metrics: {
        totalConvs: metrics.totalConvs, closedByAI: metrics.closedByAI,
        escalatedToHuman: metrics.escalatedToHuman, totalAIEvents: metrics.totalAIEvents,
        sales: salesMetrics,
      },
      aiAnalysisPreview: aiAnalysis.slice(0, 300),
      whatsapp: whatsappResult,
      email: emailResult,
      reportId: savedReport?.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error(`[ai-governor] ❌ Erro geral: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
