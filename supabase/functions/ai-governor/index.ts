import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function pct(num: number, den: number): string {
  if (den === 0) return '0%';
  return `${Math.round((num / den) * 100)}%`;
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

async function generateAIAnalysis(metrics: any, dateStr: string, openaiKey: string): Promise<string> {
  const prompt = `Você é a IA Governante do Parabellum, sistema de Customer Success.
Analise as métricas do dia ${dateStr} e gere relatório executivo CURTO para WhatsApp (máx 30 linhas).

MÉTRICAS:
- Conversas: ${metrics.totalConvs} | Fechadas pela IA: ${metrics.closedByAI} (${pct(metrics.closedByAI, metrics.totalConvs)})
- Escaladas para humano: ${metrics.escalatedToHuman} (${pct(metrics.escalatedToHuman, metrics.totalConvs)})
- Tempo médio resolução: ${metrics.avgResolutionMin ? `${metrics.avgResolutionMin} min` : 'sem dados'}
- Eventos de IA: ${metrics.totalAIEvents} | Diretos: ${metrics.directEvents} | Handoffs: ${metrics.fallbackEvents}
- Mensagens: ${metrics.totalMessages} (${metrics.aiMessages} da IA)
- Top eventos: ${metrics.topIntents.join(', ') || 'Sem dados'}
- Anomalias críticas: ${metrics.criticalAnomalies.length} | Avisos: ${metrics.warningAnomalies.length}

FORMATO: Use emojis. Seções: 📊 Resumo | ✅ Destaques | ⚠️ Atenção | 💡 Sugestões
Termine com frase motivacional curta. Seja direto e prático.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.7 }),
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY não configurada');

    // Buscar admins com notify_ai_governor = true
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('whatsapp_number, full_name')
      .eq('notify_ai_governor', true);

    let adminPhones: string[] = [];
    adminProfiles?.forEach((p: any) => {
      const num = (p.whatsapp_number || '').replace(/\D/g, '');
      if (num.length >= 10) {
        adminPhones.push(num);
        console.log(`[ai-governor] 👤 Admin notificado: ${p.full_name} → ***${num.slice(-4)}`);
      }
    });

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

    console.log(`[ai-governor] 📱 ${adminPhones.length} admin(s) para notificar`);

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

    const metrics = await collectDayMetrics(supabase, since.toISOString(), until.toISOString());
    const aiAnalysis = await generateAIAnalysis(metrics, formatDate(since), openaiKey);

    const fullMessage = `🤖 *IA Governante — Relatório ${formatDate(since)}*\n${'─'.repeat(30)}\n\n${aiAnalysis}\n\n${'─'.repeat(30)}\n_Parabellum by 3Cliques — ${now.toLocaleTimeString('pt-BR')}_`;

    const { data: savedReport } = await supabase.from('ai_governor_reports').insert({
      date: since.toISOString().split('T')[0],
      metrics_snapshot: metrics,
      ai_analysis: aiAnalysis,
      sent_to_phones: adminPhones,
      generated_at: now.toISOString(),
    }).select('id').maybeSingle();

    let sendResult = { sent: 0, errors: 0 };
    if (adminPhones.length > 0) sendResult = await sendWhatsAppReport(supabase, adminPhones, fullMessage);

    return new Response(JSON.stringify({ success: true, date: formatDate(since), metrics: { totalConvs: metrics.totalConvs, closedByAI: metrics.closedByAI, escalatedToHuman: metrics.escalatedToHuman, totalAIEvents: metrics.totalAIEvents }, aiAnalysisPreview: aiAnalysis.slice(0, 200), whatsapp: sendResult, reportId: savedReport?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
