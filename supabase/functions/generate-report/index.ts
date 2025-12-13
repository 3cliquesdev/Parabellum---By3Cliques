import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      
      default:
        throw new Error(`Unknown report type: ${report_type}`);
    }

    console.log('[generate-report] Data fetched:', data?.length || 0, 'rows');

    // Fallback para dados vazios
    if (!data || data.length === 0) {
      console.warn('[generate-report] No data found for filters:', filters);
      data = [];
    }

    if (format === 'csv') {
      const csv = convertToCSV(data);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
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
  
  let query = supabase
    .from('tickets')
    .select(`
      id, subject, status, priority, category,
      created_at, first_response_at, resolved_at,
      contacts:customer_id (first_name, last_name, email),
      profiles:assigned_to (full_name),
      departments:department_id (name)
    `);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (departmentId) query = query.eq('department_id', departmentId);
  if (agentId) query = query.eq('assigned_to', agentId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((t: any) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    category: t.category,
    customer_name: `${t.contacts?.first_name || ''} ${t.contacts?.last_name || ''}`.trim(),
    customer_email: t.contacts?.email || '',
    agent_name: t.profiles?.full_name || 'Não atribuído',
    department: t.departments?.name || 'N/A',
    created_at: t.created_at,
    first_response_at: t.first_response_at,
    resolved_at: t.resolved_at,
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
  const { startDate, endDate, status } = filters;
  
  let query = supabase
    .from('deals')
    .select(`
      id, title, value, status, currency, lost_reason,
      created_at, closed_at,
      contacts:contact_id (first_name, last_name, email, kiwify_customer_id),
      profiles:assigned_to (full_name),
      stages:stage_id (name),
      pipelines:pipeline_id (name)
    `);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;

  // Buscar eventos Kiwify de cancelamento/reembolso
  const { data: kiwifyEvents } = await supabase
    .from('kiwify_events')
    .select('order_id, event_type, created_at, customer_email')
    .in('event_type', ['refunded', 'chargedback', 'refund_requested']);

  // Criar mapa de cancelamentos por customer_email
  const cancelMap = new Map();
  kiwifyEvents?.forEach((e: any) => {
    if (e.customer_email) {
      cancelMap.set(e.customer_email.toLowerCase(), {
        event_type: e.event_type,
        cancelled_at: e.created_at
      });
    }
  });

  return data.map((d: any) => {
    const customerEmail = d.contacts?.email?.toLowerCase();
    const cancellation = customerEmail ? cancelMap.get(customerEmail) : null;
    const commissionRate = 0.10; // 10% comissão
    
    return {
      id: d.id,
      title: d.title,
      value: d.value || 0,
      currency: d.currency,
      status: d.status,
      lost_reason: d.lost_reason || '',
      customer: `${d.contacts?.first_name || ''} ${d.contacts?.last_name || ''}`.trim(),
      customer_email: d.contacts?.email || '',
      sales_rep: d.profiles?.full_name || 'Não atribuído',
      stage: d.stages?.name || '',
      pipeline: d.pipelines?.name || '',
      created_at: d.created_at,
      closed_at: d.closed_at,
      kiwify_status: cancellation ? cancellation.event_type : 'active',
      cancelled_at: cancellation?.cancelled_at || '',
      commission: (d.value || 0) * commissionRate,
      commission_lost: cancellation ? (d.value || 0) * commissionRate : 0,
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
  
  let query = supabase
    .from('deals')
    .select(`
      id, title, value, gross_value, net_value, kiwify_fee, affiliate_commission,
      status, currency, created_at, closed_at,
      contacts:contact_id (first_name, last_name, email, document),
      products:product_id (name)
    `)
    .in('status', ['won', 'lost'])
    .or('title.ilike.%Kiwify%,title.ilike.%Upsell%');

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((d: any) => ({
    id: d.id,
    data: d.created_at,
    cliente: `${d.contacts?.first_name || ''} ${d.contacts?.last_name || ''}`.trim(),
    email: d.contacts?.email || '',
    cpf_cnpj: d.contacts?.document || '',
    produto: d.products?.name || 'Produto não identificado',
    valor_bruto: d.gross_value || d.value || 0,
    valor_liquido: d.net_value || (d.value * 0.7) || 0,
    taxa_kiwify: d.kiwify_fee || 0,
    comissao_afiliado: d.affiliate_commission || 0,
    status: d.status,
  }));
}

async function generateAffiliateCommissionsReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('deals')
    .select('affiliate_commission, title, created_at')
    .eq('status', 'won')
    .gt('affiliate_commission', 0);

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  // Group by affiliate (extracted from title or metadata)
  const affiliateMap = new Map<string, any>();
  
  data.forEach((d: any) => {
    const affiliate = 'Afiliado'; // Placeholder - pode ser extraído do title ou metadata
    if (!affiliateMap.has(affiliate)) {
      affiliateMap.set(affiliate, {
        afiliado: affiliate,
        email: 'N/A',
        total_vendas: 0,
        comissao_total: 0,
      });
    }
    const aff = affiliateMap.get(affiliate);
    aff.total_vendas++;
    aff.comissao_total += d.affiliate_commission || 0;
  });

  return Array.from(affiliateMap.values());
}

async function generateMarginAnalysisReport(supabase: any, filters: any) {
  const { startDate, endDate } = filters;
  
  let query = supabase
    .from('deals')
    .select(`
      gross_value, net_value, kiwify_fee, affiliate_commission,
      products:product_id (name)
    `)
    .eq('status', 'won');

  if (startDate) query = query.gte('closed_at', startDate);
  if (endDate) query = query.lte('closed_at', endDate);

  const { data, error } = await query;
  if (error) throw error;

  // Group by product
  const productMap = new Map<string, any>();
  
  data.forEach((d: any) => {
    const productName = d.products?.name || 'Produto não identificado';
    if (!productMap.has(productName)) {
      productMap.set(productName, {
        produto: productName,
        total_vendas: 0,
        valor_bruto: 0,
        valor_liquido: 0,
        taxas: 0,
        comissoes: 0,
      });
    }
    const product = productMap.get(productName);
    product.total_vendas++;
    product.valor_bruto += d.gross_value || 0;
    product.valor_liquido += d.net_value || 0;
    product.taxas += d.kiwify_fee || 0;
    product.comissoes += d.affiliate_commission || 0;
  });

  return Array.from(productMap.values()).map(p => ({
    ...p,
    margem_percentual: p.valor_bruto > 0 ? ((p.valor_liquido / p.valor_bruto) * 100).toFixed(1) + '%' : '0%',
    taxa_media: p.total_vendas > 0 ? (p.taxas / p.total_vendas).toFixed(2) : 0,
  }));
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
