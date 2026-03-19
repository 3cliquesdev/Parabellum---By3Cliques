import { createClient } from "npm:@supabase/supabase-js@2";
import { isWithinBusinessHours } from "../_shared/business-hours.ts";

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

    const now = new Date();
    // Verificar se está dentro do horário comercial
    const withinHours = await isWithinBusinessHours(supabaseClient);

    if (!withinHours) {
      console.log('[distribute-pending] Fora do horário comercial, não distribuindo');
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Fora do horário comercial',
        distributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Roles que podem receber distribuição automática de conversas
    // Nota: financial_agent e consultant removidos - não devem receber conversas automaticamente
    // support_agent: clientes com email verificado
    // sales_rep: leads novos sem email verificado
    const DISTRIBUTION_ALLOWED_ROLES = [
      'support_agent', 
      'sales_rep'
    ];

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

    // Verificar se o usuário tem role elegível para receber distribuição
    const { data: agentRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', agentId)
      .single();

    if (!agentRole || !DISTRIBUTION_ALLOWED_ROLES.includes(agentRole.role)) {
      console.log(`[distribute-pending] Usuário ${agent.full_name} (${agentRole?.role || 'sem role'}) não recebe distribuição automática`);
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Usuário não elegível para distribuição automática',
        distributed: 0,
        reason: `Role '${agentRole?.role || 'undefined'}' não recebe conversas automaticamente`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar todos os agentes com roles elegíveis e suas roles
    const { data: eligibleAgentsWithRoles } = await supabaseClient
      .from('user_roles')
      .select('user_id, role')
      .in('role', DISTRIBUTION_ALLOWED_ROLES);

    const agentRolesMap: Record<string, string> = {};
    if (eligibleAgentsWithRoles) {
      for (const ar of eligibleAgentsWithRoles) {
        agentRolesMap[ar.user_id] = ar.role;
      }
    }

    // Buscar agentes online que podem receber conversas
    const { data: onlineAgents } = await supabaseClient
      .from('profiles')
      .select('id, full_name')
      .eq('availability_status', 'online')
      .in('id', eligibleAgentsWithRoles?.map(a => a.user_id) || []);

    // Separar agentes por role
    const supportAgents = onlineAgents?.filter(a => agentRolesMap[a.id] === 'support_agent') || [];
    const salesAgents = onlineAgents?.filter(a => agentRolesMap[a.id] === 'sales_rep') || [];

    console.log(`[distribute-pending] Agentes online - Support: ${supportAgents.length}, Sales: ${salesAgents.length}`);

    // Configurações de prioridade por tempo de espera
    const WAIT_TIME_THRESHOLDS = [
      { minutes: 30, priorityBoost: 3 },  // Mais de 30 min = prioridade máxima
      { minutes: 15, priorityBoost: 2 },  // Mais de 15 min = prioridade alta
      { minutes: 5, priorityBoost: 1 },   // Mais de 5 min = prioridade média
    ];

    // Buscar conversas pendentes (sem agente atribuído)
    const { data: pendingConversationsRaw, error: pendingError } = await supabaseClient
      .from('conversations')
      .select(`
        id, 
        contact_id, 
        ai_mode, 
        previous_agent_id,
        created_at,
        needs_human_review,
        conversation_queue!left(priority, queued_at)
      `)
      .eq('status', 'open')
      .is('assigned_to', null)
      .limit(maxConversations * Math.max(supportAgents.length + salesAgents.length, 1) * 2);

    // Calcular prioridade baseada em tempo de espera
    const calculateWaitPriority = (createdAt: string, queuedAt?: string): number => {
      const referenceTime = queuedAt ? new Date(queuedAt) : new Date(createdAt);
      const waitTimeMinutes = (now.getTime() - referenceTime.getTime()) / (1000 * 60);
      
      for (const threshold of WAIT_TIME_THRESHOLDS) {
        if (waitTimeMinutes >= threshold.minutes) {
          return threshold.priorityBoost;
        }
      }
      return 0;
    };

    // Ordenar conversas por prioridade composta
    const pendingConversations = pendingConversationsRaw?.map(conv => ({
      ...conv,
      waitPriority: calculateWaitPriority(
        conv.created_at, 
        conv.conversation_queue?.[0]?.queued_at
      ),
      waitTimeMinutes: Math.round(
        (now.getTime() - new Date(conv.conversation_queue?.[0]?.queued_at || conv.created_at).getTime()) / (1000 * 60)
      )
    }))
    .sort((a, b) => {
      // 1. needs_human_review = true primeiro
      if (a.needs_human_review && !b.needs_human_review) return -1;
      if (!a.needs_human_review && b.needs_human_review) return 1;
      
      // 2. Maior waitPriority primeiro (tempo de espera)
      if (a.waitPriority !== b.waitPriority) return b.waitPriority - a.waitPriority;
      
      // 3. FIFO como desempate
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .slice(0, maxConversations * Math.max(supportAgents.length + salesAgents.length, 1));

    if (pendingError) {
      console.error('[distribute-pending] Erro ao buscar conversas pendentes:', pendingError);
      throw pendingError;
    }

    console.log(`[distribute-pending] ${pendingConversations?.length || 0} conversas pendentes (ordenadas por prioridade + tempo de espera)`);

    if (!pendingConversations || pendingConversations.length === 0) {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'Nenhuma conversa pendente',
        distributed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar status dos contatos das conversas pendentes
    const contactIds = [...new Set(pendingConversations.map(c => c.contact_id))];
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('id, status')
      .in('id', contactIds);

    // Mapear status dos contatos por ID
    const contactStatusMap: Record<string, string | null> = {};
    if (contacts) {
      for (const c of contacts) {
        contactStatusMap[c.id] = c.status;
      }
    }

    // Contar conversas atuais por agente para load balancing
    const { data: agentCounts } = await supabaseClient
      .from('conversations')
      .select('assigned_to')
      .eq('status', 'open')
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

    // Distribuir conversas usando round-robin com load balancing baseado no status do contato
    let distributedCount = 0;
    const assignedToThisAgent: string[] = [];
    const currentAgentRole = agentRolesMap[agentId];

    for (const conv of pendingConversations) {
      // Verificar status do contato para determinar roteamento
      const contactStatus = contactStatusMap[conv.contact_id];
      const isCustomer = contactStatus === 'customer';

      // Determinar qual pool de agentes deve receber esta conversa
      // status = 'customer' = cliente existente = support_agent
      // qualquer outro status (lead, prospect, null) = sales_rep
      const targetRole = isCustomer ? 'support_agent' : 'sales_rep';
      const targetAgentPool = isCustomer ? supportAgents : salesAgents;
      
      console.log(`[distribute-pending] Contato ${conv.contact_id} - status: ${contactStatus} → ${targetRole}`);

      // Se o agente atual não tem a role correta para esta conversa, pular
      if (currentAgentRole !== targetRole) {
        continue;
      }

      // Se não há agentes online com a role correta, pular esta conversa
      if (targetAgentPool.length === 0) {
        console.log(`[distribute-pending] Nenhum agente ${targetRole} online para conversa ${conv.id}`);
        continue;
      }

      // Encontrar agente com menos conversas dentro do pool correto
      let targetAgentId = agentId;
      let minConversations = conversationCountByAgent[agentId] ?? Infinity;

      for (const a of targetAgentPool) {
        const count = conversationCountByAgent[a.id] || 0;
        if (count < minConversations) {
          minConversations = count;
          targetAgentId = a.id;
        }
      }

      // Se não é para este agente (outro agente tem menos conversas), pular
      if (targetAgentId !== agentId) {
        continue;
      }

      // Atribuir conversa ao agente
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({
          assigned_to: agentId,
          ai_mode: 'copilot', // ✅ FIX: Conversa atribuída entra em copilot para liberar o composer
          needs_human_review: false // 🆕 Resetar flag quando atribuído
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

      const waitInfo = conv.waitTimeMinutes > 0 ? ` (aguardando ${conv.waitTimeMinutes}min)` : '';
      
      // Inserir mensagem de sistema
      await supabaseClient.from('messages').insert({
        conversation_id: conv.id,
        content: `👤 ${agent.full_name} entrou na conversa e assumirá o atendimento.${waitInfo}`,
        sender_type: 'system',
        channel: 'chat' // Corrigido: usar valor válido do enum conversation_channel
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
