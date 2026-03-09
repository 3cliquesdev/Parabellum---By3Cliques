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
  const prompt = `Você é a IA Governante do Parabellum, sistema de CRM e Customer Success.
Analise as métricas do dia ${dateStr} e gere um relatório executivo estruturado.

DADOS:
📞 ATENDIMENTO: Conversas: ${metrics.totalConvs} | Fechadas pela IA: ${metrics.closedByAI} (${pct(metrics.closedByAI, metrics.totalConvs)}) | Escaladas: ${metrics.escalatedToHuman} (${pct(metrics.escalatedToHuman, metrics.totalConvs)}) | Tempo médio resolução: ${metrics.avgResolutionMin ? `${metrics.avgResolutionMin} min` : 'sem dados'} | Eventos IA: ${metrics.totalAIEvents} (top: ${metrics.topIntents.join(', ') || 'Sem dados'}) | Anomalias: ${metrics.criticalAnomalies.length} críticas, ${metrics.warningAnomalies.length} avisos
💰 VENDAS DIA: Novos: ${salesMetrics.newDeals} | Ganhos: ${salesMetrics.wonToday} (${formatCurrency(salesMetrics.revenueToday)}) | Perdidos: ${salesMetrics.lostToday} | Motivos perda: ${salesMetrics.topLostReasons.join(', ') || 'Nenhum'}
📈 MÊS: Won: ${salesMetrics.dealsWonMonth} | Receita: ${formatCurrency(salesMetrics.revenueMonth)} | Meta: ${salesMetrics.goalTarget > 0 ? `${formatCurrency(salesMetrics.goalTarget)} (${salesMetrics.goalProgress}%)` : 'Sem meta'} | Conversão: ${salesMetrics.conversionRate}% | Pipeline: ${salesMetrics.pipelineCount} deals (${formatCurrency(salesMetrics.pipelineValue)})

FORMATO OBRIGATÓRIO - use EXATAMENTE estas seções, uma por linha, sem bullet points nem listas:
[DESTAQUES] Uma frase com os pontos positivos do dia.
[ATENCAO] Uma frase com pontos de atenção ou riscos.
[SUGESTOES] Uma frase com sugestões práticas de melhoria.
[MOTIVACIONAL] Uma frase motivacional curta.

Cada seção deve ter NO MÁXIMO 2 frases. Seja direto, prático e use dados reais.`;

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

  // Formatar análise da IA em blocos estruturados
  function formatAnalysisHtml(text: string): string {
    const sectionMap: Record<string, { icon: string; title: string; color: string; bg: string; border: string }> = {
      '[DESTAQUES]': { icon: '✅', title: 'Destaques', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
      '[ATENCAO]':   { icon: '⚠️', title: 'Atenção', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      '[SUGESTOES]': { icon: '💡', title: 'Sugestões', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      '[MOTIVACIONAL]': { icon: '🚀', title: '', color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff' },
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

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 28px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🤖</div>
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">IA Governante</h1>
          <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Relatório Executivo — ${dateStr}</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:24px 32px 16px;">
          <p style="color:#1e293b;font-size:15px;margin:0;">Olá, ${adminName}! 👋</p>
        </td></tr>

        <!-- Atendimento do Dia -->
        <tr><td style="padding:0 32px 6px;">
          <p style="color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">📞 Atendimento do Dia</p>
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
        <!-- Sub-metrics -->
        <tr><td style="padding:0 32px 20px;">
          <p style="color:#64748b;font-size:12px;margin:0;line-height:1.8;">
            ⏱ Tempo médio de resolução: <strong style="color:#1e293b;">${metrics.avgResolutionMin ? `${metrics.avgResolutionMin} min` : '—'}</strong><br/>
            💬 Mensagens: <strong style="color:#1e293b;">${metrics.totalMessages}</strong> (${metrics.aiMessages} da IA)
            ${metrics.topIntents.length > 0 ? `<br/>🔝 Top eventos: <strong style="color:#1e293b;">${metrics.topIntents.slice(0, 3).join(', ')}</strong>` : ''}
            ${(metrics.criticalAnomalies?.length ?? 0) > 0 ? `<br/>🔴 Anomalias: <strong style="color:#dc2626;">${metrics.criticalAnomalies.length} críticas</strong>` : ''}
          </p>
        </td></tr>

        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Vendas do Dia -->
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#22c55e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">💰 Vendas do Dia</p>
        </td></tr>
        <tr><td style="padding:0 32px 20px;">
          <table width="100%" cellpadding="0" cellspacing="6">
            <tr>
              <td style="background:#f0fdf4;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #bbf7d0;">
                <div style="color:#16a34a;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.wonToday}</div>
                <div style="color:#16a34a;font-size:13px;font-weight:700;margin-top:4px;">${fmtBRL(salesMetrics.revenueToday)}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:4px;font-weight:600;text-transform:uppercase;">Ganhos</div>
              </td>
              <td style="background:#fef2f2;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #fecaca;">
                <div style="color:#dc2626;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.lostToday}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:6px;font-weight:600;text-transform:uppercase;">Perdidos</div>
              </td>
              <td style="background:#eff6ff;border-radius:10px;padding:14px 8px;text-align:center;border:1px solid #bfdbfe;">
                <div style="color:#2563eb;font-size:28px;font-weight:800;line-height:1;">${salesMetrics.newDeals}</div>
                <div style="color:#94a3b8;font-size:10px;margin-top:6px;font-weight:600;text-transform:uppercase;">Novos Deals</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Performance do Mês -->
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#f59e0b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">📈 Performance do Mês</p>
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
        <!-- Pipeline value -->
        <tr><td style="padding:0 32px 20px;">
          <p style="color:#64748b;font-size:12px;margin:0;">📦 Pipeline: ${salesMetrics.pipelineCount} deals abertos — <strong style="color:#1e293b;">${fmtBRL(salesMetrics.pipelineValue)}</strong></p>
        </td></tr>

        <tr><td style="padding:0 32px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>

        <!-- Análise da IA -->
        <tr><td style="padding:16px 32px 6px;">
          <p style="color:#7c3aed;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0;">🧠 Análise da IA</p>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          ${analysisHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">Parabellum by 3Cliques • Gerado automaticamente</p>
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
