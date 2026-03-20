import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveDepartments } from "../_shared/department-resolver.ts";

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
  // 🆕 Sub-departamentos de Suporte
  'suporte_sistema': 'Suporte Sistema',
  'suporte_tecnico': 'Suporte Sistema',
  'tecnico': 'Suporte Sistema', // Mudado de 'Suporte' para 'Suporte Sistema'
  'technical': 'Suporte Sistema',
  'sistema': 'Suporte Sistema',
  'suporte_pedidos': 'Suporte Pedidos',
  'pedidos': 'Suporte Pedidos',
  'logistica': 'Suporte Pedidos', // Mudado de 'Operacional' para 'Suporte Pedidos'
  'logistics': 'Suporte Pedidos',
  'rastreio': 'Suporte Pedidos',
  'entrega': 'Suporte Pedidos',
  // Financeiro
  'financeiro': 'Financeiro',
  'financial': 'Financeiro',
  'finance': 'Financeiro',
  // Operacional
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
    // PRIORIDADE 2: department_id (pode ser slug OU UUID)
    else if (department_id && !conversation.department) {
      console.log(`[route-conversation] 🏷️ Resolving department from: "${department_id}"`);
      
      // 🆕 FIX: Verificar se department_id é um UUID válido (36 chars com hifens)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUUID = uuidRegex.test(department_id);
      
      if (isUUID) {
        // department_id é um UUID - buscar diretamente pelo ID
        console.log(`[route-conversation] 🔑 department_id is UUID, querying by id...`);
        
        const { data: deptById, error: deptByIdError } = await supabase
          .from('departments')
          .select('id, name')
          .eq('id', department_id)
          .maybeSingle();
        
        if (deptById && !deptByIdError) {
          console.log(`[route-conversation] ✅ Found department by UUID: ${deptById.name} (${deptById.id})`);
          
          // Atualizar conversa com o departamento ANTES de rotear
          const { error: updateDeptError } = await supabase
            .from('conversations')
            .update({ department: deptById.id })
            .eq('id', conversationId);
          
          if (updateDeptError) {
            console.error('[route-conversation] ⚠️ Failed to update conversation department:', updateDeptError.message);
          } else {
            console.log(`[route-conversation] ✅ Conversation department updated to: ${deptById.name}`);
            resolvedDepartmentId = deptById.id;
            resolvedDepartmentName = deptById.name;
          }
        } else {
          console.log(`[route-conversation] ⚠️ Department not found for UUID: "${department_id}"`);
        }
      } else {
        // department_id é um slug - usar mapeamento
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
    }

    // 🆕 FALLBACK: Se após todas as tentativas de resolução ainda não tem departamento, usar Suporte
    if (!resolvedDepartmentId) {
      const FALLBACK_DEPT_SUPORTE = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
      console.log(`[route-conversation] ⚠️ No department resolved — applying Suporte fallback`);
      
      const { error: fallbackUpdateError } = await supabase
        .from('conversations')
        .update({ department: FALLBACK_DEPT_SUPORTE })
        .eq('id', conversationId);
      
      if (!fallbackUpdateError) {
        resolvedDepartmentId = FALLBACK_DEPT_SUPORTE;
        resolvedDepartmentName = 'Suporte';
        console.log(`[route-conversation] ✅ Fallback applied: department = Suporte`);
      } else {
        console.error(`[route-conversation] ❌ Failed to apply fallback:`, fallbackUpdateError.message);
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
      
      // 🆕 HIERARQUIA COMPLETA: Buscar parent_id, siblings E children para skill-based routing
      let skillParentDepartmentId: string | null = null;
      let skillSiblingDepartmentIds: string[] = [];
      let skillChildDepartmentIds: string[] = [];
      
      if (resolvedDepartmentId) {
        const { data: skillDeptData } = await supabase
          .from('departments')
          .select('parent_id')
          .eq('id', resolvedDepartmentId)
          .maybeSingle();
        
        if (skillDeptData?.parent_id) {
          skillParentDepartmentId = skillDeptData.parent_id;
          console.log(`[route-conversation] 📂 Skill routing - Department has parent: ${skillParentDepartmentId}`);
          
          // 🆕 Buscar departamentos irmãos para skill-based routing
          const { data: skillSiblings } = await supabase
            .from('departments')
            .select('id, name')
            .eq('parent_id', skillParentDepartmentId)
            .eq('is_active', true)
            .neq('id', resolvedDepartmentId);
          
          if (skillSiblings && skillSiblings.length > 0) {
            skillSiblingDepartmentIds = skillSiblings.map(d => d.id);
            console.log(`[route-conversation] 👥 Skill routing - Found ${skillSiblings.length} sibling departments`);
          }
        }
        
        // 🆕 NOVO: Buscar departamentos FILHOS para skill-based routing
        const { data: skillChildren } = await supabase
          .from('departments')
          .select('id, name')
          .eq('parent_id', resolvedDepartmentId)
          .eq('is_active', true);
        
        if (skillChildren && skillChildren.length > 0) {
          skillChildDepartmentIds = skillChildren.map(d => d.id);
          console.log(`[route-conversation] 👶 Skill routing - Found ${skillChildren.length} child departments: ${skillChildren.map(d => d.name).join(', ')}`);
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
            ),
            agent_departments(
              department_id
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
        
        // 🆕 HIERARQUIA EXPANDIDA: Filtrar por departamento COM fallback para filhos, pai E irmãos
        if (resolvedDepartmentId && agentsWithChannel.length > 0) {
          const skillDeptIds = [resolvedDepartmentId];
          // 🆕 Adicionar filhos PRIMEIRO (prioridade alta - agentes especializados)
          if (skillChildDepartmentIds.length > 0) {
            skillDeptIds.push(...skillChildDepartmentIds);
          }
          if (skillParentDepartmentId) {
            skillDeptIds.push(skillParentDepartmentId);
          }
          // Adicionar irmãos ao final (menor prioridade)
          if (skillSiblingDepartmentIds.length > 0) {
            skillDeptIds.push(...skillSiblingDepartmentIds);
          }
          // N:N: Filter agents by department using agent_departments
          onlineAgents = agentsWithChannel.filter(a => {
            // a.agent_departments pode ser array ou single object (PostgREST inlining)
            const agentDepts = Array.isArray((a as any).agent_departments)
              ? (a as any).agent_departments.map((d: any) => d.department_id)
              : [(a as any).agent_departments?.department_id].filter(Boolean);
            return skillDeptIds.some(d => agentDepts.includes(d));
          });
          
          // 🆕 Ordenar: alvo > filhos > pai > irmãos
          if ((skillParentDepartmentId || skillSiblingDepartmentIds.length > 0 || skillChildDepartmentIds.length > 0) && onlineAgents.length > 0) {
            onlineAgents.sort((a, b) => {
              // Prioridade 1: Departamento alvo
              if (a.department === resolvedDepartmentId && b.department !== resolvedDepartmentId) return -1;
              if (b.department === resolvedDepartmentId && a.department !== resolvedDepartmentId) return 1;
              // Prioridade 2: Departamentos FILHOS (especializados)
              if (skillChildDepartmentIds.length > 0) {
                const aIsChild = skillChildDepartmentIds.includes(a.department);
                const bIsChild = skillChildDepartmentIds.includes(b.department);
                if (aIsChild && !bIsChild) return -1;
                if (bIsChild && !aIsChild) return 1;
              }
              // Prioridade 3: Departamento pai
              if (skillParentDepartmentId) {
                if (a.department === skillParentDepartmentId && b.department !== skillParentDepartmentId) return -1;
                if (b.department === skillParentDepartmentId && a.department !== skillParentDepartmentId) return 1;
              }
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
      
      // 🆕 HIERARQUIA COMPLETA: Buscar parent_id, siblings E children do departamento para fallback
      let parentDepartmentId: string | null = null;
      let siblingDepartmentIds: string[] = [];
      let childDepartmentIds: string[] = [];
      
      if (resolvedDepartmentId) {
        const { data: deptData } = await supabase
          .from('departments')
          .select('parent_id')
          .eq('id', resolvedDepartmentId)
          .maybeSingle();
        
        if (deptData?.parent_id) {
          parentDepartmentId = deptData.parent_id;
          console.log(`[route-conversation] 📂 Department has parent: ${parentDepartmentId}`);
          
          // 🆕 Buscar departamentos irmãos (mesmo pai, mesmo nível hierárquico)
          const { data: siblingDepts } = await supabase
            .from('departments')
            .select('id, name')
            .eq('parent_id', parentDepartmentId)
            .eq('is_active', true)
            .neq('id', resolvedDepartmentId);
          
          if (siblingDepts && siblingDepts.length > 0) {
            siblingDepartmentIds = siblingDepts.map(d => d.id);
            console.log(`[route-conversation] 👥 Found ${siblingDepts.length} sibling departments: ${siblingDepts.map(d => d.name).join(', ')}`);
          }
        }
        
        // 🆕 NOVO: Buscar departamentos FILHOS (caso o alvo seja um departamento pai)
        const { data: childDepts } = await supabase
          .from('departments')
          .select('id, name')
          .eq('parent_id', resolvedDepartmentId)
          .eq('is_active', true);
        
        if (childDepts && childDepts.length > 0) {
          childDepartmentIds = childDepts.map(d => d.id);
          console.log(`[route-conversation] 👶 Found ${childDepts.length} child departments: ${childDepts.map(d => d.name).join(', ')}`);
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
            agent_departments(department_id),
            agent_support_channels(channel_id)
          `)
          .eq('availability_status', 'online')
          .in('id', genericAgentUserIds);

        let deptIdsForFilter: string[] = [];
        // 🆕 HIERARQUIA EXPANDIDA: Filtrar por departamento COM fallback para pai, irmãos E filhos
        if (resolvedDepartmentId) {
          // Prioridade: 1º alvo, 2º filhos, 3º pai, 4º irmãos
          const deptIds = [resolvedDepartmentId];
          // 🆕 Adicionar filhos PRIMEIRO (prioridade alta - agentes especializados)
          if (childDepartmentIds.length > 0) {
            deptIds.push(...childDepartmentIds);
          }
          if (parentDepartmentId) {
            deptIds.push(parentDepartmentId);
          }
          // Adicionar irmãos ao final (menor prioridade)
          if (siblingDepartmentIds.length > 0) {
            deptIds.push(...siblingDepartmentIds);
          }
          console.log(`[route-conversation] 📂 Searching in departments: [target, children, parent, siblings] = ${deptIds.length} total`);
          // FIX: Filtragem client-side para evitar "operator does not exist: uuid && unknown"
          // PostgREST sem !inner não exclui registros pai — filtrar após query
          deptIdsForFilter = deptIds;
        }

        const result = await agentsQuery;
        let allGenericAgents = result.data || [];
        agentsError = result.error;

        // FIX: Filtrar por departamento client-side (mesmo padrão do path skill-based)
        if (deptIdsForFilter.length > 0) {
          allGenericAgents = allGenericAgents.filter(a => {
            const agentDepts = Array.isArray(a.agent_departments)
              ? a.agent_departments.map((d: any) => d.department_id)
              : [(a.agent_departments as any)?.department_id].filter(Boolean);
            return deptIdsForFilter.some(d => agentDepts.includes(d));
          });
          console.log(`[route-conversation] 📂 After dept client-side filter: ${allGenericAgents.length} agents`);
        }

        // Filtrar por canal de atendimento
        genericAgents = allGenericAgents.filter(agent => {
          const channels = agent.agent_support_channels || [];
          if (channels.length === 0) return true;
          if (!supportChannelId) return true;
          return channels.some((ac: any) => ac.channel_id === supportChannelId);
        });
        
        // 🆕 HIERARQUIA EXPANDIDA: Ordenar - alvo > filhos > pai > irmãos
        if ((parentDepartmentId || siblingDepartmentIds.length > 0 || childDepartmentIds.length > 0) && genericAgents.length > 0) {
          genericAgents.sort((a, b) => {
            // Prioridade 1: Agentes do departamento exato (alvo)
            if (a.department === resolvedDepartmentId && b.department !== resolvedDepartmentId) return -1;
            if (b.department === resolvedDepartmentId && a.department !== resolvedDepartmentId) return 1;
            
            // Prioridade 2: Agentes de departamentos FILHOS (especializados)
            if (childDepartmentIds.length > 0) {
              const aIsChild = childDepartmentIds.includes(a.department);
              const bIsChild = childDepartmentIds.includes(b.department);
              if (aIsChild && !bIsChild) return -1;
              if (bIsChild && !aIsChild) return 1;
            }
            
            // Prioridade 3: Agentes do departamento pai
            if (parentDepartmentId) {
              if (a.department === parentDepartmentId && b.department !== parentDepartmentId) return -1;
              if (b.department === parentDepartmentId && a.department !== parentDepartmentId) return 1;
            }
            
            // Prioridade 4: Agentes de departamentos irmãos (último recurso)
            return 0;
          });
          console.log(`[route-conversation] 📊 Sorted agents by hierarchy: target > children > parent > siblings`);
        }
      }
      
      console.log('[route-conversation] 📊 Generic agents query result:', { 
        found_count: genericAgents?.length || 0,
        roles_searched: allowedRoles,
        department_filter: resolvedDepartmentName || 'none',
        parent_department: parentDepartmentId || 'none',
        sibling_departments: siblingDepartmentIds.length,
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

      // 🆕 ROUND-ROBIN PURO POR DEPARTAMENTO (sem considerar sobrecarga)
      // Se tem 1 agente no departamento, ele recebe tudo
      // Se tem 2+ agentes, distribui em round-robin rotativo
      
      let selectedAgent: any;
      
      if (onlineAgents.length === 1) {
        // Apenas 1 agente no departamento - recebe todas as conversas
        selectedAgent = onlineAgents[0];
        console.log(`[route-conversation] 🎯 SINGLE AGENT MODE: ${selectedAgent.full_name} receives all conversations for this department`);
      } else {
        // 2+ agentes - Round-robin puro baseado no último atribuído
        console.log(`[route-conversation] 🔄 ROUND-ROBIN MODE: ${onlineAgents.length} agents in department`);
        
        // Buscar última conversa atribuída neste departamento para determinar próximo agente
        const { data: lastAssigned } = await supabase
          .from('conversations')
          .select('assigned_to')
          .eq('status', 'open')
          .eq('department', resolvedDepartmentId)
          .not('assigned_to', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // Encontrar índice do último agente atribuído
        let lastAgentIndex = -1;
        if (lastAssigned?.assigned_to) {
          lastAgentIndex = onlineAgents.findIndex(a => a.id === lastAssigned.assigned_to);
        }
        
        // Próximo agente no round-robin (circular)
        const nextIndex = (lastAgentIndex + 1) % onlineAgents.length;
        selectedAgent = onlineAgents[nextIndex];
        
        console.log(`[route-conversation] 🔄 Last assigned: ${lastAssigned?.assigned_to || 'none'} (index ${lastAgentIndex})`);
        console.log(`[route-conversation] 🔄 Next agent: ${selectedAgent.full_name} (index ${nextIndex})`);
      }

      console.log(`[route-conversation] ✅ ${routingStrategy === 'skill_based' ? 'SKILL-BASED' : 'DEPARTMENT ROUND-ROBIN'} - Assigning to:`, {
        agent: selectedAgent.full_name,
        routing_strategy: 'round_robin_by_department',
        required_skill: requiredSkillName || 'none',
        department: resolvedDepartmentName || 'none',
        agents_in_department: onlineAgents.length,
        allowed_roles: allowedRoles
      });

      // Buscar ai_mode atual ANTES de atualizar
      const currentAiMode = conversation.ai_mode;

      // Se está em waiting_human, MANTER assim até agente responder
      const newAiMode = currentAiMode === 'waiting_human' 
        ? 'waiting_human'
        : 'copilot';

      // Atribuir ao agente selecionado via round-robin
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
          assignment_type: 'round_robin_by_department',
          agents_in_department: onlineAgents.length,
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

    // Verificar posição na fila (excluindo conversas fechadas)
    const { count: queuePosition } = await supabase
      .from('conversation_queue')
      .select('*, conversations!inner(status)', { count: 'exact', head: true })
      .is('assigned_at', null)
      .lte('priority', priority)
      .lte('queued_at', new Date().toISOString())
      .not('conversations.status', 'in', '("closed","resolved","finished")');

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
