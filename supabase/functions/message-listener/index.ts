import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record } = await req.json();
    console.log('[message-listener] New message received:', record.id);
    
    // Só processar mensagens de clientes
    if (record.sender_type !== 'contact') {
      console.log('[message-listener] Ignoring non-contact message');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not_contact' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar ai_mode da conversa + is_test_mode para modo de teste individual
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('ai_mode, assigned_to, channel, is_test_mode')
      .eq('id', record.conversation_id)
      .single();

    if (convError) {
      console.error('[message-listener] Error fetching conversation:', convError);
      throw convError;
    }

    // ============================================================
    // 🚫 ANTI-DUPLICAÇÃO: Se canal WhatsApp, já foi processado
    // handle-whatsapp-event chama ai-autopilot-chat diretamente
    // ============================================================
    if (conversation?.channel === 'whatsapp') {
      console.log('[message-listener] ⏭️ Canal WhatsApp - já processado por handle-whatsapp-event');
      return new Response(JSON.stringify({ 
        status: 'skipped', 
        reason: 'whatsapp_handled_by_webhook',
        message: 'WhatsApp messages are processed by handle-whatsapp-event'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // 🛑 KILL SWITCH: Se IA global desligada, NÃO processar nada
    // Apenas logar e retornar - humano precisa assumir
    // ============================================================
    const aiConfig = await getAIConfig(supabase);
    const isTestMode = conversation?.is_test_mode === true;

    // ============================================================
    // 📊 LOG DE DECISÃO UNIFICADO (Observabilidade)
    // Este log é a "caixa-preta" para auditoria de incidentes
    // ============================================================
    console.log('[AUTO-DECISION]', JSON.stringify({
      timestamp: new Date().toISOString(),
      conversation_id: record.conversation_id,
      message_id: record.id,
      ai_global_enabled: aiConfig.ai_global_enabled,
      is_test_mode: isTestMode,
      ai_mode: conversation?.ai_mode,
      assigned_to: conversation?.assigned_to || null,
      decision: !aiConfig.ai_global_enabled && !isTestMode 
        ? 'HUMAN_ONLY' 
        : isTestMode 
          ? 'TEST_MODE_ACTIVE' 
          : 'AI_PROCESSING',
      reason: !aiConfig.ai_global_enabled && !isTestMode
        ? 'kill_switch_active'
        : isTestMode
          ? 'test_mode_bypass'
          : 'normal_flow',
    }));

    if (!aiConfig.ai_global_enabled && !isTestMode) {
      console.log('[message-listener] 🛑 KILL SWITCH ATIVO - Nenhum envio automático');
      
      // Mover conversa para fila humana se estiver em autopilot
      if (conversation?.ai_mode === 'autopilot') {
        await supabase
          .from('conversations')
          .update({ ai_mode: 'waiting_human' })
          .eq('id', record.conversation_id);
        console.log('[message-listener] 📋 Conversa movida para fila humana');
      }
      
      return new Response(JSON.stringify({ 
        status: 'kill_switch_active',
        action: 'skip_all_auto',
        reason: 'ai_global_enabled = false',
        message: 'Aguardando atendente humano'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 🆕 MODO DE TESTE: Logar se a conversa está em modo de teste
    if (isTestMode) {
      console.log('[message-listener] 🧪 MODO TESTE ATIVO para conversa:', record.conversation_id);
      if (!aiConfig.ai_global_enabled) {
        console.log('[message-listener] 🧪 Kill Switch ativo, mas MODO TESTE permite processar');
      }
    }

    // 🆕 DETECTAR RESPOSTA DO AGENTE: Se agente enviou mensagem e está em waiting_human, mudar para copilot
    if (record.sender_type === 'agent' && conversation?.ai_mode === 'waiting_human') {
      console.log('[message-listener] 🎉 Agente respondeu! Mudando de waiting_human para copilot');
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ ai_mode: 'copilot' })
        .eq('id', record.conversation_id);
      
      if (updateError) {
        console.error('[message-listener] Erro ao atualizar ai_mode:', updateError);
      } else {
        console.log('[message-listener] ✅ ai_mode atualizado para copilot');
      }
      
      // Inserir mensagem de sistema informando que o agente assumiu
      await supabase.from('messages').insert({
        conversation_id: record.conversation_id,
        content: '👤 Atendente humano assumiu a conversa. A IA está agora em modo assistente.',
        sender_type: 'system',
        channel: 'chat'
      });
      
      return new Response(JSON.stringify({ 
        status: 'agent_responded', 
        ai_mode: 'copilot',
        message: 'Agente assumiu a conversa' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // 🆕 MODO COPILOT: Disparar generate-smart-reply para sugestões
    // ============================================================
    if (conversation?.ai_mode === 'copilot') {
      console.log('[message-listener] 🧠 Modo Copilot - gerando sugestões em background...');
      
      // Disparar geração de sugestões em background (não bloqueia resposta)
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-smart-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          conversationId: record.conversation_id,
          maxMessages: 15,
          includeKBSearch: true
        })
      }).catch(err => console.error('[message-listener] Erro ao gerar sugestões Copilot:', err));
      
      return new Response(JSON.stringify({ 
        status: 'copilot_suggestion_triggered', 
        conversation_id: record.conversation_id,
        message: 'Sugestões sendo geradas em background' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se não é autopilot, ignorar (inclui waiting_human, disabled)
    if (conversation?.ai_mode !== 'autopilot') {
      console.log('[message-listener] Conversation not in autopilot mode:', conversation?.ai_mode);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not_autopilot', ai_mode: conversation?.ai_mode }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // 🆕 REGRA ANTI-ALUCINAÇÃO: Chamar process-chat-flow PRIMEIRO
    // A IA só roda se houver AIResponseNode ativo no fluxo
    // ============================================================
    console.log('[message-listener] 🔄 Calling process-chat-flow first (Anti-Hallucination Rule)');
    
    const flowResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-chat-flow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        conversationId: record.conversation_id,
        userMessage: record.content
      })
    });

    const flowData = await flowResponse.json();
    console.log('[message-listener] 📋 process-chat-flow response:', {
      useAI: flowData.useAI,
      aiNodeActive: flowData.aiNodeActive,
      reason: flowData.reason,
      flowId: flowData.flowId
    });

    // Se process-chat-flow retornou uma resposta de fluxo (não-IA)
    if (!flowData.useAI && flowData.response) {
      console.log('[message-listener] 📝 Flow response (no AI):', flowData.response?.slice(0, 50));
      
      // Inserir resposta do fluxo como mensagem
      await supabase.from('messages').insert({
        conversation_id: record.conversation_id,
        content: flowData.response,
        sender_type: 'user',
        is_ai_generated: false,
        channel: conversation.channel || 'web_chat'
      });
      
      return new Response(JSON.stringify({ 
        status: 'flow_response', 
        flow_id: flowData.flowId,
        message: 'Flow handled the message' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // 🆕 REGRA CRÍTICA: Só chamar IA se aiNodeActive === true
    // ============================================================
    if (!flowData.useAI || !flowData.aiNodeActive) {
      console.log('[message-listener] ⛔ No AIResponseNode active - AI will NOT run');
      console.log('[message-listener] Reason:', flowData.reason || 'aiNodeActive is false');
      
      // Se não há fluxo ativo e não há AIResponseNode, enviar fallback
      if (!flowData.flowId && !flowData.response) {
        // 🆕 REGRA: Se skipAutoResponse (Kill Switch ativo no flow), NÃO enviar fallback
        if (flowData.skipAutoResponse) {
          console.log('[message-listener] ⏸️ skipAutoResponse = true - Não enviando fallback');
          
          // Apenas marcar para transferência, sem enviar mensagem
          await supabase
            .from('conversations')
            .update({ ai_mode: 'waiting_human' })
            .eq('id', record.conversation_id);
          
          return new Response(JSON.stringify({ 
            status: 'waiting_human_no_message', 
            reason: 'kill_switch_active'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Comportamento original (só quando IA está ligada)
        const fallbackMessage = flowData.fallbackMessage || 
          'No momento não tenho essa informação. Vou te encaminhar para um atendente humano.';
        
        await supabase.from('messages').insert({
          conversation_id: record.conversation_id,
          content: fallbackMessage,
          sender_type: 'user',
          is_ai_generated: true,
          channel: conversation.channel || 'web_chat'
        });
        
        // Marcar para transferência humana
        await supabase
          .from('conversations')
          .update({ ai_mode: 'waiting_human' })
          .eq('id', record.conversation_id);
      }
      
      return new Response(JSON.stringify({ 
        status: 'no_ai_node', 
        reason: flowData.reason || 'aiNodeActive is false',
        ai_mode: 'waiting_human'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // ✅ AIResponseNode ATIVO: Chamar ai-autopilot-chat COM flow_context
    // ============================================================
    console.log('[message-listener] 🚀 AIResponseNode active - triggering AI with flow_context');
    
    const autopilotResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-autopilot-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        conversationId: record.conversation_id,
        customerMessage: record.content,
        // 🆕 CONTRATO: Passar contexto do fluxo para IA com novos campos Fase 1
        flow_context: {
          flow_id: flowData.flowId || flowData.masterFlowId,
          node_id: flowData.nodeId,
          node_type: 'ai_response',
          allowed_sources: flowData.allowedSources || ['kb'],
          response_format: 'text_only',
          personaId: flowData.personaId,
          kbCategories: flowData.kbCategories,
          kbProductFilter: flowData.kbProductFilter,
          contextPrompt: flowData.contextPrompt,
          fallbackMessage: flowData.fallbackMessage,
          // 🆕 FASE 1: Campos de Controle de Comportamento Anti-Alucinação
          objective: flowData.objective || null,
          maxSentences: flowData.maxSentences ?? 3,
          forbidQuestions: flowData.forbidQuestions ?? true,
          forbidOptions: flowData.forbidOptions ?? true,
        }
      })
    });

    const autopilotData = await autopilotResponse.json();
    console.log('[message-listener] Autopilot response status:', autopilotResponse.status);

    if (!autopilotResponse.ok) {
      console.error('[message-listener] Autopilot error:', autopilotData);
      throw new Error(`Autopilot failed: ${JSON.stringify(autopilotData)}`);
    }

    // 🆕 AJUSTE ANTI-ESCAPE: Verificar se IA sinalizou violação de contrato
    // IA NÃO decide transferência — apenas sinaliza erro
    // Delegamos para process-chat-flow ativar o TransferNode
    if (autopilotData.contractViolation) {
      console.log('[message-listener] ⚠️ IA sinalizou violação de contrato');
      console.log('[message-listener] 📋 Violation type:', autopilotData.violationType);
      console.log('[message-listener] 📋 Reason:', autopilotData.reason);
      
      // ✅ Delegar para process-chat-flow ativar TransferNode
      const transferResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-chat-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          conversationId: record.conversation_id,
          userMessage: record.content,
          contractViolation: true,
          violationReason: autopilotData.reason,
          activateTransfer: true  // Sinaliza para o fluxo ativar TransferNode
        })
      });
      
      const transferData = await transferResponse.json();
      console.log('[message-listener] 📋 Transfer delegated to flow:', transferData);
      
      return new Response(JSON.stringify({ 
        status: 'contract_violation_delegated', 
        reason: autopilotData.reason,
        transfer_handled_by: 'process-chat-flow'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      status: 'triggered', 
      conversation_id: record.conversation_id,
      flow_context_used: true,
      autopilot_response: autopilotData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[message-listener] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
