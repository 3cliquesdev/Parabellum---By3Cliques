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

  // Buscar branding interno (employee) e sender padrão
  let sender: any = null;
  try {
    const { data } = await supabase.from('email_senders').select('*').eq('is_default', true).single();
    sender = data;
  } catch {}

  const fromName = 'IA Governante';
  const fromEmail = sender?.from_email || 'contato@mail.3cliques.net';

  const aiRate = metrics.totalConvs > 0 ? Math.round((metrics.closedByAI / metrics.totalConvs) * 100) : 0;
  const escRate = metrics.totalConvs > 0 ? Math.round((metrics.escalatedToHuman / metrics.totalConvs) * 100) : 0;
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Formatar análise da IA em HTML limpo
  const analysisHtml = aiAnalysis
    .split('\n')
    .map(line => {
      if (line.startsWith('📊') || line.startsWith('✅') || line.startsWith('⚠️') || line.startsWith('💡') || line.startsWith('📞') || line.startsWith('💰') || line.startsWith('📈')) {
        return `<p style="font-weight:700;font-size:15px;color:#1e293b;margin:16px 0 6px 0;">${line}</p>`;
      }
      if (line.startsWith('•') || line.startsWith('-')) {
        return `<p style="color:#475569;font-size:14px;margin:2px 0 2px 12px;padding-left:8px;border-left:2px solid #e2e8f0;">${line.replace(/^[•\-]\s*/, '')}</p>`;
      }
      return line ? `<p style="color:#475569;font-size:14px;margin:4px 0;line-height:1.6;">${line}</p>` : '';
    })
    .join('');

  // Progress bar for goal
  const goalProgressPct = Math.min(salesMetrics.goalProgress ?? 0, 100);
  const goalColor = goalProgressPct >= 80 ? '#22c55e' : goalProgressPct >= 50 ? '#f59e0b' : '#ef4444';

  const goalSection = salesMetrics.goalProgress !== null ? `
        <!-- Goal Progress Bar -->
        <tr><td style="padding:0 40px 8px;">
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
        <!-- Revenue without goal -->
        <tr><td style="padding:0 40px 8px;text-align:center;">
          <div style="color:#22c55e;font-size:28px;font-weight:700;">${fmtBRL(salesMetrics.revenueMonth)}</div>
          <div style="color:#64748b;font-size:13px;margin-top:4px;">${salesMetrics.dealsWonMonth} deals fechados | ${salesMetrics.conversionRate}% conversão</div>
        </td></tr>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.06);">

        <!-- Hero Header -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);padding:40px 40px 36px;text-align:center;">
          <div style="width:56px;height:56px;background:rgba(99,102,241,0.15);border-radius:16px;display:inline-block;line-height:56px;font-size:28px;margin-bottom:12px;">🤖</div>
          <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">IA Governante</h1>
          <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;font-weight:400;">Relatório Executivo — ${dateStr}</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 40px 20px;">
          <p style="color:#1e293b;font-size:16px;margin:0;font-weight:500;">Olá, ${adminName}! 👋</p>
        </td></tr>

        <!-- Section: Atendimento -->
        <tr><td style="padding:0 40px 8px;">
          <p style="color:#6366f1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">📞 Atendimento do Dia</p>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="8">
            <tr>
              <td style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center;width:25%;border:1px solid #e2e8f0;">
                <div style="color:#6366f1;font-size:32px;font-weight:800;line-height:1;">${metrics.totalConvs}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Conversas</div>
              </td>
              <td style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center;width:25%;border:1px solid #e2e8f0;">
                <div style="color:#22c55e;font-size:32px;font-weight:800;line-height:1;">${aiRate}%</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Resolvido IA</div>
              </td>
              <td style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center;width:25%;border:1px solid #e2e8f0;">
                <div style="color:#f97316;font-size:32px;font-weight:800;line-height:1;">${escRate}%</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Escalado</div>
              </td>
              <td style="background:#f8fafc;border-radius:12px;padding:16px;text-align:center;width:25%;border:1px solid #e2e8f0;">
                <div style="color:#8b5cf6;font-size:32px;font-weight:800;line-height:1;">${metrics.avgResolutionMin ?? '—'}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:6px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Min Resolução</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Section: Vendas do Dia -->
        <tr><td style="padding:20px 40px 8px;">
          <p style="color:#22c55e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">💰 Vendas do Dia</p>
        </td></tr>
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="8">
            <tr>
              <td style="background:#f0fdf4;border-radius:12px;padding:16px;text-align:center;width:33%;border:1px solid #bbf7d0;">
                <div style="color:#16a34a;font-size:32px;font-weight:800;line-height:1;">${salesMetrics.wonToday}</div>
                <div style="color:#16a34a;font-size:14px;font-weight:700;margin-top:4px;">${fmtBRL(salesMetrics.revenueToday)}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:4px;font-weight:500;text-transform:uppercase;">Fechamentos</div>
              </td>
              <td style="background:#fef2f2;border-radius:12px;padding:16px;text-align:center;width:33%;border:1px solid #fecaca;">
                <div style="color:#dc2626;font-size:32px;font-weight:800;line-height:1;">${salesMetrics.lostToday}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:8px;font-weight:500;text-transform:uppercase;">Perdidos</div>
                ${salesMetrics.topLostReasons.length > 0 ? `<div style="color:#dc2626;font-size:11px;margin-top:4px;font-style:italic;">${salesMetrics.topLostReasons[0]}</div>` : ''}
              </td>
              <td style="background:#eff6ff;border-radius:12px;padding:16px;text-align:center;width:33%;border:1px solid #bfdbfe;">
                <div style="color:#2563eb;font-size:32px;font-weight:800;line-height:1;">${salesMetrics.newDeals}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:8px;font-weight:500;text-transform:uppercase;">Novos Deals</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Section: Performance do Mês -->
        <tr><td style="padding:20px 40px 8px;">
          <p style="color:#f59e0b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">📈 Performance do Mês</p>
        </td></tr>
        ${goalSection}

        <!-- Monthly mini-cards -->
        <tr><td style="padding:12px 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="8">
            <tr>
              <td style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;width:33%;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:24px;font-weight:800;">${salesMetrics.dealsWonMonth}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:4px;font-weight:500;text-transform:uppercase;">Deals won/mês</div>
              </td>
              <td style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;width:33%;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:24px;font-weight:800;">${salesMetrics.conversionRate}%</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:4px;font-weight:500;text-transform:uppercase;">Conversão</div>
              </td>
              <td style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;width:33%;border:1px solid #e2e8f0;">
                <div style="color:#1e293b;font-size:24px;font-weight:800;">${salesMetrics.pipelineCount}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:4px;font-weight:500;text-transform:uppercase;">Em pipeline</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- AI Analysis -->
        <tr><td style="padding:20px 40px 8px;">
          <p style="color:#8b5cf6;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0;">🧠 Análise da IA</p>
        </td></tr>
        <tr><td style="padding:8px 40px 32px;">
          <div style="background:#faf5ff;border-radius:12px;border:1px solid #e9d5ff;padding:24px;">
            ${analysisHtml}
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">Parabellum by 3Cliques • Gerado automaticamente</p>
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
        subject: `IA Governante — ${dateStr} | ${salesMetrics.wonToday} fechamentos · ${fmtBRL(salesMetrics.revenueToday)}`,
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
