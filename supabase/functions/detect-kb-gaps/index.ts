import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[detect-kb-gaps] 🔍 Iniciando detecção de gaps na KB...');

    // Kill switch (cached)
    const aiConfig = await getAIConfig(supabase);
    if (!aiConfig.ai_global_enabled) {
      console.log('[detect-kb-gaps] 🚫 Kill Switch ativo');
      return new Response(JSON.stringify({ success: false, reason: 'kill_switch' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isShadowMode = aiConfig.ai_shadow_mode;
    console.log(`[detect-kb-gaps] Shadow Mode: ${isShadowMode ? 'ATIVO' : 'Inativo'}`);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ============================================
    // FONTE 1: ai_events — falhas de IA (handoffs, blocos, saídas)
    // ============================================
    const { data: gapEvents, error } = await supabase
      .from('ai_events')
      .select('id, entity_id, event_type, input_summary, output_json, department_id, created_at')
      .in('event_type', [
        'ai_handoff_exit',              // IA transferiu para humano
        'contract_violation_blocked',   // IA tentou escapar contrato
        'flow_exit_clean',              // IA pediu saída do fluxo
        'ai_exit_intent',               // intenção de saída detectada
        'kb_no_match',                  // Nenhum artigo encontrado
        'low_confidence_fallback',      // Confiança muito baixa → fallback
        'ai_response_escalated',        // Resposta escalada para humano
      ])
      .gte('created_at', yesterday)
      .not('input_summary', 'is', null)
      .limit(300);

    if (error) throw error;

    // ============================================
    // FONTE 2: ai_quality_logs — baixa confiança (< 0.5)
    // ============================================
    const { data: lowConfLogs, error: lcError } = await supabase
      .from('ai_quality_logs')
      .select('id, conversation_id, customer_message, confidence_score, action_taken, handoff_reason, persona_id, created_at')
      .gte('created_at', yesterday)
      .lt('confidence_score', 0.5)
      .not('customer_message', 'is', null)
      .limit(200);

    if (lcError) {
      console.error('[detect-kb-gaps] ⚠️ Erro ao buscar ai_quality_logs:', lcError);
      // Não lançar erro — continuar com os ai_events
    }

    // ============================================
    // FONTE 3: ai_suggestions com tipo kb_gap não usadas
    // ============================================
    const { data: kbGapSuggestions, error: sgError } = await supabase
      .from('ai_suggestions')
      .select('id, conversation_id, kb_gap_description, classification_label, created_at')
      .eq('suggestion_type', 'kb_gap')
      .eq('used', false)
      .gte('created_at', yesterday)
      .limit(100);

    if (sgError) {
      console.error('[detect-kb-gaps] ⚠️ Erro ao buscar ai_suggestions:', sgError);
    }

    // Unificar todas as fontes em um formato comum
    interface GapSignal {
      source: string;
      text: string;
      department_id: string | null;
      event_type: string;
      conversation_id: string | null;
      created_at: string;
    }

    const allSignals: GapSignal[] = [];

    // Fonte 1: ai_events
    for (const event of (gapEvents || [])) {
      if (event.input_summary) {
        allSignals.push({
          source: 'ai_events',
          text: event.input_summary,
          department_id: event.department_id,
          event_type: event.event_type,
          conversation_id: event.entity_id,
          created_at: event.created_at,
        });
      }
    }

    // Fonte 2: ai_quality_logs (baixa confiança)
    for (const log of (lowConfLogs || [])) {
      if (log.customer_message) {
        allSignals.push({
          source: 'ai_quality_logs',
          text: log.customer_message,
          department_id: null,
          event_type: log.action_taken === 'handoff' ? 'low_conf_handoff' : 'low_confidence',
          conversation_id: log.conversation_id,
          created_at: log.created_at,
        });
      }
    }

    // Fonte 3: ai_suggestions kb_gap
    for (const sg of (kbGapSuggestions || [])) {
      if (sg.kb_gap_description) {
        allSignals.push({
          source: 'ai_suggestions',
          text: sg.kb_gap_description,
          department_id: null,
          event_type: 'copilot_kb_gap',
          conversation_id: sg.conversation_id,
          created_at: sg.created_at,
        });
      }
    }

    console.log(`[detect-kb-gaps] 📊 Sinais totais: ${allSignals.length} (events=${gapEvents?.length || 0}, lowConf=${lowConfLogs?.length || 0}, suggestions=${kbGapSuggestions?.length || 0})`);

    if (allSignals.length === 0) {
      console.log('[detect-kb-gaps] ✅ Nenhum sinal de gap nas últimas 24h');
      return new Response(JSON.stringify({ success: true, gaps_detected: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // CLUSTERING: Agrupar por similaridade textual
    // ============================================
    const clusters: Map<string, GapSignal[]> = new Map();

    for (const signal of allSignals) {
      // Normalizar: lowercase, remover pontuação, pegar primeiras 5 palavras
      const normalized = signal.text
        .toLowerCase()
        .replace(/[^a-záàâãéèêíïóôõöúüç\s0-9]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(' ');

      if (!normalized || normalized.length < 5) continue;

      // Bucket: primeiras 3 palavras significativas
      const words = normalized.split(' ').filter(w => w.length > 2);
      const bucket = words.slice(0, 3).join(' ');
      if (!bucket) continue;

      if (!clusters.has(bucket)) clusters.set(bucket, []);
      clusters.get(bucket)!.push(signal);
    }

    // Filtrar clusters com >= 2 sinais (gaps recorrentes)
    const significantClusters = Array.from(clusters.entries())
      .filter(([_, signals]) => signals.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`[detect-kb-gaps] 🎯 ${significantClusters.length} clusters significativos (>= 2 sinais)`);

    if (significantClusters.length === 0) {
      return new Response(JSON.stringify({ success: true, gaps_detected: 0, reason: 'no_significant_clusters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================
    // CRIAR knowledge_candidates com status 'pending' + tag 'gap_detected'
    // ============================================
    const gapsCreated = [];
    const topClusters = significantClusters.slice(0, 15);

    for (const [bucket, signals] of topClusters) {
      // Verificar se já existe gap similar
      const { data: existing } = await supabase
        .from('knowledge_candidates')
        .select('id')
        .eq('status', 'pending')
        .contains('tags', ['gap_detected'])
        .ilike('problem', `%${bucket}%`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log(`[detect-kb-gaps] ⏭️ Gap já existe para: "${bucket}"`);
        continue;
      }

      const representativeInput = signals[0].text;
      const deptId = signals.find(s => s.department_id)?.department_id || null;
      
      // Extrair tipos únicos de evento e fontes
      const eventTypes = [...new Set(signals.map(s => s.event_type))];
      const sources = [...new Set(signals.map(s => s.source))];
      const conversationIds = [...new Set(signals.map(s => s.conversation_id).filter(Boolean))];

      // Calcular severidade baseada na quantidade e diversidade de fontes
      const severity = signals.length >= 10 ? 'high' : signals.length >= 5 ? 'medium' : 'low';

      const { data: candidate, error: insertError } = await supabase
        .from('knowledge_candidates')
        .insert({
          problem: `[GAP DETECTADO] ${representativeInput.substring(0, 200)}`,
          solution: `Lacuna identificada: ${signals.length} sinais sobre "${bucket}" (fontes: ${sources.join(', ')}). Eventos: ${eventTypes.join(', ')}. A IA não conseguiu responder. Crie um artigo na KB.`,
          when_to_use: `Quando cliente perguntar sobre: ${bucket}`,
          category: 'Gap Detectado — Precisa de Artigo',
          tags: ['gap_kb', 'auto_detected', 'gap_detected', `severity_${severity}`, ...eventTypes],
          department_id: deptId,
          confidence_score: Math.min(100, signals.length * 15),
          extracted_by: 'detect-kb-gaps',
          status: 'pending',
          risk_level: severity === 'high' ? 'medium' : 'low',
          contains_pii: false,
          clarity_score: 0,
          completeness_score: 0,
        })
        .select()
        .single();

      if (!insertError && candidate) {
        gapsCreated.push({ 
          id: candidate.id, 
          bucket, 
          frequency: signals.length, 
          sources,
          severity,
          event_types: eventTypes,
          sample_conversations: conversationIds.slice(0, 5),
        });
        console.log(`[detect-kb-gaps] ✅ Gap criado: "${bucket}" (${signals.length}x, severity=${severity})`);
      } else if (insertError) {
        console.error(`[detect-kb-gaps] ❌ Erro ao criar gap "${bucket}":`, insertError);
      }
    }

    // ============================================
    // NOTIFICAR managers/admins
    // ============================================
    if (gapsCreated.length > 0) {
      const highSeverity = gapsCreated.filter(g => g.severity === 'high').length;
      const { data: managers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'manager', 'support_manager', 'cs_manager']);

      if (managers && managers.length > 0) {
        const urgencyEmoji = highSeverity > 0 ? '🚨' : '🔍';
        for (const manager of managers) {
          await supabase.from('notifications').insert({
            user_id: manager.user_id,
            type: 'knowledge_approval',
            title: `${urgencyEmoji} ${gapsCreated.length} Lacuna(s) na KB Detectada(s)`,
            message: `A IA identificou ${gapsCreated.length} tema(s) sem resposta na KB (${highSeverity} críticos). Sinais analisados: ${allSignals.length} de ${sources_summary(gapsCreated)}.`,
            metadata: {
              gaps: gapsCreated,
              total_signals: allSignals.length,
              sources: { ai_events: gapEvents?.length || 0, ai_quality_logs: lowConfLogs?.length || 0, ai_suggestions: kbGapSuggestions?.length || 0 },
              action_url: '/knowledge/gaps',
            },
            read: false,
          });
        }
      }
    }

    console.log(`[detect-kb-gaps] 🎯 Concluído: ${gapsCreated.length} gaps criados de ${allSignals.length} sinais`);

    return new Response(JSON.stringify({
      success: true,
      signals_analyzed: allSignals.length,
      signal_sources: {
        ai_events: gapEvents?.length || 0,
        ai_quality_logs: lowConfLogs?.length || 0,
        ai_suggestions: kbGapSuggestions?.length || 0,
      },
      clusters_found: significantClusters.length,
      gaps_detected: gapsCreated.length,
      gaps: gapsCreated,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[detect-kb-gaps] ❌ Erro:', error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function sources_summary(gaps: any[]): string {
  const allSources = new Set<string>();
  gaps.forEach(g => g.sources?.forEach((s: string) => allSources.add(s)));
  return [...allSources].join(', ') || 'múltiplas fontes';
}
