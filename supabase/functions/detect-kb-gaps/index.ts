import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Kill switch
    const { data: killSwitch } = await supabase
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_global_enabled')
      .maybeSingle();

    if (killSwitch?.value !== 'true') {
      return new Response(JSON.stringify({ success: false, reason: 'kill_switch' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Buscar eventos de IA sem resposta ou com baixa confiança das últimas 24h
    const { data: gapEvents, error } = await supabase
      .from('ai_events')
      .select('id, entity_id, event_type, input_summary, output_json, department_id, created_at')
      .in('event_type', [
        'ai_handoff_exit',
        'contract_violation_blocked',
        'flow_exit_clean',
        'ai_exit_intent',
      ])
      .gte('created_at', yesterday)
      .not('input_summary', 'is', null)
      .limit(200);

    if (error) throw error;

    if (!gapEvents || gapEvents.length === 0) {
      console.log('[detect-kb-gaps] ✅ Nenhum gap event nas últimas 24h');
      return new Response(JSON.stringify({ success: true, gaps_detected: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[detect-kb-gaps] 📊 ${gapEvents.length} eventos de gap encontrados`);

    // 2. Agrupar por similaridade de input_summary usando clustering simples
    const clusters: Map<string, Array<typeof gapEvents[0]>> = new Map();

    for (const event of gapEvents) {
      if (!event.input_summary) continue;

      const normalized = event.input_summary
        .toLowerCase()
        .replace(/[^a-záàâãéèêíïóôõöúüç\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 5)
        .join(' ');

      if (!normalized) continue;

      const bucket = normalized.split(' ').slice(0, 3).join(' ');

      if (!clusters.has(bucket)) clusters.set(bucket, []);
      clusters.get(bucket)!.push(event);
    }

    // 3. Filtrar clusters com >= 2 perguntas (gaps recorrentes)
    const significantClusters = Array.from(clusters.entries())
      .filter(([_, events]) => events.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`[detect-kb-gaps] 🎯 ${significantClusters.length} clusters significativos (>= 2 perguntas)`);

    if (significantClusters.length === 0) {
      return new Response(JSON.stringify({ success: true, gaps_detected: 0, reason: 'no_significant_clusters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Criar knowledge_candidates com status 'pending' + tag 'gap_detected'
    // (CHECK constraint só aceita pending/approved/rejected)
    const gapsCreated = [];
    const topClusters = significantClusters.slice(0, 10);

    for (const [bucket, events] of topClusters) {
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

      const representativeInput = events[0].input_summary || bucket;
      const deptId = events[0].department_id || null;

      const { data: candidate, error: insertError } = await supabase
        .from('knowledge_candidates')
        .insert({
          problem: `[GAP DETECTADO] ${representativeInput.substring(0, 200)}`,
          solution: `Lacuna identificada: ${events.length} clientes perguntaram sobre "${bucket}" e a IA não conseguiu responder. Por favor, crie um artigo na KB cobrindo este tema.`,
          when_to_use: `Quando cliente perguntar sobre: ${bucket}`,
          category: 'Gap Detectado — Precisa de Artigo',
          tags: ['gap_kb', 'auto_detected', 'gap_detected', ...events.map(e => e.event_type).filter((v, i, a) => a.indexOf(v) === i)],
          department_id: deptId,
          confidence_score: 100,
          extracted_by: 'detect-kb-gaps',
          status: 'pending',
          risk_level: 'low',
          contains_pii: false,
          clarity_score: 0,
          completeness_score: 0,
        })
        .select()
        .single();

      if (!insertError && candidate) {
        gapsCreated.push({ id: candidate.id, bucket, frequency: events.length });
        console.log(`[detect-kb-gaps] ✅ Gap criado: "${bucket}" (${events.length}x)`);
      }
    }

    // 5. Notificar managers/admins se houver gaps novos
    if (gapsCreated.length > 0) {
      const { data: managers } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'manager', 'support_manager', 'cs_manager']);

      if (managers && managers.length > 0) {
        for (const manager of managers) {
          await supabase.from('notifications').insert({
            user_id: manager.user_id,
            type: 'knowledge_approval',
            title: `🔍 ${gapsCreated.length} Lacuna(s) na KB Detectada(s) pela IA`,
            message: `A IA identificou ${gapsCreated.length} tema(s) que clientes perguntaram mas não há resposta na base de conhecimento. Acesse a curadoria para criar os artigos.`,
            metadata: {
              gaps: gapsCreated,
              total_events_analyzed: gapEvents.length,
              action_url: '/settings/ai-audit',
            },
            read: false,
          });
        }
      }
    }

    console.log(`[detect-kb-gaps] 🎯 Concluído: ${gapsCreated.length} gaps criados`);

    return new Response(JSON.stringify({
      success: true,
      events_analyzed: gapEvents.length,
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
