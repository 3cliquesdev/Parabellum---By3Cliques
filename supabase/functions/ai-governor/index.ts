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

  const closedWithTime = convs?.filter((c: any) => c.closed_at && c.created_at) ?? [];
  const avgResolutionMin = closedWithTime.length > 0
    ? Math.round(closedWithTime.reduce((sum: number, c: any) => {
        return sum + (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000;
      }, 0) / closedWithTime.length)
    : null;

  const { data: aiEvents } = await supabase
    .from('ai_events')
    .select('event_type, model, output_json, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(500);

  const totalAIEvents = aiEvents?.length ?? 0;
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

  return { totalConvs, closedByAI, escalatedToHuman, closedTotal, avgResolutionMin, totalAIEvents, fallbackEvents, directEvents, topIntents, criticalAnomalies, warningAnomalies, totalMessages: totalMessages ?? 0, aiMessages: aiMessages ?? 0 };
}

async function collectSalesMetrics(supabase: any, since: string, until: string) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Deals criados hoje
  const { data: dealsToday } = await supabase
    .from('deals')
    .select('id, title, value, status, closed_at, lost_reason, lead_source, is_organic_sale, gross_value')
    .gte('created_at', since)
    .lt('created_at', until);

  // Deals fechados (won) hoje
  const wonToday = dealsToday?.filter((d: any) => d.status === 'won') ?? [];
  const lostToday = dealsToday?.filter((d: any) => d.status === 'lost') ?? [];
  const newDeals = dealsToday?.length ?? 0;
  const revenueToday = wonToday.reduce((sum: number, d: any) => sum + (Number(d.gross_value || d.value) || 0), 0);

  // Pipeline total (deals abertos)
  const { data: pipeline } = await supabase
    .from('deals')
    .select('id, value, status, probability')
    .not('status', 'in', '("won","lost","cancelled")');

  const pipelineValue = pipeline?.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0) ?? 0;
  const pipelineCount = pipeline?.length ?? 0;

  // Motivos de perda do dia
  const lostReasons: Record<string, number> = {};
  lostToday.forEach((d: any) => {
    const reason = d.lost_reason || 'Não informado';
    lostReasons[reason] = (lostReasons[reason] ?? 0) + 1;
  });
  const topLostReasons = Object.entries(lostReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} (${v}x)`);

  // Performance do mês
  const { data: wonMonth } = await supabase
    .from('deals')
    .select('value, gross_value')
    .eq('status', 'won')
    .gte('closed_at', firstDayOfMonth);

  const revenueMonth = wonMonth?.reduce((sum: number, d: any) => sum + (Number(d.gross_value || d.value) || 0), 0) ?? 0;
  const dealsWonMonth = wonMonth?.length ?? 0;

  // Meta do mês
  const { data: goals } = await supabase
    .from('sales_goals')
    .select('title, target_value, goal_type')
    .eq('period_month', now.getMonth() + 1)
    .eq('period_year', now.getFullYear())
    .limit(5);

  const mainGoal = goals?.find((g: any) => g.goal_type === 'revenue') ?? goals?.[0];
  const goalTarget = Number(mainGoal?.target_value) || 0;
  const goalProgress = goalTarget > 0 ? Math.round((revenueMonth / goalTarget) * 100) : null;

  // Taxa de conversão do mês
  const { count: totalMonth } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', firstDayOfMonth);

  const conversionRate = (totalMonth ?? 0) > 0
    ? Math.round((dealsWonMonth / (totalMonth ?? 1)) * 100)
    : 0;

  return {
    newDeals,
    wonToday: wonToday.length,
    lostToday: lostToday.length,
    revenueToday,
    topLostReasons,
    dealsWonMonth,
    revenueMonth,
    goalTarget,
    goalProgress,
    conversionRate,
    pipelineCount,
    pipelineValue,
  };
}

async function generateAIAnalysis(metrics: any, salesMetrics: any, dateStr: string, openaiKey: string): Promise<string> {
  const prompt = `Você é a IA Governante do Parabellum, sistema de Customer Success e CRM.
Analise as métricas do dia ${dateStr} e gere relatório executivo CURTO para WhatsApp (máx 40 linhas).

