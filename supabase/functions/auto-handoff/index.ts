import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

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
      .select('ai_mode, contact_id, assigned_to')
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

    // 4. GERAR RESUMO INTELIGENTE via analyze-ticket
    console.log('[auto-handoff] Gerando resumo contextual...');
    const { data: summaryData, error: summaryError } = await supabaseClient.functions.invoke('analyze-ticket', {
      body: { 
        mode: 'summary',
        description: messagesText
      }
    });

    if (!summaryError && summaryData?.result) {
      internalNote += `\n\n**Resumo da Conversa:**\n${summaryData.result}`;
    }

    // 5. EXECUTAR HANDOFF: Mudar para copilot
    console.log(`[auto-handoff] Executando handoff (motivo: ${handoffReason})...`);
    
    const { error: updateError } = await supabaseClient
      .from('conversations')
      .update({ ai_mode: 'copilot' })
      .eq('id', conversationId);

    if (updateError) {
      console.error('[auto-handoff] Erro ao atualizar conversa:', updateError);
      throw updateError;
    }

    // 6. INSERIR NOTA INTERNA NA TIMELINE
    console.log('[auto-handoff] Criando nota interna...');
    const { error: noteError } = await supabaseClient
      .from('interactions')
      .insert({
        customer_id: conversation.contact_id,
        type: 'note',
        content: internalNote,
        channel: 'other',
        metadata: {
          auto_handoff: true,
          reason: handoffReason,
          conversation_id: conversationId,
          timestamp: new Date().toISOString()
        }
      });

    if (noteError) {
      console.error('[auto-handoff] Erro ao criar nota interna:', noteError);
    }

    console.log('[auto-handoff] ✅ Handoff executado com sucesso!');

    return new Response(JSON.stringify({ 
      status: 'handoff_executed',
      reason: handoffReason,
      internal_note: internalNote
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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
