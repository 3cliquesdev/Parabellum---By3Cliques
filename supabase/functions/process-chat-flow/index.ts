import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validadores
const validators: Record<string, (value: string) => { valid: boolean; error?: string }> = {
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) 
      ? { valid: true } 
      : { valid: false, error: "Por favor, informe um email válido (exemplo@email.com)" };
  },
  phone: (value) => {
    const digits = value.replace(/\D/g, '');
    const isValid = digits.length >= 10 && digits.length <= 11;
    return isValid 
      ? { valid: true } 
      : { valid: false, error: "Por favor, informe um telefone válido com DDD (ex: 11 99999-9999)" };
  },
  cpf: (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11) {
      return { valid: false, error: "CPF deve ter 11 dígitos" };
    }
    // Validação básica de CPF
    if (/^(\d)\1{10}$/.test(digits)) {
      return { valid: false, error: "CPF inválido" };
    }
    // Cálculo dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let d1 = (sum * 10) % 11;
    if (d1 === 10) d1 = 0;
    if (d1 !== parseInt(digits[9])) {
      return { valid: false, error: "CPF inválido" };
    }
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    let d2 = (sum * 10) % 11;
    if (d2 === 10) d2 = 0;
    if (d2 !== parseInt(digits[10])) {
      return { valid: false, error: "CPF inválido" };
    }
    return { valid: true };
  },
  name: (value) => {
    return value.trim().length >= 2 
      ? { valid: true } 
      : { valid: false, error: "Por favor, informe seu nome completo" };
  },
  text: (value) => {
    return value.trim().length > 0 
      ? { valid: true } 
      : { valid: false, error: "Por favor, informe uma resposta" };
  },
};

// Encontrar próximo nó baseado no tipo
function findNextNode(flowDef: any, currentNode: any, path?: string): any {
  const edges = flowDef.edges || [];
  
  // Para nós de condição, usar o path (true/false)
  if (currentNode.type === 'condition' && path) {
    const edge = edges.find((e: any) => 
      e.source === currentNode.id && e.sourceHandle === path
    );
    if (edge) {
      return flowDef.nodes.find((n: any) => n.id === edge.target);
    }
  }
  
  // Para nós de opções, usar o path como ID da opção
  if (currentNode.type === 'ask_options' && path) {
    const edge = edges.find((e: any) => 
      e.source === currentNode.id && e.sourceHandle === path
    );
    if (edge) {
      return flowDef.nodes.find((n: any) => n.id === edge.target);
    }
    // Fallback: buscar edge sem handle específico
  }
  
  // Para outros nós, buscar edge simples
  const edge = edges.find((e: any) => e.source === currentNode.id && !e.sourceHandle);
  if (!edge) {
    // Tentar qualquer edge saindo deste nó
    const anyEdge = edges.find((e: any) => e.source === currentNode.id);
    if (anyEdge) {
      return flowDef.nodes.find((n: any) => n.id === anyEdge.target);
    }
    return null;
  }
  return flowDef.nodes.find((n: any) => n.id === edge.target);
}