📞 ATENDIMENTO:
- Conversas: ${metrics.totalConvs} | Fechadas pela IA: ${metrics.closedByAI} (${pct(metrics.closedByAI, metrics.totalConvs)})
- Escaladas para humano: ${metrics.escalatedToHuman} (${pct(metrics.escalatedToHuman, metrics.totalConvs)})
- Tempo médio resolução: ${metrics.avgResolutionMin ? `${metrics.avgResolutionMin} min` : 'sem dados'}
- Eventos de IA: ${metrics.totalAIEvents} | Diretos: ${metrics.directEvents} | Handoffs: ${metrics.fallbackEvents}
- Mensagens: ${metrics.totalMessages} (${metrics.aiMessages} da IA)
- Top eventos: ${metrics.topIntents.join(', ') || 'Sem dados'}
- Anomalias críticas: ${metrics.criticalAnomalies.length} | Avisos: ${metrics.warningAnomalies.length}

💰 VENDAS DO DIA:
- Novos deals: ${salesMetrics.newDeals}
- Ganhos: ${salesMetrics.wonToday} (${formatCurrency(salesMetrics.revenueToday)})
- Perdidos: ${salesMetrics.lostToday}
- Motivos de perda: ${salesMetrics.topLostReasons.join(', ') || 'Nenhum'}

📈 VENDAS DO MÊS:
- Deals ganhos no mês: ${salesMetrics.dealsWonMonth}
- Receita acumulada: ${formatCurrency(salesMetrics.revenueMonth)}
- Meta: ${salesMetrics.goalTarget > 0 ? `${formatCurrency(salesMetrics.goalTarget)} (${salesMetrics.goalProgress}% atingido)` : 'Sem meta definida'}
- Taxa de conversão: ${salesMetrics.conversionRate}%

📊 PIPELINE:
- Deals abertos: ${salesMetrics.pipelineCount}
- Valor total: ${formatCurrency(salesMetrics.pipelineValue)}

