/**
 * ai-governor — IA Governante do Parabellum
 *
 * Analisa os eventos de IA do dia com OpenAI e envia
 * um relatório executivo via WhatsApp Meta API para admins.
 *
 * Acionado por pg_cron (diariamente às 18h) ou manualmente via POST.
 *
 * Tabelas lidas:
 *   - ai_events          (interações autopilot, flow, copilot)
 *   - conversations      (status, ai_mode, escalações)
 *   - messages           (volume de mensagens)
 *   - ai_anomaly_logs    (anomalias detectadas pelo check-ai-anomalies)
 *
 * Destino:
 *   - WhatsApp Meta API → números de admin em system_configurations.ai_governor_admin_phones
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pct(num: number, den: number): string {
  if (den === 0) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

// ─────────────────────────────────────────────
// COLETA DE MÉTRICAS DO DIA
// ─────────────────────────────────────────────

async function collectDayMetrics(supabase: any, since: string, until: string) {
  // 1. Conversas do dia
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, ai_mode, status, created_at, closed_at, channel')
    .gte('created_at', since)
    .lt('created_at', until);

  const totalConvs = convs?.length ?? 0;
  const closedByAI = convs?.filter((c: any) => c.status === 'closed' && c.ai_mode === 'autopilot').length ?? 0;
  const escalatedToHuman = convs?.filter((c: any) => c.ai_mode === 'waiting_human' || c.ai_mode === 'copilot').length ?? 0;
  const closedTotal = convs?.filter((c: any) => c.status === 'closed').length ?? 0;

  // Tempo médio de resolução (apenas fechadas com closed_at)
  const closedWithTime = convs?.filter((c: any) => c.closed_at && c.created_at) ?? [];
  const avgResolutionMin = closedWithTime.length > 0
    ? Math.round(
        closedWithTime.reduce((sum: number, c: any) => {
          return sum + (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000;
        }, 0) / closedWithTime.length
      )
    : null;

  // 2. Eventos de IA do dia
  const { data: aiEvents } = await supabase
    .from('ai_events')
    .select('event_type, model, output_json, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false })
    .limit(500);

  const totalAIEvents = aiEvents?.length ?? 0;
  const fallbackEvents = aiEvents?.filter((e: any) =>
    e.output_json?.action === 'handoff' || e.output_json?.escalated === true
  ).length ?? 0;
  const directEvents = aiEvents?.filter((e: any) =>
    e.output_json?.action === 'direct'
  ).length ?? 0;

  // Modelos utilizados
  const modelsUsed: Record<string, number> = {};
  aiEvents?.forEach((e: any) => {
    if (e.model) modelsUsed[e.model] = (modelsUsed[e.model] ?? 0) + 1;
  });

  // Top intents (event_type)
  const intentCount: Record<string, number> = {};
  aiEvents?.forEach((e: any) => {
    if (e.event_type) intentCount[e.event_type] = (intentCount[e.event_type] ?? 0) + 1;
  });
  const topIntents = Object.entries(intentCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v}x)`);

  // 3. Anomalias detectadas hoje
  const { data: anomalies } = await supabase
    .from('ai_anomaly_logs')
    .select('metric_type, severity, change_percent, current_value, previous_value, created_at')
    .gte('created_at', since)
    .lt('created_at', until);

  const criticalAnomalies = anomalies?.filter((a: any) => a.severity === 'critical') ?? [];
  const warningAnomalies = anomalies?.filter((a: any) => a.severity === 'warning') ?? [];

  // 4. Mensagens do dia
  const { count: totalMessages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .lt('created_at', until);

  const { count: aiMessages } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_ai_generated', true)
    .gte('created_at', since)
    .lt('created_at', until);

  return {
    totalConvs,
    closedByAI,
    escalatedToHuman,
    closedTotal,
    avgResolutionMin,
    totalAIEvents,
    fallbackEvents,
    directEvents,
    modelsUsed,
    topIntents,
    criticalAnomalies,
    warningAnomalies,
    totalMessages: totalMessages ?? 0,
    aiMessages: aiMessages ?? 0,
  };
}

// ─────────────────────────────────────────────
// GERAR ANÁLISE COM OPENAI
// ─────────────────────────────────────────────

async function generateAIAnalysis(metrics: any, dateStr: string, openaiKey: string): Promise<string> {
  const prompt = `Você é a IA Governante do Parabellum, um sistema de Customer Success.
Analise as métricas abaixo do dia ${dateStr} e gere um relatório executivo CURTO para WhatsApp (máx 30 linhas).

MÉTRICAS:
- Total de conversas: ${metrics.totalConvs}
- Fechadas pela IA (autopilot): ${metrics.closedByAI} (${pct(metrics.closedByAI, metrics.totalConvs)} do total)
- Escaladas para humano: ${metrics.escalatedToHuman} (${pct(metrics.escalatedToHuman, metrics.totalConvs)})
- Fechadas no total: ${metrics.closedTotal}
- Tempo médio de resolução: ${metrics.avgResolutionMin ? `${metrics.avgResolutionMin} min` : 'sem dados'}
- Total de eventos de IA: ${metrics.totalAIEvents}
- Respostas diretas (alta confiança): ${metrics.directEvents}
- Handoffs (baixa confiança): ${metrics.fallbackEvents}
- Total de mensagens: ${metrics.totalMessages} (${metrics.aiMessages} da IA)
- Top categorias de eventos: ${metrics.topIntents.join(', ') || 'Sem dados'}
- Anomalias críticas: ${metrics.criticalAnomalies.length}
- Anomalias de aviso: ${metrics.warningAnomalies.length}
${metrics.criticalAnomalies.length > 0 ? `- Detalhe anomalias críticas: ${metrics.criticalAnomalies.map((a: any) => `${a.metric_type} (${a.change_percent?.toFixed(0)}%)`).join(', ')}` : ''}

INSTRUÇÕES:
- Use emojis para facilitar leitura no WhatsApp
- Destaque os pontos positivos primeiro
- Identifique os principais problemas (se houver)
- Dê 1-2 sugestões práticas e específicas
- Se o dia foi bom, celebre brevemente
- Termine com uma frase motivacional curta
- Formate em seções: 📊 Resumo | ✅ Destaques | ⚠️ Atenção | 💡 Sugestões`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[ai-governor] OpenAI error:', err);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? 'Não foi possível gerar análise.';
}

// ─────────────────────────────────────────────
// ENVIAR VIA META WHATSAPP
// ─────────────────────────────────────────────

async function sendWhatsAppReport(
  supabase: any,
  phoneNumbers: string[],
  message: string
): Promise<{ sent: number; errors: number }> {
  // Buscar instância Meta ativa
  const { data: metaInstance } = await supabase
    .from('whatsapp_meta_instances')
    .select('id, phone_number_id, access_token, status')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!metaInstance) {
    console.error('[ai-governor] Nenhuma instância Meta WhatsApp ativa encontrada');
    return { sent: 0, errors: phoneNumbers.length };
  }

  let sent = 0;
  let errors = 0;

  for (const phone of phoneNumbers) {
    try {
      const { data, error } = await supabase.functions.invoke('send-meta-whatsapp', {
        body: {
          instance_id: metaInstance.id,
          phone_number: phone.replace(/\D/g, ''),
          message,
          skip_db_save: true,
          is_bot_message: true,
        },
      });

      if (error) {
        console.error(`[ai-governor] Erro ao enviar para ${phone}:`, error);
        errors++;
      } else {
        console.log(`[ai-governor] ✅ Relatório enviado para ${phone}`);
        sent++;
      }
    } catch (e) {
      console.error(`[ai-governor] Exceção ao enviar para ${phone}:`, e);
      errors++;
    }
  }

  return { sent, errors };
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ai-governor] 🚀 Iniciando relatório diário de IA...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    // ── Configurações dos admins ──
    const { data: adminPhonesConfig } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_governor_admin_phones')
      .maybeSingle();

    let adminPhones: string[] = [];
    try {
      adminPhones = JSON.parse(adminPhonesConfig?.value ?? '[]');
    } catch {
      console.warn('[ai-governor] ai_governor_admin_phones inválido, usando fallback vazio');
    }

    // Permitir override via body (para testes)
    let bodyOverride: any = {};
    try {
      bodyOverride = await req.json();
    } catch { /* sem body */ }

    if (bodyOverride.admin_phones?.length) {
      adminPhones = bodyOverride.admin_phones;
    }

    if (adminPhones.length === 0) {
      console.warn('[ai-governor] ⚠️ Nenhum número de admin configurado. Configure ai_governor_admin_phones no system_configurations.');
    }

    // ── Período: ontem 00h → hoje 00h (ou hoje se forçado) ──
    const forceToday = bodyOverride.force_today === true;
    const now = new Date();
    let since: Date;
    let until: Date;

    if (forceToday) {
      // Range: hoje 00h → agora
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      until = now;
    } else {
      // Range padrão: ontem 00h → hoje 00h
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      since = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      until = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    }

    const sinceISO = since.toISOString();
    const untilISO = until.toISOString();
    const dateStr = formatDate(since);

    console.log(`[ai-governor] 📅 Período: ${sinceISO} → ${untilISO}`);

    // ── Coletar métricas ──
    const metrics = await collectDayMetrics(supabase, sinceISO, untilISO);
    console.log('[ai-governor] 📊 Métricas coletadas:', {
      totalConvs: metrics.totalConvs,
      closedByAI: metrics.closedByAI,
      totalAIEvents: metrics.totalAIEvents,
      anomalies: metrics.criticalAnomalies.length + metrics.warningAnomalies.length,
    });

    // ── Gerar análise com IA ──
    const aiAnalysis = await generateAIAnalysis(metrics, dateStr, openaiKey);
    console.log('[ai-governor] ✅ Análise gerada pela IA');

    // ── Montar mensagem completa ──
    const header = `🤖 *IA Governante — Relatório ${dateStr}*\n${'─'.repeat(30)}\n\n`;
    const footer = `\n\n${'─'.repeat(30)}\n_Parabellum by 3Cliques_\n_Gerado automaticamente às ${now.toLocaleTimeString('pt-BR')}_`;
    const fullMessage = header + aiAnalysis + footer;

    // ── Salvar relatório no banco ──
    const { data: savedReport } = await supabase
      .from('ai_governor_reports')
      .insert({
        date: since.toISOString().split('T')[0],
        metrics_snapshot: metrics,
        ai_analysis: aiAnalysis,
        sent_to_phones: adminPhones,
        generated_at: now.toISOString(),
      })
      .select('id')
      .maybeSingle();

    console.log(`[ai-governor] 💾 Relatório salvo: ${savedReport?.id ?? 'erro ao salvar'}`);

    // ── Enviar via WhatsApp ──
    let sendResult = { sent: 0, errors: 0 };
    if (adminPhones.length > 0) {
      sendResult = await sendWhatsAppReport(supabase, adminPhones, fullMessage);
    }

    console.log(`[ai-governor] 📱 WhatsApp: ${sendResult.sent} enviados, ${sendResult.errors} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        metrics: {
          totalConvs: metrics.totalConvs,
          closedByAI: metrics.closedByAI,
          escalatedToHuman: metrics.escalatedToHuman,
          totalAIEvents: metrics.totalAIEvents,
          anomalies: metrics.criticalAnomalies.length + metrics.warningAnomalies.length,
        },
        aiAnalysisPreview: aiAnalysis.slice(0, 200) + '...',
        whatsapp: sendResult,
        reportId: savedReport?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ai-governor] ❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
