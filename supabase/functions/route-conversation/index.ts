import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteConversationRequest {
  conversationId: string;
  priority?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, priority = 0 } = await req.json() as RouteConversationRequest;

    console.log(`[route-conversation] Processing conversation: ${conversationId}, priority: ${priority}`);

    // 1. Buscar dados da conversa e contato
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        contact_id,
        department,
        contacts (
          id,
          first_name,
          last_name,
          consultant_id
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error(`Conversa não encontrada: ${convError?.message}`);
    }

    const contact = Array.isArray(conversation.contacts) 
      ? conversation.contacts[0] 
      : conversation.contacts;
      
    console.log('[route-conversation] Contact data:', { 
      contact_id: contact?.id, 
      consultant_id: contact?.consultant_id 
    });

    // 2. PRIORIDADE 1: STICKY AGENT (Consultor da Carteira)
    if (contact?.consultant_id) {
      console.log('[route-conversation] Checking consultant availability:', contact.consultant_id);
      
      const { data: consultant, error: consultantError } = await supabase
        .from('profiles')
        .select('id, full_name, availability_status')
        .eq('id', contact.consultant_id)
        .eq('availability_status', 'online')
        .single();

      if (consultant && !consultantError) {
        console.log('[route-conversation] ✅ STICKY AGENT - Assigning to consultant:', consultant.full_name);
        
        // Atribuir ao consultor
        await supabase
          .from('conversations')
          .update({ 
            assigned_to: consultant.id,
            ai_mode: 'copilot',
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversationId);

        // Inserir mensagem de sistema
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: `O consultor ${consultant.full_name} entrou na conversa`,
            sender_type: 'system',
            message_type: 'system'
          });

        return new Response(
          JSON.stringify({
            success: true,
            assigned_to: consultant.id,
            agent_name: consultant.full_name,
            assignment_type: 'sticky_agent',
            message: `Conversa atribuída ao consultor ${consultant.full_name}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[route-conversation] Consultant offline or unavailable');
    }

    // 3. PRIORIDADE 2: BALANCEAMENTO DE CARGA (Support Agents ONLY)
    console.log('[route-conversation] Searching for available support agents');

    // Buscar agentes de suporte online (role='support_agent'), filtrados por departamento se houver
    let agentsQuery = supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        availability_status,
        department,
        user_roles!inner(role)
      `)
      .eq('availability_status', 'online')
      .eq('user_roles.role', 'support_agent');

    // Filtrar por departamento se a conversa tiver um
    if (conversation.department) {
      agentsQuery = agentsQuery.eq('department', conversation.department);
    }

    const { data: onlineAgents, error: agentsError } = await agentsQuery;

    if (agentsError) {
      throw new Error(`Erro ao buscar agentes: ${agentsError.message}`);
    }

    if (onlineAgents && onlineAgents.length > 0) {
      console.log('[route-conversation] Found online agents:', onlineAgents.length);

      // Contar conversas abertas por agente
      const agentLoads = await Promise.all(
        onlineAgents.map(async (agent) => {
          const { count } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', agent.id)
            .eq('status', 'open');

          return {
            ...agent,
            open_conversations: count || 0
          };
        })
      );

      // Ordenar por carga (menos conversas primeiro)
      agentLoads.sort((a, b) => a.open_conversations - b.open_conversations);
      const selectedAgent = agentLoads[0];

      console.log('[route-conversation] ✅ LOAD BALANCING - Assigning to:', {
        agent: selectedAgent.full_name,
        current_load: selectedAgent.open_conversations
      });

      // Atribuir ao agente com menos carga
      await supabase
        .from('conversations')
        .update({ 
          assigned_to: selectedAgent.id,
          ai_mode: 'copilot',
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      // Inserir mensagem de sistema
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: `O atendente ${selectedAgent.full_name} entrou na conversa`,
          sender_type: 'system',
          message_type: 'system'
        });

      return new Response(
        JSON.stringify({
          success: true,
          assigned_to: selectedAgent.id,
          agent_name: selectedAgent.full_name,
          assignment_type: 'load_balancing',
          current_load: selectedAgent.open_conversations,
          message: `Conversa atribuída a ${selectedAgent.full_name}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. FALLBACK: FILA DE ESPERA (Ninguém online)
    console.log('[route-conversation] ⚠️ NO AGENTS AVAILABLE - Adding to queue');

    // Adicionar à fila de espera
    await supabase
      .from('conversation_queue')
      .upsert({
        conversation_id: conversationId,
        priority,
        queued_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      });

    // Enviar mensagem de espera ao cliente
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: 'Nossos atendentes estão ocupados ou ausentes no momento. Deixe sua mensagem que responderemos em breve. ⏰',
        sender_type: 'system',
        message_type: 'system',
        is_ai_generated: true
      });

    // Verificar posição na fila
    const { count: queuePosition } = await supabase
      .from('conversation_queue')
      .select('*', { count: 'exact', head: true })
      .is('assigned_at', null)
      .lte('priority', priority)
      .lte('queued_at', new Date().toISOString());

    return new Response(
      JSON.stringify({
        success: true,
        assigned_to: null,
        assignment_type: 'queued',
        queue_position: queuePosition || 1,
        message: 'Conversa adicionada à fila de espera'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[route-conversation] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
