import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  report_type: string;
  filters: {
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    agentId?: string;
    status?: string;
    pipelineId?: string;
  };
  format: 'csv' | 'pdf';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { report_type, filters, format }: ReportRequest = await req.json();
    console.log('[generate-report] Starting:', { report_type, filters, format });

    // Validação de inputs
    if (!report_type) {
      throw new Error('report_type é obrigatório');
    }

    if (!format || !['csv', 'pdf'].includes(format)) {
      throw new Error('format deve ser "csv" ou "pdf"');
    }

    let data: any[] = [];
    let fileName = '';

    // Generate report based on type
    switch (report_type) {
      case 'tickets_all':
        data = await generateTicketsReport(supabaseClient, filters);
        fileName = `tickets_${Date.now()}`;
        break;
      
      case 'agent_performance':
        data = await generateAgentPerformanceReport(supabaseClient, filters);
        fileName = `agent_performance_${Date.now()}`;
        break;
      
      case 'csat_survey':
        data = await generateCSATReport(supabaseClient, filters);
        fileName = `csat_survey_${Date.now()}`;
        break;
      
      case 'deals_won_lost':
        data = await generateDealsReport(supabaseClient, filters);
        fileName = `deals_${Date.now()}`;
        break;
      
      case 'commissions':
        data = await generateCommissionsReport(supabaseClient, filters);
        fileName = `commissions_${Date.now()}`;
        break;
      
      case 'lost_reasons':
        data = await generateLostReasonsReport(supabaseClient, filters);
        fileName = `lost_reasons_${Date.now()}`;
        break;
      
      case 'stuck_customers':
        data = await generateStuckCustomersReport(supabaseClient, filters);
        fileName = `stuck_customers_${Date.now()}`;
        break;
      
      case 'completion_times':
        data = await generateCompletionTimesReport(supabaseClient, filters);
        fileName = `completion_times_${Date.now()}`;
        break;
      
      case 'conversation_history':
        data = await generateConversationHistoryReport(supabaseClient, filters);
        fileName = `conversations_${Date.now()}`;
        break;
      
      case 'unanswered_questions':
        data = await generateUnansweredQuestionsReport(supabaseClient, filters);
        fileName = `unanswered_${Date.now()}`;
        break;
      
      case 'team_goals_performance':
        data = await generateTeamGoalsPerformanceReport(supabaseClient, filters);
        fileName = `team_goals_${Date.now()}`;
        break;
      
      case 'kiwify_detailed_sales':
        data = await generateKiwifyDetailedSalesReport(supabaseClient, filters);
        fileName = `kiwify_sales_${Date.now()}`;
        break;
      
      case 'affiliate_commissions':
        data = await generateAffiliateCommissionsReport(supabaseClient, filters);
        fileName = `affiliate_commissions_${Date.now()}`;
        break;
      
      case 'margin_analysis':
        data = await generateMarginAnalysisReport(supabaseClient, filters);
        fileName = `margin_analysis_${Date.now()}`;
        break;
      
      case 'deals_conversion_analysis':
        data = await generateDealsConversionAnalysisReport(supabaseClient, filters);
        fileName = `deals_conversion_${Date.now()}`;
        break;
      
      default:
        throw new Error(`Unknown report type: ${report_type}`);
    }

    console.log('[generate-report] Data fetched:', data?.length || 0, 'rows');

    // Fallback para dados vazios
    if (!data || data.length === 0) {
      console.warn('[generate-report] No data found for filters:', filters);
      
      // Retornar CSV vazio com mensagem
      if (format === 'csv') {
        const emptyCSV = 'Sem dados para os filtros selecionados';
        return new Response(emptyCSV, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${fileName}.csv"`,
          },
        });
      }
    }

    if (format === 'csv') {
      const csv = convertToCSV(data);
      console.log('[generate-report] CSV generated, length:', csv.length);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      });
    } else {
      // For PDF, return JSON for now (can be enhanced with PDF generation library)
      return new Response(JSON.stringify({ data, fileName }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error: any) {
    console.error('[generate-report] ERROR:', error);
    console.error('[generate-report] Stack:', error.stack);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao gerar relatório';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.stack,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Report generation functions
async function generateTicketsReport(supabase: any, filters: any) {
  const { startDate, endDate, departmentId, agentId } = filters;
  
  console.log('[tickets_all] Starting with filters:', { startDate, endDate, departmentId, agentId });
  
  let query = supabase
    .from('tickets')
    .select(`
      id, subject, status, priority, category,
      created_at, first_response_at, resolved_at,
      contacts:customer_id (first_name, last_name, email),
      profiles:assigned_to (full_name),
      departments:department_id (name)
    `);

  if (startDate) {
    console.log('[tickets_all] Filtering by startDate:', startDate);
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    console.log('[tickets_all] Filtering by endDate:', endDate);
    query = query.lte('created_at', endDate);
  }
  if (departmentId && departmentId !== '') {
    console.log('[tickets_all] Filtering by departmentId:', departmentId);
    query = query.eq('department_id', departmentId);
  }
  if (agentId && agentId !== '') {
    console.log('[tickets_all] Filtering by agentId:', agentId);
    query = query.eq('assigned_to', agentId);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('[tickets_all] Query error:', error);
    throw error;
  }
  
  console.log(`[tickets_all] Found ${data?.length || 0} tickets`);
  
  if (!data || data.length === 0) {
    console.log('[tickets_all] No tickets found, returning empty array with headers');
    return [];
  }

  return data.map((t: any) => ({
    id: t.id,
    assunto: t.subject,
    status: t.status,
    prioridade: t.priority,
    categoria: t.category,
    cliente: `${t.contacts?.first_name || ''} ${t.contacts?.last_name || ''}`.trim(),
    email_cliente: t.contacts?.email || '',
    agente: t.profiles?.full_name || 'Não atribuído',
    departamento: t.departments?.name || 'N/A',
    criado_em: t.created_at,
    primeira_resposta: t.first_response_at || '',
    resolvido_em: t.resolved_at || '',
  }));
}

async function generateAgentPerformanceReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('tickets')
    .select(`
      assigned_to,
      status,
      first_response_at,
      resolved_at,
      created_at,
      profiles:assigned_to (full_name)
    `);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by agent
  const agentStats: any = {};
  data.forEach((t: any) => {
    const agentId = t.assigned_to || 'unassigned';
    if (!agentStats[agentId]) {
      agentStats[agentId] = {
        agent: t.profiles?.full_name || 'Não atribuído',
        total_tickets: 0,
        resolved: 0,
        frt_times: [],
        resolution_times: [],
      };
    }
    
    agentStats[agentId].total_tickets++;
    if (t.status === 'resolved') agentStats[agentId].resolved++;
    
    if (t.first_response_at && t.created_at) {
      const frt = (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60);
      agentStats[agentId].frt_times.push(frt);
    }
    
    if (t.resolved_at && t.created_at) {
      const rt = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60);
      agentStats[agentId].resolution_times.push(rt);
    }
  });

  return Object.values(agentStats).map((stats: any) => ({
    agent: stats.agent,
    total_tickets: stats.total_tickets,
    resolved: stats.resolved,
    avg_frt_minutes: stats.frt_times.length > 0 
      ? Math.round(stats.frt_times.reduce((a: number, b: number) => a + b, 0) / stats.frt_times.length)
      : 0,
    avg_resolution_minutes: stats.resolution_times.length > 0
      ? Math.round(stats.resolution_times.reduce((a: number, b: number) => a + b, 0) / stats.resolution_times.length)
      : 0,
  }));
}

async function generateCSATReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('conversation_ratings')
    .select(`
      rating, feedback_text, channel, created_at,
      conversations:conversation_id (
        contacts:contact_id (first_name, last_name),
        profiles:assigned_to (full_name)
      )
    `);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((r: any) => ({
    rating: r.rating,
    feedback: r.feedback_text || '',
    channel: r.channel,
    created_at: r.created_at,
    customer: `${r.conversations?.contacts?.first_name || ''} ${r.conversations?.contacts?.last_name || ''}`.trim(),
    agent: r.conversations?.profiles?.full_name || 'N/A',
  }));
}

