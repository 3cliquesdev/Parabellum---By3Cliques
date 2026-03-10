import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoHandoffRequest {
  conversationId: string;
  lastMessages: Array<{
    content: string;
    sender_type: 'customer' | 'agent' | 'system';
    created_at: string;
  }>;
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

    const { conversationId, lastMessages }: AutoHandoffRequest = await req.json();
    
    console.log(`[auto-handoff] Analisando conversa ${conversationId}...`);

    // Buscar conversa atual
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select('ai_mode, contact_id, assigned_to, department')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[auto-handoff] Conversa não encontrada:', convError);
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Só processa se estiver em autopilot
    if (conversation.ai_mode !== 'autopilot') {
      console.log('[auto-handoff] Conversa não está em autopilot, ignorando...');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not_autopilot' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. ANÁLISE DE SENTIMENTO via analyze-ticket
    console.log('[auto-handoff] Analisando sentimento...');
    const messagesText = lastMessages.map(m => `${m.sender_type}: ${m.content}`).join('\n');
    
    const { data: sentimentData, error: sentimentError } = await supabaseClient.functions.invoke('analyze-ticket', {
      body: { 
        mode: 'sentiment',
        messages: messagesText
      }
    });

    let shouldHandoff = false;
    let handoffReason = '';
    let internalNote = '';

    if (!sentimentError && sentimentData?.result) {
      const sentiment = sentimentData.result.toLowerCase();
      console.log(`[auto-handoff] Sentimento detectado: ${sentiment}`);
      
      if (sentiment.includes('crítico') || sentiment.includes('irritado') || sentiment.includes('negativo')) {
        shouldHandoff = true;
        handoffReason = 'critical_sentiment';
        internalNote = `🚨 **Transbordo Automático - Sentimento Crítico**\n\nO cliente demonstra **${sentimentData.result}**. Recomenda-se atenção especial e abordagem empática.`;
        console.log('[auto-handoff] ⚠️ Sentimento crítico detectado! Acionando handoff...');
      }
    }

    // 2. DETECÇÃO DE LOOP DE ERRO
    if (!shouldHandoff) {
      const recentAIResponses = lastMessages
        .filter(m => m.sender_type === 'system')
        .slice(-3); // Últimas 3 respostas da IA

      const errorKeywords = ['não sei', 'não entendi', 'desculpe', 'não consigo', 'não posso ajudar'];
      const errorCount = recentAIResponses.filter(m => 
        errorKeywords.some(keyword => m.content.toLowerCase().includes(keyword))
      ).length;

      if (errorCount >= 2) {
        shouldHandoff = true;
        handoffReason = 'error_loop';
        internalNote = `🔄 **Transbordo Automático - Loop de Erro**\n\nA IA não conseguiu resolver a solicitação do cliente após ${errorCount} tentativas. É necessário intervenção humana especializada.`;
        console.log('[auto-handoff] 🔄 Loop de erro detectado! Acionando handoff...');
      }
    }

    // 3. Se não precisa handoff, gera apenas resumo contextual (opcional)
    if (!shouldHandoff) {
      console.log('[auto-handoff] ✅ Conversa saudável, nenhum transbordo necessário.');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        handoff_needed: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ HANDOFF NECESSÁRIO
    console.log(`[auto-handoff] ✅ Executando handoff. Motivo: ${handoffReason}`);

    // Gerar resumo da conversa para contexto do agente humano
    const summaryResult = await supabaseClient.functions.invoke('analyze-ticket', {
      body: {
        mode: 'summary',
        description: messagesText
      }
    });

    const summary = summaryResult.data?.result || 'Resumo não disponível';

    // 1. Chamar route-conversation para atribuição inteligente
    const routingPriority = handoffReason === 'critical_sentiment' ? 1 : 0;
    
    console.log(`[auto-handoff] Calling route-conversation with priority: ${routingPriority}`);
    
    const { data: routingResult, error: routingError } = await supabaseClient.functions.invoke('route-conversation', {
      body: {
        conversationId,
        priority: routingPriority
      }
    });

    if (routingError) {
      console.error('[auto-handoff] Error in routing:', routingError);
      // Fallback: mudar para waiting_human sem atribuir agente + garantir departamento
      const FALLBACK_DEPT_SUPORTE = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
      const fallbackUpdate: Record<string, unknown> = { ai_mode: 'waiting_human' };
      if (!conversation.department) {
        fallbackUpdate.department = FALLBACK_DEPT_SUPORTE;
        console.log('[auto-handoff] ⚠️ No department — applying Suporte fallback');
      }
      await supabaseClient
        .from('conversations')
        .update(fallbackUpdate)
        .eq('id', conversationId);
      console.log('[auto-handoff] ✅ Conversa marcada como waiting_human (fallback)');
    } else {
      console.log('[auto-handoff] Routing result:', routingResult);
      
      // 🆕 GARANTIR que ai_mode seja waiting_human após roteamento
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({ ai_mode: 'waiting_human' })
        .eq('id', conversationId);
      
      if (updateError) {
        console.error('[auto-handoff] ⚠️ Erro ao atualizar ai_mode para waiting_human:', updateError);
      } else {
        console.log('[auto-handoff] ✅ Conversa marcada como waiting_human - IA pausada até agente responder');
      }
    }

    // 2. Registrar nota interna com contexto do handoff
    const handoffReasons: Record<string, string> = {
      critical_sentiment: '😡 Cliente com sentimento crítico/irritado detectado',
      error_loop: '🔄 IA não conseguiu resolver após múltiplas tentativas'
    };

    const noteContent = `🤖 → 👤 Handoff Automático

**Motivo:** ${handoffReasons[handoffReason] || handoffReason}

**Resumo da Conversa:**
${summary}

**Atribuição:** ${routingResult?.agent_name || 'Fila de espera'}`;

    await supabaseClient
      .from('interactions')
      .insert({
        customer_id: conversation.contact_id,
        type: 'note',
        content: noteContent,
        channel: 'other',
        metadata: {
          handoff_reason: handoffReason,
          handoff_timestamp: new Date().toISOString(),
          ai_summary: summary,
          routing_result: routingResult
        }
      });

    // FASE 4: Se canal é email, criar ticket automaticamente para agente trabalhar
    const { data: conversationDetails } = await supabaseClient
      .from('conversations')
      .select('channel')
      .eq('id', conversationId)
      .single();

    if (conversationDetails?.channel === 'email') {
      console.log('[auto-handoff] 📧 Canal é email - criando ticket para agente...');
      
      const { data: ticket, error: ticketError } = await supabaseClient
        .from('tickets')
        .insert({
          customer_id: conversation.contact_id,
          subject: `[Escalado da IA] ${summary.substring(0, 100)}`,
          description: summary,
          channel: 'email',
          source_conversation_id: conversationId,
          priority: handoffReason === 'critical_sentiment' ? 'high' : 'medium',
          status: 'open'
        })
        .select()
        .single();

      if (ticketError) {
        console.error('[auto-handoff] ⚠️ Erro ao criar ticket:', ticketError);
      } else {
        console.log('[auto-handoff] ✅ Ticket criado:', ticket.id);
      }
    }

    console.log('[auto-handoff] ✅ Handoff executado com sucesso!');

    return new Response(
      JSON.stringify({
        status: 'handoff_executed',
        reason: handoffReason,
        summary,
        routing: routingResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-handoff] Erro geral:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
