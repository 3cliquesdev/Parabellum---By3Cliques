import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DistributeRequest {
  agentId: string;
  maxConversations?: number; // Limite opcional de conversas a atribuir
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { agentId, maxConversations = 10 }: DistributeRequest = await req.json();

    if (!agentId) {
      return new Response(JSON.stringify({ error: 'agentId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[distribute-pending] Agente ${agentId} ficou online. Distribuindo conversas...`);

    // Verificar se está dentro do horário comercial
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false,
      timeZone: 'America/Sao_Paulo' 
    });

    const { data: businessHours } = await supabaseClient
      .from('business_hours_config')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .single();

    let isWithinBusinessHours = true;
    
    if (!businessHours || !businessHours.is_working_day) {
      isWithinBusinessHours = false;
    } else {
      const startTime = businessHours.start_time;
      const endTime = businessHours.end_time;
      if (currentTime < startTime || currentTime >= endTime) {
        isWithinBusinessHours = false;
      }
    }

    if (!isWithinBusinessHours) {
      console.log('[distribute-pending] Fora do horário comercial, não distribuindo');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Fora do horário comercial',
        distributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar informações do agente
    const { data: agent, error: agentError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, availability_status')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('[distribute-pending] Agente não encontrado:', agentError);
      return new Response(JSON.stringify({ error: 'Agente não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar todos os agentes online para load balancing
    const { data: onlineAgents } = await supabaseClient
      .from('profiles')
      .select('id, full_name')
      .eq('availability_status', 'online')
      .in('role', ['admin', 'agent', 'consultant']);

    const totalOnlineAgents = onlineAgents?.length || 1;
    console.log(`[distribute-pending] ${totalOnlineAgents} agentes online`);

    // Buscar conversas pendentes (sem agente atribuído)
    const { data: pendingConversations, error: pendingError } = await supabaseClient
      .from('conversations')
      .select(`
        id, 
        contact_id, 
        ai_mode, 
        previous_agent_id,
        created_at,
        conversation_queue!left(priority, queued_at)
      `)
      .in('status', ['open', 'pending'])
      .is('assigned_to', null)
      .order('created_at', { ascending: true }) // FIFO
      .limit(maxConversations * totalOnlineAgents); // Buscar conversas suficientes para todos

    if (pendingError) {
      console.error('[distribute-pending] Erro ao buscar conversas pendentes:', pendingError);
      throw pendingError;
    }

    console.log(`[distribute-pending] ${pendingConversations?.length || 0} conversas pendentes no pool geral`);

    if (!pendingConversations || pendingConversations.length === 0) {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Nenhuma conversa pendente',
        distributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Contar conversas atuais por agente para load balancing
    const { data: agentCounts } = await supabaseClient
      .from('conversations')
      .select('assigned_to')
      .in('status', ['open', 'pending'])
      .not('assigned_to', 'is', null);

    const conversationCountByAgent: Record<string, number> = {};
    if (onlineAgents) {
      for (const a of onlineAgents) {
        conversationCountByAgent[a.id] = 0;
      }
    }
    if (agentCounts) {
      for (const conv of agentCounts) {
        if (conv.assigned_to && conversationCountByAgent[conv.assigned_to] !== undefined) {
          conversationCountByAgent[conv.assigned_to]++;
        }
      }
    }

    // Distribuir conversas usando round-robin com load balancing
    let distributedCount = 0;
    const assignedToThisAgent: string[] = [];

    for (const conv of pendingConversations) {
      // Encontrar agente com menos conversas
      let targetAgentId = agentId;
      let minConversations = conversationCountByAgent[agentId] || 0;

      if (onlineAgents) {
        for (const a of onlineAgents) {
          const count = conversationCountByAgent[a.id] || 0;
          if (count < minConversations) {
            minConversations = count;
            targetAgentId = a.id;
          }
        }
      }

      // Se não é para este agente, pular
      if (targetAgentId !== agentId) {
        continue;
      }

      // Atribuir conversa ao agente
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({
          assigned_to: agentId,
          ai_mode: 'waiting_human' // Agente precisa responder primeiro
        })
        .eq('id', conv.id);

      if (updateError) {
        console.error(`[distribute-pending] Erro ao atribuir conversa ${conv.id}:`, updateError);
        continue;
      }

      // Remover da fila de espera
      await supabaseClient
        .from('conversation_queue')
        .delete()
        .eq('conversation_id', conv.id);

      // Inserir mensagem de sistema
      await supabaseClient.from('messages').insert({
        conversation_id: conv.id,
        content: `👤 ${agent.full_name} entrou na conversa e assumirá o atendimento.`,
        sender_type: 'system',
        channel: 'web_chat'
      });

      conversationCountByAgent[agentId] = (conversationCountByAgent[agentId] || 0) + 1;
      assignedToThisAgent.push(conv.id);
      distributedCount++;

      // Limitar quantidade de conversas atribuídas de uma vez
      if (distributedCount >= maxConversations) {
        break;
      }
    }

    console.log(`[distribute-pending] ✅ ${distributedCount} conversas atribuídas ao agente ${agent.full_name}`);

    return new Response(JSON.stringify({
      status: 'ok',
      message: 'Distribuição concluída',
      distributed: distributedCount,
      conversations: assignedToThisAgent,
      agentName: agent.full_name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[distribute-pending] Erro geral:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