async function generateDealsReport(supabase: any, filters: any) {
  const { startDate, endDate, status, pipelineId } = filters;
  
  console.log('[deals_won_lost] Starting with filters:', { startDate, endDate, status, pipelineId });
  
  // ⚠️ LÓGICA TRAVADA: Deals ganhos/perdidos usam closed_at para filtro de período
  // Conforme docs/architecture/analytics-date-filter-rules.md
  
  // Buscar TODOS os deals usando paginação (limite padrão Supabase = 1000)
  const pageSize = 1000;
  let allDeals: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('deals')
      .select(`
        id, title, value, status, currency, lost_reason,
        created_at, closed_at, lead_email, lead_phone,
        contacts:contact_id (first_name, last_name, email, phone, kiwify_customer_id),
        profiles:assigned_to (full_name),
        stages:stage_id (name),
        pipelines:pipeline_id (name),
        products:product_id (name)
      `)
      .in('status', ['won', 'lost']) // Apenas deals ganhos e perdidos
      .order('closed_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Filtrar por closed_at (data de fechamento) - regra padrão para ganhos/perdidos
    if (startDate) query = query.gte('closed_at', startDate);
    if (endDate) query = query.lte('closed_at', endDate);
    
    // Apply pipeline filter
    if (pipelineId && pipelineId !== '') {
      console.log('[deals_won_lost] Filtering by pipelineId:', pipelineId);
      query = query.eq('pipeline_id', pipelineId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[deals_won_lost] Error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      allDeals = [...allDeals, ...data];
      offset += pageSize;
      hasMore = data.length === pageSize;
      console.log(`[deals_won_lost] Fetched page, total so far: ${allDeals.length}`);
    } else {
      hasMore = false;
    }
  }

  console.log('[deals_won_lost] Total deals fetched:', allDeals.length);

  if (allDeals.length === 0) {
    return [];
  }

  // Buscar todos os eventos Kiwify para status de pagamento e info de assinatura
  const { data: kiwifyEvents } = await supabase
    .from('kiwify_events')
    .select('order_id, event_type, created_at, customer_email, linked_deal_id, payload');

  // Criar mapa de eventos por deal_id e por email
  const dealEventMap = new Map();
  const emailEventMap = new Map();
  kiwifyEvents?.forEach((e: any) => {
    if (e.linked_deal_id) {
      dealEventMap.set(e.linked_deal_id, e);
    }
    if (e.customer_email) {
      emailEventMap.set(e.customer_email.toLowerCase(), e);
    }
  });

  return allDeals.map((d: any) => {
    // Buscar email: priorizar lead_email, depois contact email
    const email = d.lead_email || d.contacts?.email || '';
    const customerEmail = email?.toLowerCase();
    
    // Buscar evento Kiwify pelo deal_id ou email
    const kiwifyEvent = dealEventMap.get(d.id) || (customerEmail ? emailEventMap.get(customerEmail) : null);
    const commissionRate = 0.10; // 10% comissão
    
    // Determinar status de pagamento
    let statusPagamento = 'sem_vinculo';
    if (kiwifyEvent) {
      const eventType = kiwifyEvent.event_type;
      if (eventType === 'paid' || eventType === 'order_approved') {
        statusPagamento = 'paid';
      } else if (eventType === 'refunded') {
        statusPagamento = 'refunded';
      } else if (eventType === 'chargedback') {
        statusPagamento = 'chargedback';
      } else if (eventType === 'refund_requested') {
        statusPagamento = 'refund_requested';
      } else {
        statusPagamento = eventType;
      }
    }
    
    const isCancelled = ['refunded', 'chargedback', 'refund_requested'].includes(statusPagamento);
    
    // Determinar se é venda confirmada
    const eVenda = d.status === 'won' && statusPagamento === 'paid' ? 'Sim' : 'Não';
    
    // Determinar se é assinatura (tem subscription no payload ou produto recorrente)
    let eAssinatura = 'Não';
    if (kiwifyEvent?.payload) {
      const payload = kiwifyEvent.payload;
      const hasSubscription = payload?.Subscription?.plan?.id || payload?.subscription_id;
      const productName = payload?.Product?.product_name || d.products?.name || '';
      const isRecurring = 
        hasSubscription ||
        productName.toLowerCase().includes('mensal') ||
        productName.toLowerCase().includes('plano') ||
        productName.toLowerCase().includes('assinatura') ||
        productName.toLowerCase().includes('recorrente');
      
      if (isRecurring) {
        eAssinatura = 'Sim';
      }
    }
    
    // Determinar se é reembolso
    const eReembolso = ['refunded', 'chargedback'].includes(statusPagamento) ? 'Sim' : 'Não';
    
    // Extrair status da assinatura do payload Kiwify
    let statusAssinatura = '';
    if (kiwifyEvent?.payload) {
      const payload = kiwifyEvent.payload;
      
      // Primeiro tentar status da assinatura
      const subscriptionStatus = payload?.Subscription?.status;
      
      // Se não tiver, usar order_status como fallback (para vendas avulsas)
      const orderStatus = payload?.order_status;
      
      const statusFinal = subscriptionStatus || orderStatus;
      
      if (statusFinal) {
        const statusMap: Record<string, string> = {
          'active': 'Ativa',
          'canceled': 'Cancelada',
          'ended': 'Encerrada',
          'waiting_payment': 'Aguardando Pagamento',
          'failed': 'Falhou',
          'paid': 'Pago'
        };
        statusAssinatura = statusMap[statusFinal] || statusFinal;
      }
    }
    
    // Categoria geral
    let categoria = 'Perdido';
    if (eReembolso === 'Sim') {
      categoria = 'Reembolso';
    } else if (eVenda === 'Sim') {
      categoria = eAssinatura === 'Sim' ? 'Assinatura' : 'Venda';
    }
    
    return {
      // Campos principais
      email: email,
      data_criacao: d.created_at,
      nome: `${d.contacts?.first_name || ''} ${d.contacts?.last_name || ''}`.trim() || d.title,
      valor: d.value || 0,
      responsavel: d.profiles?.full_name || 'Não atribuído',
      produto: d.products?.name || 'Sem produto',
      telefone: d.lead_phone || d.contacts?.phone || '',
      status: d.status,
      status_pagamento: statusPagamento,
      
      // NOVAS COLUNAS - Classificação
      e_venda: eVenda,
      e_assinatura: eAssinatura,
      e_reembolso: eReembolso,
      categoria: categoria,
      status_assinatura: statusAssinatura,
      
      // Campos adicionais
      id: d.id,
      titulo_deal: d.title,
      moeda: d.currency || 'BRL',
      motivo_perda: d.lost_reason || '',
      etapa: d.stages?.name || '',
      pipeline: d.pipelines?.name || '',
      data_fechamento: d.closed_at || '',
      data_cancelamento: isCancelled ? kiwifyEvent?.created_at : '',
      comissao: (d.value || 0) * commissionRate,
      comissao_perdida: isCancelled ? (d.value || 0) * commissionRate : 0,
    };
  });
}

async function generateCommissionsReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('deals')
    .select(`
      id, title, value, currency, closed_at,
      contacts:contact_id (first_name, last_name),
      profiles:assigned_to (full_name),
      products:product_id (name, price)
    `)
    .eq('status', 'won');

  if (startDate) query = query.gte('closed_at', startDate);
  if (endDate) query = query.lte('closed_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((d: any) => ({
    deal_id: d.id,
    deal_title: d.title,
    deal_value: d.value,
    currency: d.currency,
    commission_10_percent: d.value * 0.1,
    sales_rep: d.profiles?.full_name || 'Não atribuído',
    customer: `${d.contacts?.first_name || ''} ${d.contacts?.last_name || ''}`.trim(),
    product: d.products?.name || '',
    closed_at: d.closed_at,
  }));
}

