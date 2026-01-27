import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteConversationRequest {
  conversationId: string;
  priority?: number;
  department_id?: string;  // Slug do departamento (ex: "comercial", "suporte_n1")
  targetDepartmentId?: string;  // 🆕 UUID direto do departamento (usado pelo Transfer Node)
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

// 🆕 Mapeamento de slug de departamento -> nome do departamento no banco
const DEPARTMENT_SLUG_MAPPING: Record<string, string> = {
  'comercial': 'Comercial',
  'vendas': 'Comercial',
  'sales': 'Comercial',
  'suporte_n1': 'Suporte',
  'suporte': 'Suporte',
  'support': 'Suporte',
  'tecnico': 'Suporte',
  'technical': 'Suporte',
  'financeiro': 'Financeiro',
  'financial': 'Financeiro',
  'finance': 'Financeiro',
  'logistica': 'Operacional',
  'logistics': 'Operacional',
  'operacional': 'Operacional',
  'operations': 'Operacional',
  'juridico': 'Suporte', // Fallback para suporte quando não há dept jurídico
};

// 🆕 Mapeamento de nome de departamento -> roles permitidos
const DEPARTMENT_ROLE_MAPPING: Record<string, string[]> = {
  'Comercial': ['sales_rep'],
  'Vendas': ['sales_rep'],
  'Suporte': ['support_agent'],
  'Suporte Pedidos': ['support_agent'],
  'Suporte Sistema': ['support_agent'],
  'Financeiro': ['financial_agent', 'support_agent'],
  'Operacional': ['support_agent'],
  'Customer Success': ['support_agent', 'consultant'],
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

    const { conversationId, priority = 0, department_id, targetDepartmentId, aiAnalysis } = await req.json() as RouteConversationRequest;

    console.log(`[route-conversation] 🔄 Processing conversation: ${conversationId}`);
    console.log(`[route-conversation] 📌 Params: priority=${priority}, department_id=${department_id}, targetDepartmentId=${targetDepartmentId}, AI category=${aiAnalysis?.category}`);

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
        ai_mode,
        assigned_to,
        contacts (
          id,
          first_name,
          last_name,
          consultant_id,
          support_channel_id,
          phone,
          whatsapp_id
        ),
        departments:department (
          id,
          name
        )
      `)
      .eq('id', conversationId)
      .single();
    
    console.log('[route-conversation] 📥 Conversation data:', { 
      found: !!conversation, 
      department: conversation?.department,
      departmentName: (conversation?.departments as any)?.name,
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

    // 🛡️ VERIFICAÇÃO ANTI-DUPLICATA: Se já está em copilot com agente, ignorar
    if (conversation.ai_mode === 'copilot' && conversation.assigned_to) {
      console.log('[route-conversation] ⚠️ Conversa já está em copilot com agente atribuído. Ignorando.');
      return new Response(
        JSON.stringify({
          success: true,
          assigned_to: conversation.assigned_to,
          assignment_type: 'already_assigned',
          message: 'Conversa já atribuída a um agente'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🆕 2. RESOLVER DEPARTAMENTO A PARTIR DO department_id OU targetDepartmentId
    let resolvedDepartmentId = conversation.department;
    let resolvedDepartmentName = (conversation.departments as any)?.name || null;
    
    // 🆕 PRIORIDADE 1: targetDepartmentId (UUID direto do Transfer Node)
    if (targetDepartmentId && !conversation.department) {
      console.log(`[route-conversation] 🎯 Using targetDepartmentId (UUID): "${targetDepartmentId}"`);
      
      // Buscar departamento pelo UUID
      const { data: targetDept, error: targetDeptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('id', targetDepartmentId)
        .maybeSingle();
      
      if (targetDept && !targetDeptError) {
        console.log(`[route-conversation] ✅ Found department by UUID: ${targetDept.name} (${targetDept.id})`);
        
        // Atualizar conversa com o departamento ANTES de rotear
        const { error: updateDeptError } = await supabase
          .from('conversations')
          .update({ department: targetDept.id })
          .eq('id', conversationId);
        
        if (updateDeptError) {
          console.error('[route-conversation] ⚠️ Failed to update conversation department:', updateDeptError.message);
        } else {
          console.log(`[route-conversation] ✅ Conversation department updated to: ${targetDept.name}`);
          resolvedDepartmentId = targetDept.id;
          resolvedDepartmentName = targetDept.name;
        }
      } else {
        console.log(`[route-conversation] ⚠️ Department not found for UUID: "${targetDepartmentId}"`);
      }
    }
    // PRIORIDADE 2: department_id (slug)
    else if (department_id && !conversation.department) {
      console.log(`[route-conversation] 🏷️ Resolving department from slug: "${department_id}"`);
      
      const deptSlug = department_id.toLowerCase();
      const deptName = DEPARTMENT_SLUG_MAPPING[deptSlug];
      
      if (deptName) {
        console.log(`[route-conversation] 🔄 Mapped slug "${deptSlug}" -> "${deptName}"`);
        
        // Buscar UUID do departamento no banco
        const { data: dept, error: deptError } = await supabase
          .from('departments')
          .select('id, name')
          .ilike('name', deptName)
          .maybeSingle();
        
        if (dept && !deptError) {
          console.log(`[route-conversation] ✅ Found department: ${dept.name} (${dept.id})`);
          
          // Atualizar conversa com o departamento ANTES de rotear
          const { error: updateDeptError } = await supabase
            .from('conversations')
            .update({ department: dept.id })
            .eq('id', conversationId);
          
          if (updateDeptError) {
            console.error('[route-conversation] ⚠️ Failed to update conversation department:', updateDeptError.message);
          } else {
            console.log(`[route-conversation] ✅ Conversation department updated to: ${dept.name}`);
            resolvedDepartmentId = dept.id;
            resolvedDepartmentName = dept.name;
          }
        } else {
          console.log(`[route-conversation] ⚠️ Department not found for name: "${deptName}"`);
        }
      } else {
        console.log(`[route-conversation] ⚠️ No mapping found for slug: "${deptSlug}"`);
      }
    }

    // REMOVIDO: STICKY AGENT (Consultor da Carteira)
    // Consultores NÃO recebem conversas automaticamente - apenas via transferência manual
    if (contact?.consultant_id) {
      console.log('[route-conversation] ℹ️ Contato tem consultor vinculado:', contact.consultant_id);
      console.log('[route-conversation] ℹ️ Consultores não recebem conversas automáticas - seguindo para distribuição normal');
    }

    // 🆕 3. DETERMINAR ROLES PERMITIDOS PARA O DEPARTAMENTO
    const allowedRoles = resolvedDepartmentName 
      ? (DEPARTMENT_ROLE_MAPPING[resolvedDepartmentName] || ['support_agent'])
      : ['support_agent'];
    
    console.log(`[route-conversation] 🎯 Department: ${resolvedDepartmentName || 'none'} -> Allowed roles: [${allowedRoles.join(', ')}]`);

    // 🆕 3.1. BUSCAR TIMES VINCULADOS AO CANAL (team_channels)
    const supportChannelId = conversation.support_channel_id || contact?.support_channel_id;
    console.log('[route-conversation] 📡 Support channel:', supportChannelId || 'none');
    
    let priorityTeamMemberIds: string[] = [];
    
    if (supportChannelId) {
      console.log('[route-conversation] 🔍 Looking for teams linked to this channel...');
      
      // Buscar times vinculados a este canal
      const { data: teamChannels, error: tcError } = await supabase
        .from('team_channels')
        .select('team_id')
        .eq('channel_id', supportChannelId);
      
      if (!tcError && teamChannels && teamChannels.length > 0) {
        const teamIds = teamChannels.map(tc => tc.team_id);
        console.log(`[route-conversation] ✅ Found ${teamIds.length} teams linked to channel`);
        
        // Buscar membros desses times
        const { data: teamMembers, error: tmError } = await supabase
          .from('team_members')
          .select('user_id')
          .in('team_id', teamIds);
        
        if (!tmError && teamMembers) {
          priorityTeamMemberIds = teamMembers.map(tm => tm.user_id);
          console.log(`[route-conversation] 👥 Priority agents from teams: ${priorityTeamMemberIds.length}`);
        }
      } else {
        console.log('[route-conversation] ℹ️ No teams linked to this channel');
      }
    }

    // 4. PRIORIDADE 2: SKILL-BASED ROUTING (Agentes com Skill Específica + Canal)
    let onlineAgents: any[] = [];
    let routingStrategy = 'load_balancing';
    let requiredSkillName: string | null = null;
    
    // 4.1 Identificar skill necessária baseada na análise da IA
    const aiCategory = aiAnalysis?.category?.toLowerCase();
    requiredSkillName = aiCategory ? SKILL_MAPPING[aiCategory] : null;
    
    if (requiredSkillName) {
      console.log(`[route-conversation] 🎯 Skill-based routing: Looking for agents with skill "${requiredSkillName}"`);
      
      // 🆕 HIERARQUIA: Buscar parent_id do departamento para fallback (skill-based)
      let skillParentDepartmentId: string | null = null;
      
      if (resolvedDepartmentId) {
        const { data: skillDeptData } = await supabase
          .from('departments')
          .select('parent_id')
          .eq('id', resolvedDepartmentId)
          .maybeSingle();
        
        if (skillDeptData?.parent_id) {
          skillParentDepartmentId = skillDeptData.parent_id;
          console.log(`[route-conversation] 📂 Skill routing - Department has parent: ${skillParentDepartmentId}`);
        }
      }
      
      // 🆕 Buscar agentes com os roles permitidos para o departamento
      const { data: roleAgentIds } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', allowedRoles);
      
      if (!roleAgentIds || roleAgentIds.length === 0) {
        console.log(`[route-conversation] ❌ Nenhum agente encontrado com roles: [${allowedRoles.join(', ')}]`);
        onlineAgents = [];
      } else {
        // Buscar agentes online COM a skill específica
        let agentUserIds = roleAgentIds.map(r => r.user_id);
        
        // 🆕 Se temos membros de times prioritários, filtrar por eles primeiro
        if (priorityTeamMemberIds.length > 0) {
          const priorityInRoles = agentUserIds.filter(id => priorityTeamMemberIds.includes(id));
          if (priorityInRoles.length > 0) {
            console.log(`[route-conversation] 🎯 Filtering to ${priorityInRoles.length} priority team members`);
            agentUserIds = priorityInRoles;
          }
        }
        
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
          if (channels.length === 0) return true;
          if (!supportChannelId) return true;
          return channels.some((ac: any) => ac.channel_id === supportChannelId);
        });
        
        // 🆕 HIERARQUIA: Filtrar por departamento COM fallback para pai
        if (resolvedDepartmentId && agentsWithChannel.length > 0) {
          const skillDeptIds = [resolvedDepartmentId];
          if (skillParentDepartmentId) {
            skillDeptIds.push(skillParentDepartmentId);
          }
          onlineAgents = agentsWithChannel.filter(a => skillDeptIds.includes(a.department));
          
          // Ordenar: subdepartamento primeiro
          if (skillParentDepartmentId && onlineAgents.length > 0) {
            onlineAgents.sort((a, b) => {
              if (a.department === resolvedDepartmentId && b.department !== resolvedDepartmentId) return -1;
              if (b.department === resolvedDepartmentId && a.department !== resolvedDepartmentId) return 1;
              return 0;
            });
          }
        } else {
          onlineAgents = agentsWithChannel;
        }
        
        if (onlineAgents.length > 0) {
          routingStrategy = priorityTeamMemberIds.length > 0 ? 'team_channel_based' : 'skill_based';
          console.log(`[route-conversation] ✅ Found ${onlineAgents.length} agents with skill "${requiredSkillName}" and roles [${allowedRoles.join(', ')}]`);
        } else {
          console.log(`[route-conversation] ⚠️ No agents found with skill "${requiredSkillName}", falling back to generic`);
        }
      }
    }
    
    // 5. FALLBACK: Se não encontrou agentes com skill, busca agentes genéricos com roles permitidos
    if (onlineAgents.length === 0) {
      console.log('[route-conversation] 🔍 Searching for agents with roles:', allowedRoles.join(', '));
      console.log('[route-conversation] 📌 Department filter:', resolvedDepartmentId || 'none');
      console.log('[route-conversation] 👥 Priority team members:', priorityTeamMemberIds.length);
      
      // 🆕 HIERARQUIA: Buscar parent_id do departamento para fallback
      let parentDepartmentId: string | null = null;
      
      if (resolvedDepartmentId) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('parent_id')
          .eq('id', resolvedDepartmentId)
          .maybeSingle();
        
        if (deptData?.parent_id) {
          parentDepartmentId = deptData.parent_id;
          console.log(`[route-conversation] 📂 Department has parent: ${parentDepartmentId}`);
        }
      }
      
      // 🆕 Buscar user_ids dos roles permitidos
      const { data: genericRoleIds } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', allowedRoles);
      
      let genericAgents: any[] = [];
      let agentsError = null;
      
      if (genericRoleIds && genericRoleIds.length > 0) {
        let genericAgentUserIds = genericRoleIds.map(r => r.user_id);
        
        // 🆕 Se temos membros de times prioritários, filtrar por eles primeiro
        if (priorityTeamMemberIds.length > 0) {
          const priorityInRoles = genericAgentUserIds.filter(id => priorityTeamMemberIds.includes(id));
          if (priorityInRoles.length > 0) {
            console.log(`[route-conversation] 🎯 Filtering to ${priorityInRoles.length} priority team members`);
            genericAgentUserIds = priorityInRoles;
            routingStrategy = 'team_channel_based';
          }
        }
        
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

        // 🆕 HIERARQUIA: Filtrar por departamento COM fallback para pai
        if (resolvedDepartmentId) {
          const deptIds = [resolvedDepartmentId];
          if (parentDepartmentId) {
            deptIds.push(parentDepartmentId);
            console.log(`[route-conversation] 📂 Searching in departments: [${deptIds.join(', ')}] (including parent)`);
          }
          agentsQuery = agentsQuery.in('department', deptIds);
        }

        const result = await agentsQuery;
        let allGenericAgents = result.data || [];
        agentsError = result.error;

        // Filtrar por canal de atendimento
        genericAgents = allGenericAgents.filter(agent => {
          const channels = agent.agent_support_channels || [];
          if (channels.length === 0) return true;
          if (!supportChannelId) return true;
          return channels.some((ac: any) => ac.channel_id === supportChannelId);
        });
        
        // 🆕 HIERARQUIA: Ordenar - agentes do subdepartamento primeiro, depois do pai
        if (parentDepartmentId && genericAgents.length > 0) {
          genericAgents.sort((a, b) => {
            // Agentes do subdepartamento exato têm prioridade
            if (a.department === resolvedDepartmentId && b.department !== resolvedDepartmentId) return -1;
            if (b.department === resolvedDepartmentId && a.department !== resolvedDepartmentId) return 1;
            return 0;
          });
          console.log(`[route-conversation] 📊 Sorted agents: subdept first, then parent`);
        }
      }
      
      console.log('[route-conversation] 📊 Generic agents query result:', { 
        found_count: genericAgents?.length || 0,
        roles_searched: allowedRoles,
        department_filter: resolvedDepartmentName || 'none',
        parent_department: parentDepartmentId || 'none',
        priority_team_members: priorityTeamMemberIds.length,
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

      console.log(`[route-conversation] ✅ ${routingStrategy === 'skill_based' ? 'SKILL-BASED ROUTING' : 'DEPARTMENT-BASED LOAD BALANCING'} - Assigning to:`, {
        agent: selectedAgent.full_name,
        current_load: selectedAgent.open_conversations,
        routing_strategy: routingStrategy,
        required_skill: requiredSkillName || 'none',
        department: resolvedDepartmentName || 'none',
        allowed_roles: allowedRoles
      });

      // Buscar ai_mode atual ANTES de atualizar
      const currentAiMode = conversation.ai_mode;

      // Se está em waiting_human, MANTER assim até agente responder
      const newAiMode = currentAiMode === 'waiting_human' 
        ? 'waiting_human'
        : 'copilot';

      // Atribuir ao agente com menos carga
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          assigned_to: selectedAgent.id,
          ai_mode: newAiMode,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('[route-conversation] ❌ ERRO ao atualizar conversa:', updateError);
        throw new Error(`Falha ao atribuir conversa: ${updateError.message}`);
      }

      console.log(`[route-conversation] ✅ ai_mode: ${currentAiMode} → ${newAiMode}`);

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
          department: resolvedDepartmentName || null,
          message: `Conversa atribuída a ${selectedAgent.full_name}${requiredSkillName ? ` (Skill: ${requiredSkillName})` : ''}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. FALLBACK: FILA DE ESPERA (Ninguém online)
    console.log('[route-conversation] ⚠️ NO AGENTS AVAILABLE - Adding to queue');
    console.log('[route-conversation] 📌 Searched for roles:', allowedRoles.join(', '), 'in department:', resolvedDepartmentName || 'any');

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

    console.log('[route-conversation] ℹ️ Conversa adicionada à fila - sem mensagem automática');

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
        no_agents_available: true,
        department: resolvedDepartmentName || null,
        searched_roles: allowedRoles,
        message: 'Conversa adicionada à fila de espera - nenhum agente disponível'
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