FORMATO: Use emojis. Seções: 📊 Resumo | 📞 Atendimento | 💰 Vendas | ✅ Destaques | ⚠️ Atenção | 💡 Sugestões
Termine com frase motivacional curta. Seja direto e prático.`;

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

  const aiRate = metrics.totalConvs > 0 ? Math.round((metrics.closedByAI / metrics.totalConvs) * 100) : 0;
  const escalationRate = metrics.totalConvs > 0 ? Math.round((metrics.escalatedToHuman / metrics.totalConvs) * 100) : 0;

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;">IA Governante</h1>
          <p style="color:#a0aec0;margin:8px 0 0;font-size:14px;">Relatório Executivo — ${dateStr}</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:32px 40px 16px;">
          <p style="color:#1a1a2e;font-size:16px;margin:0;">Olá, <strong>${adminName}</strong>!</p>
        </td></tr>

        <!-- Atendimento Metrics -->
        <tr><td style="padding:0 40px 24px;">
          <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px;">📞 Atendimento do Dia</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f0f4ff;border-radius:8px;padding:16px;text-align:center;width:25%;">
                <div style="color:#6366f1;font-size:28px;font-weight:bold;">${metrics.totalConvs}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Conversas</div>
              </td>
              <td width="8"></td>
              <td style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;width:25%;">
                <div style="color:#22c55e;font-size:28px;font-weight:bold;">${metrics.closedByAI}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Resolvidas IA (${aiRate}%)</div>
              </td>
              <td width="8"></td>
              <td style="background:#fff7ed;border-radius:8px;padding:16px;text-align:center;width:25%;">
                <div style="color:#f97316;font-size:28px;font-weight:bold;">${metrics.escalatedToHuman}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Escaladas (${escalationRate}%)</div>
              </td>
              <td width="8"></td>
              <td style="background:#faf5ff;border-radius:8px;padding:16px;text-align:center;width:25%;">
                <div style="color:#a855f7;font-size:28px;font-weight:bold;">${metrics.totalAIEvents}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Eventos IA</div>
              </td>
            </tr>
          </table>
          ${metrics.avgResolutionMin ? `<p style="color:#64748b;font-size:13px;margin:12px 0 0;">⏱️ Tempo médio de resolução: <strong>${metrics.avgResolutionMin} min</strong></p>` : ''}
          <p style="color:#64748b;font-size:13px;margin:4px 0 0;">💬 Mensagens: <strong>${metrics.totalMessages}</strong> (${metrics.aiMessages} da IA)</p>
        </td></tr>

        <!-- Sales Metrics -->
        <tr><td style="padding:0 40px 24px;">
          <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px;">💰 Vendas do Dia</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;width:33%;">
                <div style="color:#22c55e;font-size:28px;font-weight:bold;">${salesMetrics.wonToday}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Ganhos</div>
                <div style="color:#22c55e;font-size:13px;font-weight:bold;margin-top:4px;">${formatCurrency(salesMetrics.revenueToday)}</div>
              </td>
              <td width="8"></td>
              <td style="background:#fef2f2;border-radius:8px;padding:16px;text-align:center;width:33%;">
                <div style="color:#ef4444;font-size:28px;font-weight:bold;">${salesMetrics.lostToday}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Perdidos</div>
              </td>
              <td width="8"></td>
              <td style="background:#f0f4ff;border-radius:8px;padding:16px;text-align:center;width:33%;">
                <div style="color:#6366f1;font-size:28px;font-weight:bold;">${salesMetrics.newDeals}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Novos Deals</div>
              </td>
            </tr>
          </table>
          ${salesMetrics.topLostReasons.length > 0 ? `<p style="color:#64748b;font-size:13px;margin:12px 0 0;">❌ Motivos de perda: ${salesMetrics.topLostReasons.join(', ')}</p>` : ''}
        </td></tr>

        <!-- Monthly Performance -->
        <tr><td style="padding:0 40px 24px;">
          <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px;">📈 Performance do Mês</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;width:33%;">
                <div style="color:#22c55e;font-size:22px;font-weight:bold;">${formatCurrency(salesMetrics.revenueMonth)}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Receita Mês (${salesMetrics.dealsWonMonth} deals)</div>
              </td>
              <td width="8"></td>
              <td style="background:#f0f4ff;border-radius:8px;padding:16px;text-align:center;width:33%;">
                <div style="color:#6366f1;font-size:22px;font-weight:bold;">${salesMetrics.conversionRate}%</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Conversão</div>
              </td>
              <td width="8"></td>
              <td style="background:${salesMetrics.goalProgress !== null ? (salesMetrics.goalProgress >= 80 ? '#f0fdf4' : salesMetrics.goalProgress >= 50 ? '#fffbeb' : '#fef2f2') : '#f8fafc'};border-radius:8px;padding:16px;text-align:center;width:33%;">
                <div style="color:${salesMetrics.goalProgress !== null ? (salesMetrics.goalProgress >= 80 ? '#22c55e' : salesMetrics.goalProgress >= 50 ? '#f59e0b' : '#ef4444') : '#94a3b8'};font-size:22px;font-weight:bold;">${salesMetrics.goalProgress !== null ? `${salesMetrics.goalProgress}%` : '—'}</div>
                <div style="color:#64748b;font-size:11px;margin-top:4px;">Meta${salesMetrics.goalTarget > 0 ? ` (${formatCurrency(salesMetrics.goalTarget)})` : ''}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Pipeline -->
        <tr><td style="padding:0 40px 24px;">
          <div style="background:#f8fafc;border-radius:8px;padding:16px;display:flex;">
            <p style="color:#1a1a2e;font-size:14px;margin:0;">📊 <strong>Pipeline:</strong> ${salesMetrics.pipelineCount} deals abertos — ${formatCurrency(salesMetrics.pipelineValue)}</p>
          </div>
        </td></tr>

        <!-- AI Analysis -->
        <tr><td style="padding:0 40px 32px;">
          <div style="background:#f8fafc;border-radius:8px;border-left:4px solid #6366f1;padding:20px 24px;">
            <h3 style="color:#1a1a2e;font-size:16px;margin:0 0 12px;">🧠 Análise da IA</h3>
            <div style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-line;">${aiAnalysis.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</div>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">Parabellum by 3Cliques — Relatório gerado automaticamente</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Buscar sender padrão verificado do banco
  let fromName = 'IA Governante - 3Cliques';
  let fromEmail = 'contato@mail.3cliques.net';
  try {
    const { data: sender } = await supabase
      .from('email_senders')
      .select('from_name, from_email')
      .eq('is_default', true)
      .single();
    if (sender) fromEmail = sender.from_email;
  } catch {}

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [adminEmail],
        subject: `Relatório IA Governante — ${dateStr}`,
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

    const fullMessage = `*IA Governante — Relatório ${dateStr}*\n${'─'.repeat(30)}\n\n${aiAnalysis}\n\n${'─'.repeat(30)}\n_Parabellum by 3Cliques — ${now.toLocaleTimeString('pt-BR')}_`;

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