async function generateLostReasonsReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('deals')
    .select('lost_reason, value')
    .eq('status', 'lost');

  if (startDate) query = query.gte('closed_at', startDate);
  if (endDate) query = query.lte('closed_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by lost_reason
  const reasonStats: any = {};
  data.forEach((d: any) => {
    const reason = d.lost_reason || 'Não especificado';
    if (!reasonStats[reason]) {
      reasonStats[reason] = { count: 0, total_value: 0 };
    }
    reasonStats[reason].count++;
    reasonStats[reason].total_value += d.value || 0;
  });

  return Object.entries(reasonStats).map(([reason, stats]: [string, any]) => ({
    lost_reason: reason,
    count: stats.count,
    total_value_lost: stats.total_value,
  }));
}

async function generateStuckCustomersReport(supabase: any, filters: any) {
  const { data, error } = await supabase
    .from('customer_journey_steps')
    .select(`
      id, step_name, is_critical, created_at,
      contacts:contact_id (first_name, last_name, email, status)
    `)
    .eq('completed', false)
    .eq('is_critical', true);

  if (error) throw error;

  return data.map((s: any) => ({
    customer: `${s.contacts?.first_name || ''} ${s.contacts?.last_name || ''}`.trim(),
    email: s.contacts?.email || '',
    status: s.contacts?.status || '',
    step_name: s.step_name,
    stuck_since: s.created_at,
    days_stuck: Math.floor((Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

async function generateCompletionTimesReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('playbook_executions')
    .select(`
      id, started_at, completed_at, status,
      contacts:contact_id (first_name, last_name),
      onboarding_playbooks:playbook_id (name)
    `)
    .eq('status', 'completed');

  if (startDate) query = query.gte('started_at', startDate);
  if (endDate) query = query.lte('started_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((e: any) => ({
    customer: `${e.contacts?.first_name || ''} ${e.contacts?.last_name || ''}`.trim(),
    playbook: e.onboarding_playbooks?.name || '',
    started_at: e.started_at,
    completed_at: e.completed_at,
    days_to_complete: e.completed_at && e.started_at
      ? Math.floor((new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));
}

async function generateConversationHistoryReport(supabase: any, filters: any) {
  const { startDate, endDate, departmentId } = filters;
  
  let query = supabase
    .from('conversations')
    .select(`
      id, channel, status, created_at, closed_at,
      contacts:contact_id (first_name, last_name, email),
      profiles:assigned_to (full_name),
      departments:department (name)
    `);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (departmentId) query = query.eq('department', departmentId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((c: any) => ({
    id: c.id,
    channel: c.channel,
    status: c.status,
    customer: `${c.contacts?.first_name || ''} ${c.contacts?.last_name || ''}`.trim(),
    email: c.contacts?.email || '',
    agent: c.profiles?.full_name || 'Não atribuído',
    department: c.departments?.name || 'N/A',
    created_at: c.created_at,
    closed_at: c.closed_at,
  }));
}

async function generateUnansweredQuestionsReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('ai_usage_logs')
    .select(`
      id, created_at, result_data,
      conversations:conversation_id (
        contacts:contact_id (first_name, last_name)
      )
    `)
    .eq('feature_type', 'autopilot');

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  // Filter for handoff events (where AI couldn't answer)
  const handoffs = data.filter((log: any) => 
    log.result_data?.handoff === true || log.result_data?.escalated === true
  );

  return handoffs.map((log: any) => ({
    customer: `${log.conversations?.contacts?.first_name || ''} ${log.conversations?.contacts?.last_name || ''}`.trim(),
    escalated_at: log.created_at,
    reason: log.result_data?.reason || 'Sem resposta na base de conhecimento',
  }));
}

async function generateTeamGoalsPerformanceReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  // Parse month/year from startDate (format: YYYY-MM-DD)
  const date = startDate ? new Date(startDate) : new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  
  console.log('[team_goals_performance] Generating for:', { month, year });
  
  // Fetch all sales goals for the period
  const { data: salesGoals, error: salesGoalsError } = await supabase
    .from('sales_goals')
    .select(`
      *, 
      assigned_user:profiles!sales_goals_assigned_to_fkey(full_name)
    `)
    .eq('period_month', month)
    .eq('period_year', year)
    .eq('status', 'active');

  if (salesGoalsError) throw salesGoalsError;

  const performanceData: any[] = [];

  // Process sales goals
  for (const goal of salesGoals || []) {
    // Calculate realized value (deals won in period)
    const periodStart = new Date(year, month - 1, 1).toISOString();
    const periodEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select('value')
      .eq('assigned_to', goal.assigned_to)
      .eq('status', 'won')
      .gte('closed_at', periodStart)
      .lte('closed_at', periodEnd);

    if (dealsError) throw dealsError;

    const realizedValue = deals?.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0) || 0;
    const percentage = goal.target_value > 0 ? (realizedValue / goal.target_value) * 100 : 0;
    const commission = realizedValue * (goal.commission_rate / 100);
    
    let status = 'Abaixo';
    if (percentage >= 100) status = 'Bateu Meta 🏆';
    else if (percentage >= 75) status = 'No Ritmo';

    performanceData.push({
      mes_referencia: `${String(month).padStart(2, '0')}/${year}`,
      nome: goal.assigned_user?.full_name || 'Usuário',
      cargo: 'Vendedor',
      meta_definida: goal.target_value,
      valor_realizado: realizedValue,
      percentual_atingimento: percentage.toFixed(1) + '%',
      comissao_bonus: commission,
      status,
    });
  }

  // Fetch all CS goals for the period
  const formattedMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const { data: csGoals, error: csGoalsError } = await supabase
    .from('cs_goals')
    .select('*')
    .eq('month', formattedMonth);

  if (csGoalsError) throw csGoalsError;

  // Process CS goals
  for (const goal of csGoals || []) {
    // Calculate current GMV
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('total_ltv, profiles:consultant_id(full_name)')
      .eq('consultant_id', goal.consultant_id)
      .eq('status', 'customer');

    if (contactsError) throw contactsError;

    const realizedValue = contacts?.reduce((sum: number, contact: any) => sum + (contact.total_ltv || 0), 0) || 0;
    const percentage = goal.target_gmv > 0 ? (realizedValue / goal.target_gmv) * 100 : 0;
    
    let status = 'Abaixo';
    if (percentage >= 100) status = 'Bateu Meta 🏆';
    else if (percentage >= 75) status = 'No Ritmo';

    performanceData.push({
      mes_referencia: `${String(month).padStart(2, '0')}/${year}`,
      nome: contacts?.[0]?.profiles?.full_name || 'Consultor',
      cargo: 'Consultor CS',
      meta_definida: goal.target_gmv,
      valor_realizado: realizedValue,
      percentual_atingimento: percentage.toFixed(1) + '%',
      comissao_bonus: goal.bonus_amount || 0,
      status,
    });
  }

  console.log(`[team_goals_performance] Generated ${performanceData.length} rows`);
  return performanceData;
}

async function generateKiwifyDetailedSalesReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  console.log('[kiwify_detailed_sales] Fetching from kiwify_events...');
  
  // Buscar eventos de pagamento do Kiwify
  let query = supabase
    .from('kiwify_events')
    .select('*')
    .in('event_type', ['paid', 'order_approved', 'refunded', 'chargedback']);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data: events, error } = await query;
  if (error) {
    console.error('[kiwify_detailed_sales] Error:', error);
    throw error;
  }
  
  console.log(`[kiwify_detailed_sales] Found ${events?.length || 0} events`);

  // Buscar ofertas mapeadas
  const { data: offers } = await supabase
    .from('product_offers')
    .select('kiwify_offer_id, offer_name, products:product_id(name)');
  
  const offerMap = new Map();
  offers?.forEach((o: any) => {
    offerMap.set(o.kiwify_offer_id, {
      offer_name: o.offer_name,
      product_name: o.products?.name || 'Produto não identificado'
    });
  });

  return (events || []).map((e: any) => {
    const payload = e.payload || {};
    const subscription = payload.Subscription || {};
    const charges = subscription.charges || {};
    const plan = subscription.plan || {};
    const customer = payload.Customer || {};
    const affiliate = payload.trackingParameters?.aff || payload.Affiliate || {};
    
    // Extrair valores financeiros
    const grossValue = parseFloat(charges.completed_at_value || plan.price || 0) / 100;
    const affiliateComm = parseFloat(payload.affiliate_commission || affiliate.commission_value || 0) / 100;
    const kiwifyFee = grossValue * 0.0899; // ~9% taxa Kiwify estimada
    const netValue = grossValue - kiwifyFee - affiliateComm;
    
    // Buscar nome da oferta
    const offerInfo = offerMap.get(e.offer_id) || { offer_name: 'Oferta não mapeada', product_name: 'Produto não identificado' };
    const offerName = payload.Product?.offer_name || plan.name || offerInfo.offer_name || 'N/A';
    const productName = payload.Product?.name || offerInfo.product_name || 'Produto não identificado';
    
    return {
      data: e.created_at,
      order_id: e.order_id,
      offer_id: e.offer_id || 'Sem ID',
      oferta: offerName,
      produto: productName,
      cliente: customer.full_name || payload.customer_name || '',
      email: e.customer_email || customer.email || '',
      cpf: customer.CPF || '',
      telefone: customer.phone || '',
      valor_bruto: grossValue,
      taxa_kiwify: kiwifyFee,
      comissao_afiliado: affiliateComm,
      valor_liquido: netValue,
      afiliado: affiliate.name || affiliate.email || 'Direto',
      status: e.event_type,
      linked_deal_id: e.linked_deal_id || '',
    };
  });
}

async function generateAffiliateCommissionsReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  console.log('[affiliate_commissions] Fetching from kiwify_events...');
  
  // Buscar eventos de pagamento
  let query = supabase
    .from('kiwify_events')
    .select('*')
    .in('event_type', ['paid', 'order_approved']);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data: events, error } = await query;
  if (error) {
    console.error('[affiliate_commissions] Error:', error);
    throw error;
  }
  
  console.log(`[affiliate_commissions] Found ${events?.length || 0} events`);

  // Agrupar por afiliado
  const affiliateMap = new Map<string, any>();
  
  (events || []).forEach((e: any) => {
    const payload = e.payload || {};
    const affiliate = payload.trackingParameters?.aff || payload.Affiliate || {};
    const subscription = payload.Subscription || {};
    const charges = subscription.charges || {};
    const plan = subscription.plan || {};
    
    const affiliateName = affiliate.name || affiliate.email || 'Venda Direta';
    const affiliateEmail = affiliate.email || 'N/A';
    const grossValue = parseFloat(charges.completed_at_value || plan.price || 0) / 100;
    const affiliateComm = parseFloat(payload.affiliate_commission || affiliate.commission_value || 0) / 100;
    
    if (!affiliateMap.has(affiliateName)) {
      affiliateMap.set(affiliateName, {
        afiliado: affiliateName,
        email: affiliateEmail,
        total_vendas: 0,
        valor_total_vendas: 0,
        comissao_total: 0,
      });
    }
    
    const aff = affiliateMap.get(affiliateName);
    aff.total_vendas++;
    aff.valor_total_vendas += grossValue;
    aff.comissao_total += affiliateComm;
  });

  return Array.from(affiliateMap.values()).sort((a, b) => b.comissao_total - a.comissao_total);
}

