import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteConversationRequest {
  conversationId: string;
  priority?: number;
  aiAnalysis?: {
    category?: string;
    intent?: string;
  };
}

// Mapeamento de Categoria da IA -> Skill Necessária
const SKILL_MAPPING: Record<string, string> = {
  'financeiro': 'Financeiro',
  'reembolso': 'Financeiro',
  'cobranca': 'Cobrança',
  'pagamento': 'Financeiro',
  'suporte_tecnico': 'Suporte Técnico',
  'bug': 'Suporte Técnico',
  'tecnico': 'Suporte Técnico',
  'vendas': 'Vendas',
  'upgrade': 'Vendas',
  'upsell': 'Vendas',
  'cancelamento': 'Retenção',
  'churn': 'Retenção',
  'insatisfacao': 'Retenção',
  'onboarding': 'Onboarding',
  'implementacao': 'Onboarding',
  'ingles': 'Inglês',
  'english': 'Inglês',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, priority = 0, aiAnalysis } = await req.json() as RouteConversationRequest;

    console.log(`[route-conversation] 🔄 Processing conversation: ${conversationId}, priority: ${priority}, AI category: ${aiAnalysis?.category}`);

    // 1. Buscar dados da conversa e contato
    console.log('[route-conversation] 📊 Fetching conversation data...');
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        contact_id,
        department,
        channel,
        support_channel_id,
        whatsapp_instance_id,
        contacts (
          id,
          first_name,
          last_name,
          consultant_id,
          support_channel_id,
          phone,
          whatsapp_id
        )
      `)
      .eq('id', conversationId)
      .single();
    
    console.log('[route-conversation] 📥 Conversation data:', { 
      found: !!conversation, 
      department: conversation?.department,
      error: convError?.message 
    });

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
      console.log('[route-conversation] 🎯 STICKY AGENT detected - Checking consultant availability:', contact.consultant_id);
      
      const { data: consultant, error: consultantError } = await supabase
        .from('profiles')
        .select('id, full_name, availability_status')
        .eq('id', contact.consultant_id)
        .eq('availability_status', 'online')
        .single();
      
      console.log('[route-conversation] 👤 Consultant query result:', { 
        found: !!consultant, 
        name: consultant?.full_name,
        status: consultant?.availability_status,
        error: consultantError?.message 
      });

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

    // 3. PRIORIDADE 2: SKILL-BASED ROUTING (Agentes com Skill Específica + Canal)
    let onlineAgents: any[] = [];
    let routingStrategy = 'load_balancing';
    let requiredSkillName: string | null = null;
    
    // 3.1 Identificar skill necessária baseada na análise da IA
    const aiCategory = aiAnalysis?.category?.toLowerCase();
    requiredSkillName = aiCategory ? SKILL_MAPPING[aiCategory] : null;

    // 3.2 Identificar canal da conversa (herdado do contato)
    const supportChannelId = conversation.support_channel_id || contact?.support_channel_id;
    console.log('[route-conversation] 📡 Support channel:', supportChannelId || 'none');
    
    if (requiredSkillName) {
      console.log(`[route-conversation] 🎯 Skill-based routing: Looking for agents with skill "${requiredSkillName}"`);
      
      // FASE 1: Query em 2 etapas - Sem JOIN FK
      // 1. Buscar user_ids de support_agents
      const { data: supportAgentIds } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'support_agent');
      
      if (!supportAgentIds || supportAgentIds.length === 0) {
        console.log('[route-conversation] ❌ Nenhum support_agent encontrado nos roles');
        onlineAgents = [];
      } else {
        // 2. Buscar agentes online COM a skill específica
        const agentUserIds = supportAgentIds.map(r => r.user_id);
        
        const { data: skilledAgents } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            availability_status,
            department,
            profiles_skills!inner(
              skill_id,
              skills!inner(name)
            ),
            agent_support_channels(
              channel_id
            )
          `)
          .eq('availability_status', 'online')
          .in('id', agentUserIds);
      
        // Filtrar agentes que possuem a skill necessária
        const agentsWithSkill = (skilledAgents || []).filter(agent => {
          const skills = Array.isArray(agent.profiles_skills) ? agent.profiles_skills : [agent.profiles_skills];
          return skills.some((ps: any) => {
            const skill = Array.isArray(ps.skills) ? ps.skills[0] : ps.skills;
            return skill?.name === requiredSkillName;
          });
        });
        
        // Filtrar por canal de atendimento
        const agentsWithChannel = agentsWithSkill.filter(agent => {
          const channels = agent.agent_support_channels || [];
          // Se agente não tem nenhum canal, atende todos
          if (channels.length === 0) return true;
          // Se conversa não tem canal, qualquer agente pode atender
          if (!supportChannelId) return true;
          // Senão, verificar se agente atende o canal específico
          return channels.some((ac: any) => ac.channel_id === supportChannelId);
        });
        
        // Filtrar por departamento se houver
        if (conversation.department && agentsWithChannel.length > 0) {
          onlineAgents = agentsWithChannel.filter(a => a.department === conversation.department);
        } else {
          onlineAgents = agentsWithChannel;
        }
        
        if (onlineAgents.length > 0) {
          routingStrategy = 'skill_based';
          console.log(`[route-conversation] ✅ Found ${onlineAgents.length} agents with skill "${requiredSkillName}"`);
        } else {
          console.log(`[route-conversation] ⚠️ No agents found with skill "${requiredSkillName}", falling back to generic`);
        }
      }
    }
    
    // 3.2 FALLBACK: Se não encontrou agentes com skill, busca agentes genéricos
    if (onlineAgents.length === 0) {
      console.log('[route-conversation] 🔍 Searching for generic support agents (load balancing)');
      console.log('[route-conversation] 📌 Department filter:', conversation.department || 'none');
      
      // FASE 1: Query em 2 etapas - Sem JOIN FK
      // 1. Buscar user_ids de support_agents
      const { data: genericSupportIds } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'support_agent');
      
      let genericAgents: any[] = [];
      let agentsError = null;
      
      if (genericSupportIds && genericSupportIds.length > 0) {
        // 2. Buscar profiles desses users
        const genericAgentUserIds = genericSupportIds.map(r => r.user_id);
        
        let agentsQuery = supabase
          .from('profiles')
          .select(`
            id, 
            full_name, 
            availability_status, 
            department,
            agent_support_channels(channel_id)
          `)
          .eq('availability_status', 'online')
          .in('id', genericAgentUserIds);

        // Filtrar por departamento se houver
        if (conversation.department) {
          agentsQuery = agentsQuery.eq('department', conversation.department);
        }

        const result = await agentsQuery;
        let allGenericAgents = result.data || [];
        agentsError = result.error;

        // Filtrar por canal de atendimento
        genericAgents = allGenericAgents.filter(agent => {
          const channels = agent.agent_support_channels || [];
          // Se agente não tem nenhum canal, atende todos
          if (channels.length === 0) return true;
          // Se conversa não tem canal, qualquer agente pode atender
          if (!supportChannelId) return true;
          // Senão, verificar se agente atende o canal específico
          return channels.some((ac: any) => ac.channel_id === supportChannelId);
        });
      }
      
      console.log('[route-conversation] 📊 Generic agents query result:', { 
        found_count: genericAgents?.length || 0,
        error: agentsError?.message 
      });
      
      if (agentsError) {
        throw new Error(`Erro ao buscar agentes: ${agentsError.message}`);
      }
      
      onlineAgents = genericAgents || [];
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

      console.log(`[route-conversation] ✅ ${routingStrategy === 'skill_based' ? 'SKILL-BASED ROUTING' : 'LOAD BALANCING'} - Assigning to:`, {
        agent: selectedAgent.full_name,
        current_load: selectedAgent.open_conversations,
        routing_strategy: routingStrategy,
        required_skill: requiredSkillName || 'none'
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
          assignment_type: routingStrategy,
          current_load: selectedAgent.open_conversations,
          required_skill: requiredSkillName || null,
          message: `Conversa atribuída a ${selectedAgent.full_name}${requiredSkillName ? ` (Skill: ${requiredSkillName})` : ''}`
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
    const queueMessage = '📢 Nossos atendentes estão ocupados ou ausentes no momento. Deixe sua mensagem que responderemos em breve. ⏰';
    
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: queueMessage,
        sender_type: 'system',
        message_type: 'system',
        is_ai_generated: true
      });

    // Enviar via WhatsApp se o canal for WhatsApp
    if (conversation.channel === 'whatsapp' && contact) {
      console.log('[route-conversation] 📱 Enviando mensagem de fila via WhatsApp...');
      
      // Buscar instância WhatsApp conectada
      let instanceId = conversation.whatsapp_instance_id;
      
      if (!instanceId) {
        // Fallback: buscar qualquer instância conectada
        const { data: activeInstance } = await supabase
          .from('whatsapp_instances')
          .select('id')
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle();
        
        instanceId = activeInstance?.id;
      }
      
      if (instanceId) {
        try {
          await supabase.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: instanceId,
              phone_number: contact.phone,
              whatsapp_id: contact.whatsapp_id,
              message: queueMessage
            }
          });
          console.log('[route-conversation] ✅ Mensagem de fila enviada via WhatsApp');
        } catch (whatsappError) {
          console.error('[route-conversation] ❌ Erro ao enviar via WhatsApp:', whatsappError);
        }
      } else {
        console.log('[route-conversation] ⚠️ Nenhuma instância WhatsApp conectada para enviar mensagem');
      }
    }

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
