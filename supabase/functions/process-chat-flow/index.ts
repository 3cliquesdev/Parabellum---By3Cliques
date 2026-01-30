import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";

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
    const { conversationId, userMessage, flowId, manualTrigger, contractViolation, violationReason, activateTransfer } = body;
    
    if (!conversationId) {
      return new Response(
        JSON.stringify({ useAI: true, reason: "No conversationId provided" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================================
    // 🛑 KILL SWITCH: Se IA global desligada, retornar sem processar
    // Exceto se a conversa está em modo de teste individual
    // ============================================================
    const aiConfig = await getAIConfig(supabaseClient);
    
    // Verificar modo de teste individual
    const { data: convForTest } = await supabaseClient
      .from('conversations')
      .select('is_test_mode')
      .eq('id', conversationId)
      .maybeSingle();
    
    const isTestMode = convForTest?.is_test_mode === true;

    if (!aiConfig.ai_global_enabled && !isTestMode) {
      console.log('[process-chat-flow] 🛑 KILL SWITCH ATIVO - Retornando sem processar');
      return new Response(JSON.stringify({ 
        useAI: false,
        aiNodeActive: false,
        skipAutoResponse: true, // 🆕 Flag para indicar que não deve enviar nada
        reason: 'kill_switch_active',
        message: 'IA desligada globalmente - aguardando humano'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    if (isTestMode && !aiConfig.ai_global_enabled) {
      console.log('[process-chat-flow] 🧪 Kill Switch ativo, mas MODO TESTE permite processar');
    }

    // ============================================================
    // 🆕 HANDLER ANTI-ESCAPE: Ativar TransferNode quando IA viola contrato
    // A IA sinaliza contractViolation, o FLUXO decide a transferência
    // ============================================================
    if (contractViolation && activateTransfer) {
      console.log('[process-chat-flow] ⚠️ Contract violation received - activating TransferNode');
      console.log('[process-chat-flow] 📋 Violation reason:', violationReason);
      
      // Buscar dados da conversa para obter o channel
      const { data: conversation } = await supabaseClient
        .from('conversations')
        .select('channel')
        .eq('id', conversationId)
        .maybeSingle();
      
      const transferMessage = 'Vou transferir você para um atendente humano.';
      
      // ✅ Fluxo é SOBERANO: Ele decide a transferência
      // Atualizar conversa para waiting_human
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({ ai_mode: 'waiting_human' })
        .eq('id', conversationId);
      
      if (updateError) {
        console.error('[process-chat-flow] ❌ Error updating ai_mode:', updateError);
      } else {
        console.log('[process-chat-flow] ✅ ai_mode atualizado para waiting_human');
      }
      
      // Inserir mensagem de transferência
      await supabaseClient.from('messages').insert({
        conversation_id: conversationId,
        content: transferMessage,
        sender_type: 'user',
        is_ai_generated: true,
        channel: conversation?.channel || 'web_chat'
      });
      
      console.log('[process-chat-flow] ✅ TransferNode ativado pelo fluxo (soberano)');
      
      return new Response(JSON.stringify({
        useAI: false,
        aiNodeActive: false,
        transferActivated: true,
        reason: violationReason || 'contract_violation',
        message: 'TransferNode activated by flow (sovereign decision)'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

        // 🆕 CONTRATO ANTI-ALUCINAÇÃO: Retornar aiNodeActive = true
        // Isso autoriza o message-listener/useAutopilotTrigger a chamar a IA
        return new Response(
          JSON.stringify({
            useAI: true,
            aiNodeActive: true, // 🆕 Flag obrigatória para IA rodar
            nodeId: nextNode.id,
            flowId: activeState.flow_id,
            contextPrompt: nextNode.data?.context_prompt,
            useKnowledgeBase: nextNode.data?.use_knowledge_base !== false,
            collectedData,
            // Campos do contrato fluxo ↔ IA
            allowedSources: nextNode.data?.allowed_sources || ['kb', 'crm', 'tracking'],
            responseFormat: 'text_only',
            personaId: nextNode.data?.persona_id || null,
            personaName: nextNode.data?.persona_name || null,
            kbCategories: nextNode.data?.kb_categories || null,
            fallbackMessage: nextNode.data?.fallback_message || null,
            // 🆕 FASE 1: Campos de Controle de Comportamento Anti-Alucinação
            objective: nextNode.data?.objective || null,
            maxSentences: nextNode.data?.max_sentences ?? 3,
            forbidQuestions: nextNode.data?.forbid_questions ?? true,
            forbidOptions: nextNode.data?.forbid_options ?? true,
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

    // 🆕 CORREÇÃO: Filtrar apenas fluxos com triggers definidos (não Master Flows)
    // Master Flows são processados separadamente como fallback
    const flowsWithTriggers = flows.filter(flow => {
      const keywords = flow.trigger_keywords || [];
      const triggers = flow.triggers || [];
      const hasTriggers = keywords.length > 0 || triggers.length > 0;
      
      // Se é Master Flow e não tem triggers, NÃO incluir aqui (será usado como fallback)
      if (flow.is_master_flow && !hasTriggers) {
        console.log('[process-chat-flow] ⏭️ Skipping Master Flow without triggers:', flow.name);
        return false;
      }
      
      return hasTriggers;
    });

    console.log('[process-chat-flow] Flows with triggers:', flowsWithTriggers.length, 'of', flows.length);

    for (const flow of flowsWithTriggers) {
      const keywords = flow.trigger_keywords || [];
      const triggers = flow.triggers || [];
      const allTriggers = [...keywords, ...triggers];
      
      console.log('[process-chat-flow] 🔍 Checking flow:', flow.name, '- triggers:', allTriggers.length);

      for (const trigger of allTriggers) {
        const triggerNorm = normalizeText(trigger);
        
        console.log('[process-chat-flow] 📝 Comparing:', { 
          triggerNorm: triggerNorm.slice(0, 40), 
          triggerLen: triggerNorm.length,
          messageContainsTrigger: messageNorm.includes(triggerNorm)
        });
        
        // Match 0: MATCH EXATO - Se a mensagem é igual ou quase igual ao trigger
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
        
        // ============================================================
        // 🆕 TRAVESSIA AUTOMÁTICA: Atravessar nós sem conteúdo
        // Nós como 'input', 'start' e 'condition' não têm mensagem direta
        // Precisamos navegar até encontrar um nó com conteúdo
        // ============================================================
        const noContentTypes = ['input', 'start'];
        let contentNode = startNode;
        let traversalCount = 0;
        const MAX_TRAVERSAL = 10; // Evitar loop infinito
        let collectedData: Record<string, any> = {};

        // Buscar dados do contato para avaliar condições
        const { data: convData } = await supabaseClient
          .from('conversations')
          .select('contact_id')
          .eq('id', conversationId)
          .maybeSingle();

        let contactData: Record<string, any> | null = null;
        if (convData?.contact_id) {
          const { data: contact } = await supabaseClient
            .from('contacts')
            .select('*')
            .eq('id', convData.contact_id)
            .maybeSingle();
          contactData = contact;
        }

        // Função auxiliar para avaliar condição no contexto do fluxo
        function evaluateNodeCondition(conditionData: any): boolean {
          if (!conditionData) return true;
          
          const { condition_type, condition_field, condition_value } = conditionData;
          
          // Determinar de onde vem o valor
          let fieldValue: any = null;
          
          // Primeiro tentar dados coletados
          if (collectedData[condition_field]) {
            fieldValue = collectedData[condition_field];
          } 
          // Depois tentar dados do contato
          else if (contactData && condition_field in contactData) {
            fieldValue = contactData[condition_field];
          }
          // Checagem especial para campos comuns
          else if (condition_field === 'is_validated_customer' || condition_field === 'isValidatedCustomer') {
            fieldValue = contactData?.kiwify_validated ?? false;
          }
          else if (condition_field === 'email' && contactData?.email) {
            fieldValue = contactData.email;
          }
          else if (condition_field === 'document' && contactData?.document) {
            fieldValue = contactData.document;
          }
          
          console.log('[process-chat-flow] 🔍 Evaluating condition:', {
            condition_type,
            condition_field,
            condition_value,
            fieldValue: typeof fieldValue === 'string' ? fieldValue?.slice(0, 20) : fieldValue
          });
          
          switch (condition_type) {
            case 'has_data':
            case 'not_empty':
              return !!fieldValue && String(fieldValue).trim().length > 0;
            case 'is_empty':
            case 'no_data':
              return !fieldValue || String(fieldValue).trim().length === 0;
            case 'equals':
              return String(fieldValue).toLowerCase() === String(condition_value || '').toLowerCase();
            case 'not_equals':
              return String(fieldValue).toLowerCase() !== String(condition_value || '').toLowerCase();
            case 'is_true':
              return fieldValue === true || fieldValue === 'true';
            case 'is_false':
              return fieldValue === false || fieldValue === 'false' || !fieldValue;
            case 'contains':
              return String(fieldValue || '').toLowerCase().includes(String(condition_value || '').toLowerCase());
            default:
              console.log('[process-chat-flow] ⚠️ Unknown condition_type:', condition_type);
              return false;
          }
        }

        // Loop de travessia: atravessar nós sem conteúdo
        while ((noContentTypes.includes(contentNode.type) || contentNode.type === 'condition') && traversalCount < MAX_TRAVERSAL) {
          traversalCount++;
          console.log(`[process-chat-flow] ⏩ Traversing[${traversalCount}]: ${contentNode.type} (${contentNode.id})`);
          
          let path: string | undefined;
          
          // Se é um nó de condição, avaliar para determinar o caminho
          if (contentNode.type === 'condition') {
            const conditionResult = evaluateNodeCondition(contentNode.data);
            path = conditionResult ? 'true' : 'false';
            console.log(`[process-chat-flow] 🔀 Condition evaluated: ${path}`);
          }
          
          const nextNode = findNextNode(flowDef, contentNode, path);
          
          if (!nextNode) {
            console.log('[process-chat-flow] ⚠️ No next node found during traversal');
            break;
          }
          
          contentNode = nextNode;
        }

        console.log('[process-chat-flow] 📍 Content node reached:', contentNode.type, contentNode.id, `(after ${traversalCount} traversals)`);

        // Criar estado do fluxo apontando para o nó com conteúdo
        const { data: newState, error: createError } = await supabaseClient
          .from('chat_flow_states')
          .insert({
            conversation_id: conversationId,
            flow_id: masterFlow.id,
            current_node_id: contentNode.id, // 🆕 Salvar o nó com conteúdo, não o input
            collected_data: collectedData,
            status: 'active',
          })
          .select()
          .single();

        if (createError) {
          console.error('[process-chat-flow] Error creating master flow state:', createError);
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

        console.log('[process-chat-flow] ✅ Master Flow started:', newState.id, '- content node:', contentNode.type);

        // Processar o nó com conteúdo encontrado

        // Se é nó de transferência
        if (contentNode.type === 'transfer') {
          await supabaseClient
            .from('chat_flow_states')
            .update({ status: 'transferred' })
            .eq('id', newState.id);
          
          return new Response(
            JSON.stringify({
              useAI: false,
              response: replaceVariables(contentNode.data?.message || "Transferindo para um atendente...", collectedData),
              transfer: true,
              transferType: contentNode.data?.transfer_type,
              departmentId: contentNode.data?.department_id,
              flowId: masterFlow.id,
              flowStarted: true,
              isMasterFlow: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se é nó de AI, retornar useAI true com configs
        if (contentNode.type === 'ai_response') {
          return new Response(
            JSON.stringify({
              useAI: true,
              aiNodeActive: true,
              nodeId: contentNode.id,
              reason: "Master Flow started with AI node",
              masterFlowId: masterFlow.id,
              masterFlowName: masterFlow.name,
              flowId: masterFlow.id,
              flowStarted: true,
              allowedSources: contentNode.data?.allowed_sources || ['kb', 'crm', 'tracking'],
              responseFormat: 'text_only',
              personaId: contentNode.data?.persona_id || null,
              kbCategories: contentNode.data?.kb_categories || null,
              contextPrompt: contentNode.data?.context_prompt || null,
              fallbackMessage: contentNode.data?.fallback_message || null,
              objective: contentNode.data?.objective || null,
              maxSentences: contentNode.data?.max_sentences ?? 3,
              forbidQuestions: contentNode.data?.forbid_questions ?? true,
              forbidOptions: contentNode.data?.forbid_options ?? true,
              debug: {
                source: 'master_flow',
                startNodeType: startNode.type,
                contentNodeType: contentNode.type,
                traversalCount,
                hasAiNode: true
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se é nó de fim
        if (contentNode.type === 'end') {
          await supabaseClient
            .from('chat_flow_states')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', newState.id);
          
          const endMessage = contentNode.data?.message 
            ? replaceVariables(contentNode.data.message, collectedData)
            : "";
          
          return new Response(
            JSON.stringify({
              useAI: false,
              response: endMessage,
              flowCompleted: true,
              flowId: masterFlow.id,
              isMasterFlow: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Se é nó com mensagem (message, ask_options, ask_name, etc)
        const contentMessage = replaceVariables(contentNode.data?.message || "", collectedData);
        const options = contentNode.type === 'ask_options' 
          ? (contentNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value, id: opt.id }))
          : null;

        return new Response(
          JSON.stringify({
            useAI: false,
            response: contentMessage,
            options,
            flowId: masterFlow.id,
            flowStarted: true,
            isMasterFlow: true,
            debug: {
              source: 'master_flow',
              startNodeType: startNode.type,
              contentNodeType: contentNode.type,
              traversalCount
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 🆕 REGRA ANTI-ALUCINAÇÃO: Sem Master Flow = IA NÃO RODA
      // Antes: retornava useAI: true (IA rodava livre)
      // Agora: retorna aiNodeActive: false (IA bloqueada)
      console.log('[process-chat-flow] ⛔ No Master Flow - AI will NOT run (Anti-Hallucination)');
      return new Response(
        JSON.stringify({ 
          useAI: false, 
          aiNodeActive: false, 
          reason: "No trigger matched and no Master Flow configured",
          fallbackMessage: "No momento não tenho essa informação. Vou te encaminhar para um atendente humano."
        }),
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
    let startNode = flowDef.nodes.find((n: any) => !targetIds.has(n.id)) || flowDef.nodes[0];
    
    console.log('[process-chat-flow] 🚀 Start node:', startNode.type, startNode.id);

    // 🆕 CORREÇÃO: Se o nó inicial é "input" ou "condition", seguir para o próximo nó
    // Esses nós não têm conteúdo para enviar ao usuário
    let currentNode = startNode;
    let attempts = 0;
    const maxAttempts = 10; // Evitar loop infinito
    
    while (attempts < maxAttempts && (currentNode.type === 'input' || currentNode.type === 'condition')) {
      attempts++;
      console.log('[process-chat-flow] ⏩ Nó sem conteúdo (', currentNode.type, ') - avançando...');
      
      if (currentNode.type === 'condition') {
        // Para nós de condição, avaliar a condição
        const conditionField = currentNode.data?.condition_field || '';
        const conditionType = currentNode.data?.condition_type || 'contains';
        const conditionValue = currentNode.data?.condition_value || '';
        
        // Normalizar para comparação
        const msgNorm = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const valueNorm = conditionValue.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        let conditionResult = false;
        
        switch (conditionType) {
          case 'contains':
            conditionResult = msgNorm.includes(valueNorm);
            break;
          case 'equals':
            conditionResult = msgNorm === valueNorm;
            break;
          case 'starts_with':
            conditionResult = msgNorm.startsWith(valueNorm);
            break;
          case 'ends_with':
            conditionResult = msgNorm.endsWith(valueNorm);
            break;
          default:
            conditionResult = msgNorm.includes(valueNorm);
        }
        
        console.log('[process-chat-flow] 🔍 Condição avaliada:', { conditionType, conditionValue: valueNorm.slice(0, 30), result: conditionResult });
        
        // Seguir para true ou false path
        const path = conditionResult ? 'true' : 'false';
        currentNode = findNextNode(flowDef, currentNode, path);
      } else {
        // Para nó input, apenas seguir para o próximo
        currentNode = findNextNode(flowDef, currentNode, undefined);
      }
      
      if (!currentNode) {
        console.log('[process-chat-flow] ❌ Sem próximo nó após avançar');
        break;
      }
      
      console.log('[process-chat-flow] 📍 Novo nó:', currentNode.type, currentNode.id);
    }

    if (!currentNode) {
      console.log('[process-chat-flow] ❌ Não encontrou nó com conteúdo');
      return new Response(
        JSON.stringify({ useAI: true, reason: "Flow has no content nodes" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar startNode para o nó com conteúdo real
    startNode = currentNode;
    
    console.log('[process-chat-flow] ✅ Nó final com conteúdo:', startNode.type, startNode.id);

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
    
    // 🆕 CONTRATO ANTI-ALUCINAÇÃO: Se o nó é AI response, aiNodeActive = true
    if (startNode.type === 'ai_response') {
      return new Response(
        JSON.stringify({
          useAI: true,
          aiNodeActive: true, // 🆕 Flag obrigatória para IA rodar
          nodeId: startNode.id,
          reason: "Flow started with AI node",
          flowId: matchedFlow.id,
          flowStarted: true,
          // Campos do contrato fluxo ↔ IA
          allowedSources: startNode.data?.allowed_sources || ['kb', 'crm', 'tracking'],
          responseFormat: 'text_only',
          personaId: startNode.data?.persona_id || null,
          kbCategories: startNode.data?.kb_categories || null,
          contextPrompt: startNode.data?.context_prompt || null,
          fallbackMessage: startNode.data?.fallback_message || null,
          // 🆕 FASE 1: Campos de Controle de Comportamento Anti-Alucinação
          objective: startNode.data?.objective || null,
          maxSentences: startNode.data?.max_sentences ?? 3,
          forbidQuestions: startNode.data?.forbid_questions ?? true,
          forbidOptions: startNode.data?.forbid_options ?? true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        nodeType: startNode.type,
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