async function generateMarginAnalysisReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  console.log('[margin_analysis] Fetching from kiwify_events...');
  
  // Buscar eventos de pagamento
  let query = supabase
    .from('kiwify_events')
    .select('*')
    .in('event_type', ['paid', 'order_approved']);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data: events, error } = await query;
  if (error) {
    console.error('[margin_analysis] Error:', error);
    throw error;
  }
  
  console.log(`[margin_analysis] Found ${events?.length || 0} events`);

  // Buscar ofertas mapeadas
  const { data: offers } = await supabase
    .from('product_offers')
    .select('kiwify_offer_id, offer_name, products:product_id(name)');
  
  const offerMap = new Map();
  offers?.forEach((o: any) => {
    offerMap.set(o.kiwify_offer_id, {
      offer_name: o.offer_name,
      product_name: o.products?.name || 'Produto não identificado'
    });
  });

  // Agrupar por oferta (offer_id)
  const offerStatsMap = new Map<string, any>();
  
  (events || []).forEach((e: any) => {
    const payload = e.payload || {};
    const subscription = payload.Subscription || {};
    const charges = subscription.charges || {};
    const plan = subscription.plan || {};
    const affiliate = payload.trackingParameters?.aff || payload.Affiliate || {};
    
    const offerId = e.offer_id || 'sem_offer_id';
    const offerInfo = offerMap.get(offerId) || { offer_name: payload.Product?.offer_name || plan.name || 'Oferta não mapeada', product_name: payload.Product?.name || 'Produto não identificado' };
    
    const grossValue = parseFloat(charges.completed_at_value || plan.price || 0) / 100;
    const affiliateComm = parseFloat(payload.affiliate_commission || affiliate.commission_value || 0) / 100;
    const kiwifyFee = grossValue * 0.0899;
    const netValue = grossValue - kiwifyFee - affiliateComm;
    
    const key = offerId;
    
    if (!offerStatsMap.has(key)) {
      offerStatsMap.set(key, {
        offer_id: offerId,
        oferta: offerInfo.offer_name,
        produto: offerInfo.product_name,
        total_vendas: 0,
        valor_bruto: 0,
        taxas_kiwify: 0,
        comissoes_afiliados: 0,
        valor_liquido: 0,
      });
    }
    
    const stats = offerStatsMap.get(key);
    stats.total_vendas++;
    stats.valor_bruto += grossValue;
    stats.taxas_kiwify += kiwifyFee;
    stats.comissoes_afiliados += affiliateComm;
    stats.valor_liquido += netValue;
  });

  return Array.from(offerStatsMap.values()).map(p => ({
    ...p,
    ticket_medio: p.total_vendas > 0 ? (p.valor_bruto / p.total_vendas) : 0,
    margem_percentual: p.valor_bruto > 0 ? ((p.valor_liquido / p.valor_bruto) * 100).toFixed(1) + '%' : '0%',
  })).sort((a, b) => b.valor_bruto - a.valor_bruto);
}