// Substituir variáveis no texto
function replaceVariables(text: string, collectedData: Record<string, any>): string {
  let result = text;
  for (const [key, value] of Object.entries(collectedData)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return result;
}

// Avaliar condição
function evaluateCondition(condition: any, collectedData: Record<string, any>, userMessage: string): boolean {
  const { condition_type, condition_field, condition_value } = condition;
  const fieldValue = collectedData[condition_field] || "";
  
  switch (condition_type) {
    case "contains":
      return userMessage.toLowerCase().includes((condition_value || "").toLowerCase());
    case "equals":
      return fieldValue.toLowerCase() === (condition_value || "").toLowerCase();
    case "has_data":
      return !!fieldValue && fieldValue.trim().length > 0;
    case "regex":
      try {
        const regex = new RegExp(condition_value || "", "i");
        return regex.test(userMessage);
      } catch {
        return false;
      }
    case "is_true":
      return fieldValue === true || fieldValue === "true";
    case "is_false":
      return fieldValue === false || fieldValue === "false";
    default:
      return false;
  }
}

// Handler para nó fetch_order
async function handleFetchOrderNode(
  node: any, 
  collectedData: Record<string, any>, 
  lastMessage: string
): Promise<Record<string, any>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Obter valor a buscar: da variável configurada ou da última mensagem
  const sourceVariable = node.data?.source_variable;
  const searchValue = sourceVariable && collectedData[sourceVariable] 
    ? collectedData[sourceVariable] 
    : lastMessage;

  console.log('[process-chat-flow] 📦 Fetch order:', { searchValue, sourceVariable });

  try {
    // Chamar fetch-tracking edge function
    const trackingResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-tracking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ 
        tracking_codes: [searchValue.trim()],
        search_type: node.data?.search_type || 'auto'
      }),
    });

    const result = await trackingResponse.json();
    console.log('[process-chat-flow] 📦 Tracking result:', result);

    // Mapear nomes das variáveis configuradas ou usar defaults
    const foundKey = node.data?.save_found_as || 'order_found';
    const statusKey = node.data?.save_status_as || 'order_status';
    const packedAtKey = node.data?.save_packed_at_as || 'packed_at_formatted';

    // Atualizar dados coletados com resultado
    const updatedData = { ...collectedData };
    updatedData[foundKey] = result.found > 0;
    
    if (result.found > 0 && result.data) {
      const orderData = Object.values(result.data).find((v: any) => v !== null) as any;
      if (orderData) {
        updatedData[statusKey] = orderData.status || 'UNKNOWN';
        updatedData[packedAtKey] = orderData.packed_at_formatted || 'N/A';
        updatedData.order_box_number = orderData.box_number;
        updatedData.order_platform = orderData.platform;
        updatedData.order_packed_at = orderData.packed_at;
        updatedData.order_is_packed = orderData.is_packed;
      }
    } else {
      updatedData[statusKey] = null;
      updatedData[packedAtKey] = null;
      updatedData.order_box_number = null;
      updatedData.order_platform = null;
      updatedData.order_packed_at = null;
      updatedData.order_is_packed = false;
    }

    return updatedData;
  } catch (error) {
    console.error('[process-chat-flow] ❌ Error fetching order:', error);
    // Em caso de erro, retornar como não encontrado
    const foundKey = node.data?.save_found_as || 'order_found';
    return {
      ...collectedData,
      [foundKey]: false,
      order_error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { conversationId, userMessage, flowId, manualTrigger } = body;
    
    if (!conversationId) {
      return new Response(
        JSON.stringify({ useAI: true, reason: "No conversationId provided" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-chat-flow] Processing:', { 
      conversationId, 
      userMessage: userMessage?.slice(0, 50),
      manualTrigger: !!manualTrigger,
      flowId 
    });

    // 🆕 TRIGGER MANUAL: Iniciar fluxo específico diretamente
    if (manualTrigger && flowId) {
      console.log('[process-chat-flow] 🚀 Manual trigger for flow:', flowId);
      
      const { data: flow, error: flowError } = await supabaseClient
        .from('chat_flows')
        .select('*')
        .eq('id', flowId)
        .single();

      if (flowError || !flow) {
        console.error('[process-chat-flow] Flow not found:', flowError);
        return new Response(
          JSON.stringify({ error: "Fluxo não encontrado", useAI: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      if (!flow.is_active) {
        return new Response(
          JSON.stringify({ error: "Fluxo está inativo", useAI: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Cancelar qualquer fluxo ativo anterior
      await supabaseClient
        .from('chat_flow_states')
        .update({ status: 'cancelled' })
        .eq('conversation_id', conversationId)
        .eq('status', 'active');

      // Iniciar o fluxo
      const flowDef = flow.flow_definition as any;
      if (!flowDef?.nodes?.length) {
        return new Response(
          JSON.stringify({ error: "Fluxo sem nós definidos", useAI: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Encontrar primeiro nó
      const targetIds = new Set((flowDef.edges || []).map((e: any) => e.target));
      const startNode = flowDef.nodes.find((n: any) => !targetIds.has(n.id)) || flowDef.nodes[0];

      // Criar estado do fluxo
      const { data: newState, error: createError } = await supabaseClient
        .from('chat_flow_states')
        .insert({
          conversation_id: conversationId,
          flow_id: flow.id,
          current_node_id: startNode.id,
          collected_data: {},
          status: 'active',
        })
        .select()
        .single();

      if (createError) {
        console.error('[process-chat-flow] Error creating state:', createError);
        return new Response(
          JSON.stringify({ error: "Erro ao iniciar fluxo", useAI: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('[process-chat-flow] ✅ Manual flow started:', newState.id);

      const startMessage = startNode.data?.message || "";
      const options = startNode.type === 'ask_options' 
        ? (startNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))
        : null;

      return new Response(
        JSON.stringify({
          useAI: false,
          response: startMessage,
          options,
          flowId: flow.id,
          flowStarted: true,
          manualTrigger: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verificar se existe estado ativo para esta conversa
    const { data: activeState, error: stateError } = await supabaseClient
      .from('chat_flow_states')
      .select('*, chat_flows(*)')
      .eq('conversation_id', conversationId)
      .eq('status', 'active')
      .maybeSingle();

    if (stateError) {
      console.error('[process-chat-flow] Error fetching state:', stateError);
      return new Response(
        JSON.stringify({ useAI: true, reason: "Error fetching flow state" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Se tem estado ativo, processar resposta do usuário
    if (activeState) {
      console.log('[process-chat-flow] Active flow found:', activeState.flow_id);
      
      const flowDef = activeState.chat_flows?.flow_definition as any;
      if (!flowDef?.nodes) {
        return new Response(
          JSON.stringify({ useAI: true, reason: "Invalid flow definition" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const currentNode = flowDef.nodes.find((n: any) => n.id === activeState.current_node_id);
      if (!currentNode) {
        return new Response(
          JSON.stringify({ useAI: true, reason: "Current node not found" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let collectedData = (activeState.collected_data || {}) as Record<string, any>;
      
      // Validar resposta baseado no tipo de nó
      let validationType = 'text';
      if (currentNode.type === 'ask_name') validationType = 'name';
      else if (currentNode.type === 'ask_email') validationType = 'email';
      else if (currentNode.type === 'ask_phone') validationType = 'phone';
      else if (currentNode.type === 'ask_cpf') validationType = 'cpf';
      
      // Executar validação se necessário
      if (currentNode.data?.validate !== false && validators[validationType]) {
        const validation = validators[validationType](userMessage);
        if (!validation.valid) {
          console.log('[process-chat-flow] Validation failed:', validation.error);
          return new Response(
            JSON.stringify({
              useAI: false,
              response: validation.error,
              retry: true,
              flowId: activeState.flow_id,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Salvar dado coletado
      if (currentNode.data?.save_as) {
        collectedData[currentNode.data.save_as] = userMessage;
      }

      // Determinar próximo nó
      let nextNode: any = null;
      let path: string | undefined;

      if (currentNode.type === 'ask_options') {
        // Encontrar opção selecionada
        const options = currentNode.data?.options || [];
        let selectedOption = options.find((opt: any) => 
          opt.label.toLowerCase() === userMessage.toLowerCase() ||
          opt.value.toLowerCase() === userMessage.toLowerCase()
        );
        
        // 🆕 MATCHING NUMÉRICO: Permitir resposta "1", "2", "3"...
        if (!selectedOption) {
          const numericChoice = parseInt(userMessage.trim());
          if (!isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= options.length) {
            selectedOption = options[numericChoice - 1];
            console.log('[process-chat-flow] 🔢 Numeric choice matched:', numericChoice, '→', selectedOption?.label);
          }
        }
        
        // 🆕 MATCHING FUZZY: Tentar match parcial se nenhum match exato
        if (!selectedOption) {
          const normalizedInput = userMessage.toLowerCase().trim();
          selectedOption = options.find((opt: any) => 
            opt.label.toLowerCase().includes(normalizedInput) ||
            normalizedInput.includes(opt.label.toLowerCase().split(' ')[0])
          );
          if (selectedOption) {
            console.log('[process-chat-flow] 🔍 Fuzzy match found:', userMessage, '→', selectedOption.label);
          }
        }
        
        if (selectedOption) {
          path = selectedOption.id;
          collectedData[currentNode.data?.save_as || 'choice'] = selectedOption.value;
        }
      } else if (currentNode.type === 'condition') {
        const conditionResult = evaluateCondition(currentNode.data, collectedData, userMessage);
        path = conditionResult ? 'true' : 'false';
      }

      nextNode = findNextNode(flowDef, currentNode, path);

      // 🆕 Handler especial para fetch_order
      if (nextNode?.type === 'fetch_order') {
        console.log('[process-chat-flow] 📦 Processing fetch_order node');
        
        // Executar busca de pedido
        collectedData = await handleFetchOrderNode(nextNode, collectedData, userMessage);
        
        // Atualizar estado com dados coletados
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            current_node_id: nextNode.id,
          })
          .eq('id', activeState.id);

        // Avançar para o próximo nó após fetch_order (automático)
        const nodeAfterFetch = findNextNode(flowDef, nextNode);
        
        if (nodeAfterFetch) {
          // Se próximo é condição, avaliar automaticamente
          if (nodeAfterFetch.type === 'condition') {
            const conditionResult = evaluateCondition(nodeAfterFetch.data, collectedData, userMessage);
            const conditionPath = conditionResult ? 'true' : 'false';
            nextNode = findNextNode(flowDef, nodeAfterFetch, conditionPath);
            
            // Atualizar estado para após a condição
            await supabaseClient
              .from('chat_flow_states')
              .update({
                collected_data: collectedData,
                current_node_id: nextNode?.id || nodeAfterFetch.id,
              })
              .eq('id', activeState.id);
          } else {
            nextNode = nodeAfterFetch;
            await supabaseClient
              .from('chat_flow_states')
              .update({
                collected_data: collectedData,
                current_node_id: nextNode.id,
              })
              .eq('id', activeState.id);
          }
        }
      }

      // Se não há próximo nó ou é um nó de fim
      if (!nextNode || nextNode.type === 'end') {
        // Marcar fluxo como completo
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', activeState.id);

        const endMessage = nextNode?.data?.message 
          ? replaceVariables(nextNode.data.message, collectedData)
          : "Obrigado! Suas informações foram registradas.";

        // Executar ação final se configurada
        if (nextNode?.data?.end_action === 'create_lead') {
          console.log('[process-chat-flow] Creating lead from collected data');
          // TODO: Implementar criação de lead
        }

        return new Response(
          JSON.stringify({
            useAI: false,
            response: endMessage,
            flowCompleted: true,
            collectedData,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se é um nó de transferência
      if (nextNode.type === 'transfer') {
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            current_node_id: nextNode.id,
            status: 'transferred',
          })
          .eq('id', activeState.id);

        return new Response(
          JSON.stringify({
            useAI: false,
            response: replaceVariables(nextNode.data?.message || "Transferindo para um atendente...", collectedData),
            transfer: true,
            transferType: nextNode.data?.transfer_type,
            departmentId: nextNode.data?.department_id,
            collectedData,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se é um nó de resposta IA
      if (nextNode.type === 'ai_response') {
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            current_node_id: nextNode.id,
          })
          .eq('id', activeState.id);

        // 🆕 Retornar personaId e kbCategories do nó para uso no ai-autopilot-chat
        return new Response(
          JSON.stringify({
            useAI: true,
            contextPrompt: nextNode.data?.context_prompt,
            useKnowledgeBase: nextNode.data?.use_knowledge_base !== false,
            collectedData,
            // Novos campos para seleção específica de persona e KB
            personaId: nextNode.data?.persona_id || null,
            personaName: nextNode.data?.persona_name || null,
            kbCategories: nextNode.data?.kb_categories || null,
            fallbackMessage: nextNode.data?.fallback_message || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atualizar estado e retornar próxima pergunta
      await supabaseClient
        .from('chat_flow_states')
        .update({
          collected_data: collectedData,
          current_node_id: nextNode.id,
        })
        .eq('id', activeState.id);

      const nextMessage = replaceVariables(nextNode.data?.message || "", collectedData);
      const options = nextNode.type === 'ask_options' 
        ? (nextNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))
        : null;

      return new Response(
        JSON.stringify({
          useAI: false,
          response: nextMessage,
          options,
          flowId: activeState.flow_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Detectar se mensagem dispara um fluxo
    if (!userMessage) {
      return new Response(
        JSON.stringify({ useAI: true, reason: "No message to check triggers" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: flows, error: flowsError } = await supabaseClient
      .from('chat_flows')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (flowsError || !flows?.length) {
      return new Response(
        JSON.stringify({ useAI: true, reason: "No active flows" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Função para normalizar texto (remove acentos e pontuação)
    function normalizeText(text: string): string {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\w\s]/g, '') // Remove pontuação
        .trim();
    }

    const messageNorm = normalizeText(userMessage);
    const messageLower = userMessage.toLowerCase();
    let matchedFlow = null;

    console.log('[process-chat-flow] Checking triggers for message:', messageNorm.slice(0, 80));

    for (const flow of flows) {
      const keywords = flow.trigger_keywords || [];
      const triggers = flow.triggers || [];
      const allTriggers = [...keywords, ...triggers];

      for (const trigger of allTriggers) {
        const triggerNorm = normalizeText(trigger);
        
        // Match 0: MATCH EXATO - Se a mensagem é igual ou quase igual ao trigger
        // Isso resolve o caso "Olá vim pelo email e gostaria de saber da promoção de pré carnaval"
        if (messageNorm === triggerNorm) {
          console.log('[process-chat-flow] ✅ Match EXATO (100%):', trigger);
          matchedFlow = flow;
          break;
        }
        
        // Match 0.5: ALTA SIMILARIDADE (90%+) - Para frases longas quase idênticas
        if (triggerNorm.length > 40 && messageNorm.length > 30) {
          const triggerWords = triggerNorm.split(/\s+/);
          const messageWords = messageNorm.split(/\s+/);
          const matchedCount = triggerWords.filter(w => messageWords.includes(w)).length;
          const similarity = matchedCount / Math.max(triggerWords.length, messageWords.length);
          
          if (similarity >= 0.85) {
            console.log('[process-chat-flow] ✅ Match ALTA SIMILARIDADE (', Math.round(similarity * 100), '%):', trigger);
            matchedFlow = flow;
            break;
          }
        }
        
        // Match 1: Inclusão direta - mensagem contém o trigger
        // 🆕 CORREÇÃO: Para triggers longos (>30 chars), exigir keywords ESSENCIAIS
        if (triggerNorm.length < 30) {
          // Keyword curto: match por inclusão normal
          if (messageNorm.includes(triggerNorm)) {
            console.log('[process-chat-flow] ✅ Match direto (keyword curto):', trigger);
            matchedFlow = flow;
            break;
          }
        } else {
          // Trigger longo: exigir palavras essenciais específicas
          // Evita que "Olá vim pelo site" faça match com "Olá vim pelo email promocao carnaval"
          const stopWords = ['ola', 'pelo', 'email', 'site', 'gostaria', 'saber', 'sobre', 'quero', 'como', 'para', 'que', 'vim', 'da', 'de', 'do', 'pre', 'o', 'a', 'e', 'ou'];
          const essentialKeywords = triggerNorm.split(/\s+/).filter(w => 
            w.length > 3 && !stopWords.includes(w)
          );
          
          // 🆕 MELHORIA: Usar matching por palavra (não substring) para evitar falsos positivos
          const messageWords = messageNorm.split(/\s+/);
          const matchedEssentials = essentialKeywords.filter(keyword => 
            // Match exato de palavra OU substring (para palavras compostas)
            messageWords.includes(keyword) || messageNorm.includes(keyword)
          );
          
          console.log('[process-chat-flow] Trigger longo check:', { 
            trigger: trigger.slice(0, 50), 
            essentials: essentialKeywords, 
            messageWords: messageWords.slice(0, 15),
            matched: matchedEssentials 
          });
          
          // 🆕 MELHORIA: Se trigger tem 1 keyword essencial ou menos, aceitar 1 match
          // Se trigger tem 2+ keywords essenciais, exigir pelo menos 1
          const minMatches = essentialKeywords.length <= 1 ? 1 : 1;
          if (matchedEssentials.length >= minMatches && essentialKeywords.length > 0) {
            console.log('[process-chat-flow] ✅ Match por keywords essenciais:', matchedEssentials);
            matchedFlow = flow;
            break;
          }
        }
        
        // Match 2: Trigger contém a mensagem (usuário escreveu parte do trigger)
        // 🆕 CORREÇÃO: Só aplica se o TRIGGER é curto (keyword < 30 chars)
        // Isso evita que "Olá" faça match com trigger longo "Olá vim pelo email..."
        if (triggerNorm.length < 30 && triggerNorm.includes(messageNorm) && messageNorm.length >= 10) {
          console.log('[process-chat-flow] ✅ Match reverso (keyword curto contém msg):', trigger);
          matchedFlow = flow;
          break;
        }
        
        // Match 3: Similaridade por palavras (para triggers longos > 20 chars)
        if (triggerNorm.length > 20) {
          const triggerWords = triggerNorm.split(/\s+/).filter(w => w.length > 3);
          const matchedWords = triggerWords.filter(w => messageNorm.includes(w));
          const matchRatio = triggerWords.length > 0 ? matchedWords.length / triggerWords.length : 0;
          
          // Se 60%+ das palavras significativas do trigger estão na mensagem
          if (matchRatio >= 0.6 && matchedWords.length >= 3) {
            console.log('[process-chat-flow] ✅ Match fuzzy (', Math.round(matchRatio * 100), '% palavras):', trigger);
            matchedFlow = flow;
            break;
          }
        }
      }
      if (matchedFlow) break;
    }

    if (!matchedFlow) {
      // 🆕 MASTER FLOW: Se não encontrou trigger, verificar se existe um fluxo mestre
      console.log('[process-chat-flow] No trigger matched - checking for Master Flow...');
      
      const { data: masterFlow } = await supabaseClient
        .from('chat_flows')
        .select('*')
        .eq('is_master_flow', true)
        .eq('is_active', true)
        .maybeSingle();
      
      if (masterFlow) {
        console.log('[process-chat-flow] 🎯 MASTER FLOW found:', masterFlow.name);
        
        // 🆕 CORREÇÃO: Executar o fluxo mestre como qualquer outro fluxo
        // Antes: apenas retornava configs sem executar os nós
        const flowDef = masterFlow.flow_definition as any;
        
        if (!flowDef?.nodes?.length) {
          console.log('[process-chat-flow] Master Flow vazio - usando IA padrão');
          const aiNode = flowDef?.nodes?.find((n: any) => n.type === 'ai_response');
          return new Response(
            JSON.stringify({
              useAI: true,
              reason: "Master Flow has no nodes",
              masterFlowId: masterFlow.id,
              personaId: aiNode?.data?.persona_id || null,
              kbCategories: aiNode?.data?.kb_categories || null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Encontrar primeiro nó (sem edges apontando para ele)
        const targetIds = new Set((flowDef.edges || []).map((e: any) => e.target));
        const startNode = flowDef.nodes.find((n: any) => !targetIds.has(n.id)) || flowDef.nodes[0];
        
        console.log('[process-chat-flow] 🚀 Iniciando Master Flow - primeiro nó:', startNode.type, startNode.id);
        
        // Criar estado do fluxo para o master flow
        const { data: newState, error: createError } = await supabaseClient
          .from('chat_flow_states')
          .insert({
            conversation_id: conversationId,
            flow_id: masterFlow.id,
            current_node_id: startNode.id,
            collected_data: {},
            status: 'active',
          })
          .select()
          .single();
        
        if (createError) {
          console.error('[process-chat-flow] Error creating master flow state:', createError);
          // Fallback: retornar configs para IA
          const aiNode = flowDef?.nodes?.find((n: any) => n.type === 'ai_response');
          return new Response(
            JSON.stringify({
              useAI: true,
              reason: "Error creating master flow state - fallback to AI config",
              masterFlowId: masterFlow.id,
              personaId: aiNode?.data?.persona_id || null,
              kbCategories: aiNode?.data?.kb_categories || null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('[process-chat-flow] ✅ Master Flow started:', newState.id);
        
        // Se primeiro nó é AI, retornar useAI true com configs
        if (startNode.type === 'ai_response') {
          return new Response(
            JSON.stringify({
              useAI: true,
              reason: "Master Flow started with AI node",
              masterFlowId: masterFlow.id,
              masterFlowName: masterFlow.name,
              flowId: masterFlow.id,
              flowStarted: true,
              personaId: startNode.data?.persona_id || null,
              kbCategories: startNode.data?.kb_categories || null,
              contextPrompt: startNode.data?.context_prompt || null,
              fallbackMessage: startNode.data?.fallback_message || null,
              debug: {
                source: 'master_flow',
                startNodeType: startNode.type,
                hasAiNode: true
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Se primeiro nó é mensagem, retornar mensagem
        const startMessage = startNode.data?.message || "";
        const options = startNode.type === 'ask_options' 
          ? (startNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))
          : null;
        
        return new Response(
          JSON.stringify({
            useAI: false,
            response: startMessage,
            options,
            flowId: masterFlow.id,
            flowStarted: true,
            isMasterFlow: true,
            debug: {
              source: 'master_flow',
              startNodeType: startNode.type
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Nenhum master flow configurado - usar IA padrão
      return new Response(
        JSON.stringify({ useAI: true, reason: "No trigger matched and no Master Flow" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-chat-flow] Matched flow:', matchedFlow.id, matchedFlow.name);

    // 4. Iniciar novo fluxo
    const flowDef = matchedFlow.flow_definition as any;
    if (!flowDef?.nodes?.length) {
      return new Response(
        JSON.stringify({ useAI: true, reason: "Empty flow definition" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encontrar primeiro nó (sem edges apontando para ele)
    const targetIds = new Set((flowDef.edges || []).map((e: any) => e.target));
    const startNode = flowDef.nodes.find((n: any) => !targetIds.has(n.id)) || flowDef.nodes[0];

    // Criar estado do fluxo
    const { data: newState, error: createError } = await supabaseClient
      .from('chat_flow_states')
      .insert({
        conversation_id: conversationId,
        flow_id: matchedFlow.id,
        current_node_id: startNode.id,
        collected_data: {},
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      console.error('[process-chat-flow] Error creating state:', createError);
      return new Response(
        JSON.stringify({ useAI: true, reason: "Error creating flow state" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-chat-flow] Flow started:', newState.id);

    const startMessage = startNode.data?.message || "";
    const options = startNode.type === 'ask_options' 
      ? (startNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))
      : null;

    return new Response(
      JSON.stringify({
        useAI: false,
        response: startMessage,
        options,
        flowId: matchedFlow.id,
        flowStarted: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-chat-flow] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ useAI: true, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