// Deals Conversion Analysis Report
async function generateDealsConversionAnalysisReport(supabase: any, filters: any) {
  const { startDate, endDate, pipelineId } = filters;
  
  console.log('[deals_conversion_analysis] Starting with filters:', { startDate, endDate, pipelineId });
  
  let query = supabase
    .from('deals')
    .select('id, status, created_at, closed_at, value, pipeline_id, pipelines:pipeline_id(name)');

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (pipelineId && pipelineId !== '') query = query.eq('pipeline_id', pipelineId);

  const { data: deals, error } = await query;
  if (error) throw error;

  const totalCreated = deals?.length || 0;
  const wonDeals = deals?.filter((d: any) => d.status === 'won') || [];
  const lostDeals = deals?.filter((d: any) => d.status === 'lost') || [];
  const openDeals = deals?.filter((d: any) => d.status === 'open') || [];

  // Calculate time to win
  const timeToWinDays: number[] = [];
  wonDeals.forEach((deal: any) => {
    if (deal.closed_at && deal.created_at) {
      const days = Math.round(
        (new Date(deal.closed_at).getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days >= 0) timeToWinDays.push(days);
    }
  });

  // Calculate stats
  const avgTimeToWin = timeToWinDays.length > 0 
    ? Math.round(timeToWinDays.reduce((a, b) => a + b, 0) / timeToWinDays.length) 
    : 0;

  const sortedTimes = [...timeToWinDays].sort((a, b) => a - b);
  const medianTimeToWin = sortedTimes.length > 0
    ? (sortedTimes.length % 2 !== 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : Math.round((sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2))
    : 0;

  const minTimeToWin = sortedTimes.length > 0 ? sortedTimes[0] : 0;
  const maxTimeToWin = sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0;

  const createdToWonRate = totalCreated > 0 ? (wonDeals.length / totalCreated) * 100 : 0;
  const createdToLostRate = totalCreated > 0 ? (lostDeals.length / totalCreated) * 100 : 0;

  const totalValueWon = wonDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
  const totalValueLost = lostDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
  const totalValueOpen = openDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

  return [{
    periodo_inicio: startDate || 'Todos',
    periodo_fim: endDate || 'Todos',
    total_criados: totalCreated,
    total_ganhos: wonDeals.length,
    total_perdidos: lostDeals.length,
    total_abertos: openDeals.length,
    taxa_conversao_criados_ganhos: createdToWonRate.toFixed(2) + '%',
    taxa_perda_criados: createdToLostRate.toFixed(2) + '%',
    valor_total_ganhos: totalValueWon,
    valor_total_perdidos: totalValueLost,
    valor_total_abertos: totalValueOpen,
    tempo_medio_ciclo_dias: avgTimeToWin,
    tempo_mediano_ciclo_dias: medianTimeToWin,
    tempo_min_ciclo_dias: minTimeToWin,
    tempo_max_ciclo_dias: maxTimeToWin,
  }];
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  // Formato brasileiro: separador de colunas = ponto-e-vírgula
  const csvRows = [headers.join(';')];

  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header];
      
      // Converter números para formato brasileiro (vírgula decimal)
      if (typeof value === 'number') {
        value = value.toLocaleString('pt-BR', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
      }
      
      // Escapar aspas duplas e envolver em aspas
      const escaped = ('' + (value ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(';'));
  }

  return csvRows.join('\n');
}
