// process-chat-flow v2.2 - fix cleanup ALL flows + quota handling
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getAIConfig } from "../_shared/ai-config-cache.ts";
import { getBusinessHoursInfo } from "../_shared/business-hours.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// 🆕 HELPER: Construir allowedSources a partir dos toggles individuais do nó
// Fontes: use_knowledge_base, use_crm_data, use_kiwify_data, use_tracking, use_sandbox_data
// ============================================================
function buildAllowedSources(nodeData: any): string[] {
  const sources: string[] = [];
  if (nodeData?.use_knowledge_base !== false) sources.push('kb');
  if (nodeData?.use_crm_data === true) sources.push('crm');
  if (nodeData?.use_kiwify_data === true) sources.push('kiwify');
  if (nodeData?.use_tracking === true) sources.push('tracking');
  if (nodeData?.use_sandbox_data === true) sources.push('sandbox');
  // Fallback: se nenhuma fonte selecionada, pelo menos KB
  if (sources.length === 0) sources.push('kb');
  return sources;
}

// ============================================================
// 🆕 MATCHER ESTRITO PARA ask_options (Contrato v2.3)
// ============================================================
interface AskOption {
  label: string;
  value?: string;
  id?: string;
}

function matchAskOption(
  userInput: string,
  options: AskOption[]
): AskOption | null {
  const normalized = userInput.trim().toLowerCase();

  // 1️⃣ Número (1, 2, 3…)
  const index = parseInt(normalized, 10);
  if (!isNaN(index) && index >= 1 && index <= options.length) {
    return options[index - 1];
  }

  // 2️⃣ Texto exato da opção (label ou value) - case-insensitive
  const exactMatch = options.find(opt =>
    opt.label.toLowerCase() === normalized ||
    (opt.value && opt.value.toLowerCase() === normalized)
  );
  
  return exactMatch || null;
}

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

// ============================================================
// 🎫 HELPER: Criar ticket com idempotência
// Key: conversation_id + flow_state_id + node_id
// ============================================================
async function createTicketFromFlow(
  supabaseClient: any,
  opts: {
    conversationId: string;
    flowStateId: string;
    nodeId: string;
    contactId: string | null;
    subject: string;
    description: string;
    category: string;
    priority: string;
    departmentId?: string | null;
    internalNote?: string | null;
    useCollectedData?: boolean;
    collectedData?: Record<string, any>;
  }
): Promise<{ id: string } | null> {
  const idempotencyKey = `flow:${opts.conversationId}:${opts.flowStateId}:${opts.nodeId}`;

  // Check idempotency — look for existing ticket with same key
  const { data: existing } = await supabaseClient
    .from('tickets')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing) {
    console.log(`[process-chat-flow] 🎫 Ticket already exists for key=${idempotencyKey}, skipping`);
    return existing;
  }

  // Build metadata
  const metadata: Record<string, any> = {
    flow_state_id: opts.flowStateId,
    node_id: opts.nodeId,
    idempotency_key: idempotencyKey,
  };
  if (opts.useCollectedData && opts.collectedData) {
    // Snapshot collected data (exclude internal keys)
    const snapshot: Record<string, any> = {};
    for (const [k, v] of Object.entries(opts.collectedData)) {
      if (!k.startsWith('__')) snapshot[k] = v;
    }
    metadata.collected_data = snapshot;
  }

  const insertPayload: Record<string, any> = {
    subject: opts.subject || 'Ticket do Fluxo',
    description: opts.description || '',
    category: opts.category || 'outro',
    priority: opts.priority || 'medium',
    status: 'open',
    source_conversation_id: opts.conversationId,
    customer_id: opts.contactId,
    idempotency_key: idempotencyKey,
    metadata,
  };
  if (opts.departmentId) insertPayload.department_id = opts.departmentId;
  if (opts.internalNote) insertPayload.internal_note = opts.internalNote;

  const { data: ticket, error } = await supabaseClient
    .from('tickets')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    console.error(`[process-chat-flow] ❌ Error creating ticket:`, error);
    // Non-blocking: don't break flow
    return null;
  }

  console.log(`[process-chat-flow] 🎫 Ticket created: ${ticket.id} key=${idempotencyKey}`);

  // Log ai_event
  try {
    await supabaseClient.from('ai_events').insert({
      entity_id: opts.conversationId,
      entity_type: 'conversation',
      event_type: 'flow_create_ticket',
      model: 'flow_engine',
      output_json: { ticket_id: ticket.id, category: opts.category, priority: opts.priority, node_id: opts.nodeId, department_id: opts.departmentId || null },
    });
  } catch (e) { /* non-blocking */ }

  return ticket;
}

// Encontrar próximo nó baseado no tipo
function findNextNode(flowDef: any, currentNode: any, path?: string): any {
  const edges = flowDef.edges || [];
  
  // Para nós de condição, usar o path (true/false ou rule ID / else)
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
    // Buscar TODAS as edges do mesmo sourceHandle (pode haver duplicatas)
    const matchingEdges = edges.filter((e: any) => 
      e.source === currentNode.id && e.sourceHandle === path
    );
    if (matchingEdges.length === 1) {
      return flowDef.nodes.find((n: any) => n.id === matchingEdges[0].target);
    }
    if (matchingEdges.length > 1) {
      // Priorizar nós de conteúdo sobre nós lógicos quando há edges duplicadas
      const contentTypes = ['message', 'transfer', 'ai_response', 'ask_options', 'ask_input', 'fetch_order', 'validate_customer', 'verify_customer_otp', 'create_ticket'];
      const targetNodes = matchingEdges.map((e: any) => flowDef.nodes.find((n: any) => n.id === e.target)).filter(Boolean);
      const contentNode = targetNodes.find((n: any) => contentTypes.includes(n.type));
      if (contentNode) {
        console.log(`[process-chat-flow] ⚠️ findNextNode: ${matchingEdges.length} duplicate edges from ${currentNode.id}/${path}, prioritizing content node ${contentNode.type}(${contentNode.id})`);
        return contentNode;
      }
      // Se nenhum é conteúdo, retornar o primeiro (condition, etc.)
      return targetNodes[0];
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

// ============================================================
// 🆕 HELPER: Enrich contact with is_customer (kiwify_validated alias)
// ============================================================
function enrichContactIsCustomer(contactData: any): void {
  if (!contactData || contactData.is_customer !== undefined) return;
  contactData.is_customer = contactData.kiwify_validated === true;
}

// ============================================================
// 🆕 HELPER: Construir contexto unificado de variáveis para templates
// Merge: collectedData (prioridade) + contact_* + conversation_*
// ============================================================
function buildVariablesContext(
  collectedData: Record<string, any>,
  contactData: any,
  conversationData: any
): Record<string, any> {
  const ctx: Record<string, any> = { ...collectedData };
  if (contactData) {
    for (const f of ['name','email','phone','cpf','city','state','tags','lead_score','kiwify_validated','source','company','document','consultant_id','is_customer']) {
      if (contactData[f] != null) ctx[`contact_${f}`] = contactData[f];
    }
    // Compose contact_name from first_name + last_name if not directly available
    if (!contactData.name && (contactData.first_name || contactData.last_name)) {
      ctx['contact_name'] = [contactData.first_name, contactData.last_name].filter(Boolean).join(' ');
    }
  }
  if (conversationData) {
    for (const f of ['channel','status','priority','protocol_number','queue','created_at','resolved_at']) {
      if (conversationData[f] != null) ctx[`conversation_${f}`] = conversationData[f];
    }
  }
  return ctx;
}

// ============================================================
// 🆕 HELPER: Resolver unificado de variáveis para conditions
// Fallback chain: collectedData → contactData → conversationData
// ============================================================
function getVar(
  field: string,
  collectedData: Record<string, any>,
  contactData: any,
  conversationData: any
): any {
  const f = field?.trim();
  if (!f) return null;
  // Aliases
  if (f === 'is_validated_customer' || f === 'isValidatedCustomer' || f === 'is_customer') {
    return contactData?.kiwify_validated ?? false;
  }
  return collectedData?.[f] ?? contactData?.[f] ?? conversationData?.[f] ?? null;
}

// Substituir variáveis no texto
function replaceVariables(text: string, variablesContext: Record<string, any>): string {
  let result = text;
  for (const [key, value] of Object.entries(variablesContext)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return result;
}

// Avaliar condição
function evaluateCondition(condition: any, collectedData: Record<string, any>, userMessage: string, extraFlags?: { inactivityTimeout?: boolean }, contactData?: any, conversationData?: any): boolean {
  const { condition_type, condition_field, condition_value } = condition;
  const fieldValue = condition_field ? (getVar(condition_field, collectedData, contactData, conversationData) ?? "") : userMessage;
  
  switch (condition_type) {
    case "inactivity":
      // Se chamado pelo cron com flag inactivityTimeout = true → inativo (true)
      // Se chamado por mensagem do cliente → não inativo (false)
      return extraFlags?.inactivityTimeout === true;
    case "contains": {
      const terms = (condition_value || "").split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      const msg = userMessage.toLowerCase();
      return terms.length > 0 && terms.some((term: string) => msg.includes(term));
    }
    case "equals": {
      const eqTerms = (condition_value || "").split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      const fv = fieldValue.toLowerCase().trim();
      return eqTerms.length > 0 && eqTerms.some((term: string) => fv === term);
    }
    case "has_data":
      return !!fieldValue && String(fieldValue).trim().length > 0;
    case "not_has_data":
      return !fieldValue || String(fieldValue).trim().length === 0;
    case "greater_than":
      return parseFloat(String(fieldValue)) > parseFloat(String(condition_value || "0"));
    case "less_than":
      return parseFloat(String(fieldValue)) < parseFloat(String(condition_value || "0"));
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

// 🆕 Avaliar condição com suporte a multi-regra (condition_rules)
// Retorna: para multi-regra, o ID da regra que bateu ou "else"
//          para modo clássico, "true" ou "false"
function evaluateConditionPath(nodeData: any, collectedData: Record<string, any>, userMessage: string, extraFlags?: { inactivityTimeout?: boolean }): string {
  const rules = nodeData.condition_rules;
  
  // Multi-regra: iterar cada regra e retornar a primeira que bater
  if (rules && Array.isArray(rules) && rules.length > 0) {
    const msg = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    console.log(`[process-chat-flow] 🔍 Evaluating ${rules.length} condition rules. User message (normalized): "${msg}"`);
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      // Usar keywords se preenchido, senao usar label como fallback
      const rawKw = (rule.keywords || "").trim() || (rule.label || "").trim();
      const terms = rawKw.includes("\n")
        ? rawKw.split("\n").map((t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).filter(Boolean)
        : [rawKw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')].filter(Boolean);
      console.log(`[process-chat-flow] 📋 Rule ${i + 1}/${rules.length}: "${rule.label}" (id: ${rule.id}) | keywords: [${terms.join(', ')}]`);
      if (terms.length > 0 && terms.some((term: string) => msg.includes(term))) {
        const matchedTerm = terms.find((term: string) => msg.includes(term));
        console.log(`[process-chat-flow] 🎯 MATCH on Rule ${i + 1}: "${rule.label}" — matched keyword: "${matchedTerm}"`);
        return rule.id;
      }
    }
    console.log('[process-chat-flow] 🔀 No multi-rule match → else');
    return "else";
  }
  
  // Modo clássico: true/false
  const result = evaluateCondition(nodeData, collectedData, userMessage, extraFlags, undefined, undefined);
  return result ? 'true' : 'false';
}
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
    const { conversationId, userMessage, flowId, manualTrigger, contractViolation, violationReason, activateTransfer, bypassActiveCheck, inactivityTimeout, forceFinancialExit, forceCommercialExit, forceAIExit } = body;
    
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
    // 🛡️ PROTEÇÃO: Respeitar ai_mode da conversa (Contrato v2.3)
    // Se cliente está na fila ou com humano, NÃO processar fluxo
    // ============================================================
    const { data: convState } = await supabaseClient
      .from('conversations')
      .select('ai_mode, assigned_to')
      .eq('id', conversationId)
      .maybeSingle();

    const currentAiMode = convState?.ai_mode;

    // waiting_human: Cliente na fila, aguardando humano
    // copilot: Humano atendendo com sugestões da IA
    // disabled: Atendimento 100% manual
    if ((currentAiMode === 'waiting_human' || currentAiMode === 'copilot' || currentAiMode === 'disabled') && !isTestMode) {
      // 🔓 SOBERANIA DO FLUXO: verificar se existe fluxo ativo antes de bloquear
      const { data: activeFlowCheck } = await supabaseClient
        .from('chat_flow_states')
        .select('id, status')
        .eq('conversation_id', conversationId)
        .in('status', ['waiting_input', 'active', 'in_progress'])
        .limit(1)
        .maybeSingle();

      if (activeFlowCheck) {
        console.log(`[process-chat-flow] 🔓 SOBERANIA DO FLUXO: ai_mode=${currentAiMode} mas fluxo ativo (${activeFlowCheck.status}) → processando`);
        // Restaurar ai_mode para autopilot (foi corrompido pelo handoff dentro do fluxo)
        await supabaseClient.from('conversations')
          .update({ ai_mode: 'autopilot' })
          .eq('id', conversationId);
      } else {
        console.log(`[process-chat-flow] 🛡️ PROTEÇÃO: ai_mode=${currentAiMode} - NÃO processar fluxo/IA`);
        console.log(`[process-chat-flow] 📋 assigned_to: ${convState?.assigned_to || 'null'}`);
        
        return new Response(JSON.stringify({
          useAI: false,
          aiNodeActive: false,
          skipAutoResponse: true,
          reason: `ai_mode_${currentAiMode}`,
          message: `Conversa em modo ${currentAiMode} - fluxo/IA bloqueados`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (isTestMode && (currentAiMode === 'waiting_human' || currentAiMode === 'copilot' || currentAiMode === 'disabled')) {
      console.log(`[process-chat-flow] 🧪 TEST MODE: Bypassing ai_mode=${currentAiMode} protection`);
    }

    // autopilot: IA ativa, processar normalmente
    console.log(`[process-chat-flow] ✅ ai_mode=${currentAiMode || 'autopilot'} - processando fluxo`);

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
        // ============================================================
        // 🧪 DRAFT-TEST: Permitir execução de rascunho com tripla validação
        // 1. bypassActiveCheck === true (enviado pelo frontend)
        // 2. is_test_mode === true (conversa em modo teste)
        // 3. Role privilegiado (admin/manager/etc.)
        // ============================================================
        if (!bypassActiveCheck) {
          return new Response(
            JSON.stringify({ error: "Fluxo está inativo", useAI: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        if (!isTestMode) {
          return new Response(
            JSON.stringify({ error: "Ative o Modo Teste no header desta conversa para rodar fluxos em rascunho." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }

        // Verificar role do usuário chamador
        const authHeader = req.headers.get('Authorization');
        let callerUserId: string | null = null;
        if (authHeader) {
          try {
            const token = authHeader.replace('Bearer ', '');
            const payload = JSON.parse(atob(token.split('.')[1]));
            callerUserId = payload.sub || null;
          } catch (e) {
            console.error('[process-chat-flow] Failed to parse JWT:', e);
          }
        }

        const PRIVILEGED_ROLES = ['admin', 'manager', 'general_manager', 'support_manager', 'cs_manager', 'financial_manager'];
        let hasPrivilegedRole = false;

        if (callerUserId) {
          const { data: roleData } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', callerUserId)
            .single();
          
          if (roleData && PRIVILEGED_ROLES.includes(roleData.role)) {
            hasPrivilegedRole = true;
          }
        }

        if (!hasPrivilegedRole) {
          return new Response(
            JSON.stringify({ error: "Apenas administradores e gestores podem testar fluxos em rascunho." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
          );
        }

        // ✅ Tripla validação OK — log + audit
        console.log(`[DRAFT-TEST] Flow draft executed in test mode | flow: ${flow.name} (${flowId}) | user: ${callerUserId} | conversation: ${conversationId}`);

        await supabaseClient.from('audit_logs').insert({
          user_id: callerUserId,
          action: 'draft_flow_test',
          table_name: 'chat_flows',
          record_id: flowId,
          new_data: {
            conversation_id: conversationId,
            flow_name: flow.name,
            is_draft: true,
          },
        });
      }

      // ✅ FIX: Removido UPDATE redundante — o DELETE abaixo (linha ~668) já limpa todos os estados

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

      // ============================================================
      // 🆕 TRAVESSIA AUTOMÁTICA: Atravessar nós sem conteúdo (start/input/condition)
      // até encontrar o primeiro nó executável (message/ask_options/ai_response/transfer)
      // Reutiliza a mesma lógica do Master Flow para consistência
      // ============================================================
      const NO_CONTENT_MANUAL = new Set(['input', 'start', 'condition']);
      const MAX_TRAVERSAL_MANUAL = 12;

      // Carregar dados de contato/conversa para avaliação de condições
      const { data: manualConversation } = await supabaseClient
        .from('conversations')
        .select('id, contact_id, channel, status, priority, protocol_number, queue, created_at, resolved_at')
        .eq('id', conversationId)
        .maybeSingle();

      let manualContactData: any = null;
      if (manualConversation?.contact_id) {
        const { data: contact } = await supabaseClient
          .from('contacts')
          .select('*')
          .eq('id', manualConversation.contact_id)
          .maybeSingle();
        manualContactData = contact;
        enrichContactIsCustomer(manualContactData);
      }

      const manualCollectedData: Record<string, any> = {};

      // Função para avaliar condição no contexto manual — usa getVar() centralizado
      function manualEvalCond(data: any): boolean {
        const { condition_type, condition_field, condition_value } = data || {};
        let fieldValue = condition_field
          ? getVar(condition_field, manualCollectedData, manualContactData, manualConversation)
          : '';

        console.log('[process-chat-flow] 🔍 Manual condition evaluation:', { condition_type, condition_field, condition_value, fieldValue });

        switch (condition_type) {
          case 'has_data':
          case 'not_empty':
            return !!fieldValue && String(fieldValue).trim().length > 0;
          case 'is_empty':
          case 'no_data':
            return !fieldValue || String(fieldValue).trim().length === 0;
          case 'equals':
            return String(fieldValue ?? '').toLowerCase() === String(condition_value ?? '').toLowerCase();
          case 'not_equals':
            return String(fieldValue ?? '').toLowerCase() !== String(condition_value ?? '').toLowerCase();
          case 'is_true':
            return fieldValue === true || fieldValue === 'true';
          case 'is_false':
            return fieldValue === false || fieldValue === 'false' || !fieldValue;
          case 'contains':
            return String(fieldValue ?? '').toLowerCase().includes(String(condition_value ?? '').toLowerCase());
          default:
            console.log('[process-chat-flow] ⚠️ Unknown condition_type:', condition_type);
            return false;
        }
      }

      // Loop de travessia
      let contentNode: any = startNode;
      let traversalSteps = 0;

      while (contentNode && NO_CONTENT_MANUAL.has(contentNode.type) && traversalSteps < MAX_TRAVERSAL_MANUAL) {
        traversalSteps++;
        console.log(`[process-chat-flow] ⏩ Manual Traversing[${traversalSteps}] ${contentNode.type} (${contentNode.id})`);

        if (contentNode.type === 'condition') {
          const hasMultiRules = contentNode.data?.condition_rules?.length > 0;
          let next: any = null;

          // ⏱ Inactivity condition: always stop during manual traversal (needs timeout)
          if (contentNode.data?.condition_type === 'inactivity') {
            console.log('[process-chat-flow] 🛑 Manual traversal: inactivity condition — stopping as waiting_input');
            break;
          }

        if (hasMultiRules) {
            // Multi-regra com keywords precisa de mensagem real do usuário
            if (!userMessage || userMessage.trim().length === 0) {
              console.log('[process-chat-flow] 🛑 Manual traversal: multi-rule condition without userMessage — stopping as waiting_input');
              break;
            }
            // Reutilizar a mesma lógica de avaliação do fluxo normal
            const condRules = contentNode.data?.condition_rules || [];
            const normalizedMsg = userMessage.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            let matchedRuleId: string | null = null;
            
            for (const rule of condRules) {
              const rawKw = (rule.keywords || "").toString().trim() || (rule.label || "").trim();
              const terms = rawKw.includes("\n")
                ? rawKw.split("\n").map((t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).filter(Boolean)
                : [rawKw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')].filter(Boolean);
              if (terms.length > 0 && terms.some((term: string) => normalizedMsg.includes(term))) {
                matchedRuleId = rule.id;
                const matchedTerm = terms.find((term: string) => normalizedMsg.includes(term));
                console.log(`[process-chat-flow] 🎯 Manual MATCH on Rule "${rule.label}" — keyword: "${matchedTerm}"`);
                break;
              }
            }
            
            if (matchedRuleId) {
              const next = findNextNode(flowDef, contentNode, matchedRuleId);
              if (next) {
                contentNode = next;
                continue;
              }
            }
            // No match — use "else" path (same as normal flow)
            console.log('[process-chat-flow] 🔀 Manual: No multi-rule match → else');
            const elseNext = findNextNode(flowDef, contentNode, 'else') || findNextNode(flowDef, contentNode, 'default') || findNextNode(flowDef, contentNode);
            if (elseNext) {
              contentNode = elseNext;
              continue;
            }
            console.log('[process-chat-flow] ⚠️ Manual traversal: no matching rule and no default path');
            break;
          } else {
            const result = manualEvalCond(contentNode.data);
            console.log(`[process-chat-flow] 🔀 Manual classic condition: ${result}`);
            const handles = result ? ['true', 'yes', '1'] : ['false', 'no', '2'];
            for (const h of handles) {
              next = findNextNode(flowDef, contentNode, h);
              if (next) break;
            }
          }

          if (!next) {
            console.log('[process-chat-flow] ⚠️ Manual traversal: no next node for condition');
            break;
          }
          contentNode = next;
        } else {
          const next = findNextNode(flowDef, contentNode);
          if (!next) {
            console.log('[process-chat-flow] ⚠️ Manual traversal: no next node');
            break;
          }
          contentNode = next;
        }
      }

      console.log(`[process-chat-flow] 📍 Manual content node: ${contentNode?.type} (${contentNode?.id}) steps=${traversalSteps}`);

      // Determinar status inicial baseado no tipo do nó
      // 🆕 condition (multi-regra) também fica como waiting_input quando parou sem mensagem
      const initialStatus = (contentNode.type.startsWith('ask_') || contentNode.type === 'condition' || contentNode.type === 'verify_customer_otp')
        ? 'waiting_input'
        : 'active';

      // ✅ FIX: Limpar TODOS os estados da conversa (incluindo cancelled antigos que podem colidir com unique_active_flow)
      const { error: deleteError } = await supabaseClient
        .from('chat_flow_states')
        .delete()
        .eq('conversation_id', conversationId)
        .in('status', ['active', 'waiting_input', 'in_progress', 'cancelled']);

      if (deleteError) {
        console.error('[process-chat-flow] Error cleaning up old states:', deleteError);
      } else {
        console.log('[process-chat-flow] 🧹 Cleaned up old flow states for manual trigger');
      }

      // Criar estado do fluxo no nó de conteúdo (não no start)
      // Add inactivity metadata if stopped at inactivity condition
      const collectedDataForState: Record<string, any> = { ...manualCollectedData, __manual_test: true };
      if (contentNode.type === 'condition' && contentNode.data?.condition_type === 'inactivity') {
        const timeoutMinutes = parseInt(contentNode.data?.condition_value || '5', 10);
        collectedDataForState.__inactivity = {
          timeout_minutes: timeoutMinutes,
          started_at: new Date().toISOString(),
          node_id: contentNode.id,
        };
      }

      const { data: newState, error: createError } = await supabaseClient
        .from('chat_flow_states')
        .insert({
          conversation_id: conversationId,
          flow_id: flow.id,
          current_node_id: contentNode.id,
          collected_data: collectedDataForState,
          status: initialStatus,
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

      console.log('[process-chat-flow] ✅ Manual flow started:', newState.id, 'at node:', contentNode.id);

      // 🧪 SEPARADOR VISUAL: Inserir mensagem de sistema para marcar início do teste
      if (isTestMode) {
        const draftLabel = !flow.is_active ? ' (Rascunho)' : '';
        await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: `🧪 ─── TESTE DE FLUXO INICIADO ───\nFluxo: "${flow.name}"${draftLabel}`,
          sender_type: 'system',
          is_ai_generated: false,
          channel: 'web_chat',
          status: 'sent'
        });
        console.log('[process-chat-flow] 🧪 System separator message inserted');
      }

      // === DELIVERY: Entregar mensagem ao cliente no manual trigger ===
      const { data: convForDelivery } = await supabaseClient
        .from('conversations')
        .select('channel, contact_id, whatsapp_meta_instance_id, whatsapp_instance_id, whatsapp_provider')
        .eq('id', conversationId)
        .maybeSingle();

      let deliveryPhone: string | null = null;
      let deliveryContactId: string | null = convForDelivery?.contact_id || null;
      if (convForDelivery?.contact_id) {
        const { data: contactData } = await supabaseClient
          .from('contacts')
          .select('phone, whatsapp_id')
          .eq('id', convForDelivery.contact_id)
          .maybeSingle();
        // Priorizar whatsapp_id numérico sobre phone
        const waId = contactData?.whatsapp_id;
        if (waId && !waId.includes('@lid')) {
          const cleaned = waId.replace(/[^0-9]/g, '');
          if (cleaned.length >= 10) deliveryPhone = cleaned;
        }
        if (!deliveryPhone) {
          deliveryPhone = contactData?.phone?.replace(/\D/g, '') || null;
        }
      }

      // Helper para formatar mensagem e entregar (DB + WhatsApp)
      async function deliverManualMessage(messageText: string | null, optionsList?: any[] | null) {
        if (!messageText && (!optionsList || optionsList.length === 0)) return;
        
        // Montar texto final (com opções numeradas se existirem)
        let finalText = messageText || '';
        if (optionsList && optionsList.length > 0) {
          const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
          const optionsText = optionsList.map((opt: any, i: number) => 
            `${emojis[i] || `${i+1}.`} ${opt.label}`
          ).join('\n');
          finalText = finalText ? `${finalText}\n\n${optionsText}` : optionsText;
        }
        
        if (!finalText.trim()) return;

        console.log('[process-chat-flow] 📤 Delivering manual trigger message:', { 
          channel: convForDelivery?.channel, 
          hasPhone: !!deliveryPhone,
          textLength: finalText.length 
        });

        // 1. Salvar na tabela messages
        const { error: insertError } = await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: finalText,
          sender_type: 'user',
          sender_id: null,
          is_ai_generated: true,
          channel: convForDelivery?.channel || 'web_chat',
          status: 'sent'
        });

        if (insertError) {
          console.error('[process-chat-flow] ❌ Error saving manual trigger message:', insertError);
        }

        // 2. Se WhatsApp, enviar via send-meta-whatsapp
        if (convForDelivery?.channel === 'whatsapp' && deliveryPhone) {
          if (convForDelivery?.whatsapp_meta_instance_id) {
            try {
              await supabaseClient.functions.invoke('send-meta-whatsapp', {
                body: {
                  instance_id: convForDelivery.whatsapp_meta_instance_id,
                  phone_number: deliveryPhone,
                  message: finalText,
                  conversation_id: conversationId,
                  skip_db_save: true,
                  is_bot_message: true
                }
              });
              console.log('[process-chat-flow] ✅ Manual message sent via Meta WhatsApp');
            } catch (waErr) {
              console.error('[process-chat-flow] ❌ Error sending via Meta WhatsApp:', waErr);
            }
          } else {
            console.warn('[process-chat-flow] ⚠️ No WhatsApp Meta instance for delivery');
          }
        }
      }

      // Montar resposta baseada no tipo do nó de conteúdo alcançado
      // 🆕 Condição multi-regra aguardando input — não enviar nada
      if (contentNode.type === 'condition') {
        console.log('[process-chat-flow] 🛑 Manual flow stopped at condition node — waiting for user message');
        return new Response(
          JSON.stringify({
            useAI: false,
            response: null,
            flowId: flow.id,
            flowStarted: true,
            manualTrigger: true,
            waitingConditionInput: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (contentNode.type === 'ai_response') {
        // ai_response: não entregar mensagem aqui, a IA vai processar
        return new Response(
          JSON.stringify({
            useAI: true,
            response: null,
            flowId: flow.id,
            flowStarted: true,
            manualTrigger: true,
            personaId: contentNode.data?.persona_id || null,
            kbCategories: contentNode.data?.kb_categories || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // verify_customer_otp: Inicializar estado OTP e pedir email
      if (contentNode.type === 'verify_customer_otp') {
        collectedDataForState.__otp_step = 'ask_email';
        collectedDataForState.__otp_attempts = 0;
        await supabaseClient.from('chat_flow_states').update({
          collected_data: collectedDataForState,
        }).eq('id', newState.id);

        const askEmailMsg = contentNode.data?.message_ask_email || "Para verificar sua identidade, me informe seu email cadastrado:";
        await deliverManualMessage(askEmailMsg);

        return new Response(JSON.stringify({
          useAI: false,
          response: askEmailMsg,
          flowId: flow.id,
          flowStarted: true,
          manualTrigger: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (contentNode.type === 'transfer') {
        // Entregar mensagem de transfer se houver
        await deliverManualMessage(contentNode.data?.message || null);
        return new Response(
          JSON.stringify({
            useAI: false,
            response: contentNode.data?.message || null,
            flowId: flow.id,
            flowStarted: true,
            manualTrigger: true,
            transfer: {
              departmentId: contentNode.data?.department_id || null,
              aiMode: contentNode.data?.ai_mode || 'waiting_human',
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const startMessage = contentNode.data?.message || null;
      const options = contentNode.type === 'ask_options' 
        ? (contentNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))
        : null;

      // 🆕 Entregar mensagem + opções ao cliente
      await deliverManualMessage(startMessage, options);

      // ✅ FIX: Auto-avanço em nós 'message' — nós message são display-only,
      // o estado deve avançar para o próximo nó que aceita input (ask_options, ask_input, ai_response)
      if (contentNode.type === 'message' && newState) {
        console.log('[process-chat-flow] ⏩ Auto-advancing from message node:', contentNode.id);
        let advanceNode = contentNode;
        let advanceSteps = 0;
        const MAX_ADVANCE = 12;

        while (advanceSteps < MAX_ADVANCE) {
          advanceSteps++;
          const nextNode = findNextNode(flowDef, advanceNode);
          if (!nextNode) {
            console.log('[process-chat-flow] ⚠️ Auto-advance: no next node after message');
            break;
          }

          if (nextNode.type === 'condition') {
            // Avaliar condição e seguir caminho
            const hasMultiRules = nextNode.data?.condition_rules?.length > 0;
            let condNext: any = null;
            if (hasMultiRules) {
              const path = evaluateConditionPath(nextNode.data, manualCollectedData, '');
              condNext = findNextNode(flowDef, nextNode, path);
            } else {
              const result = manualEvalCond(nextNode.data);
              const handles = result ? ['true', 'yes', '1'] : ['false', 'no', '2'];
              for (const h of handles) {
                condNext = findNextNode(flowDef, nextNode, h);
                if (condNext) break;
              }
            }
            if (!condNext) break;
            advanceNode = condNext;
            // Se alcançou um nó de conteúdo via condição, parar aqui
            if (!['condition', 'input', 'start'].includes(advanceNode.type)) break;
          } else if (nextNode.type === 'input' || nextNode.type === 'start') {
            advanceNode = nextNode;
          } else {
            // Reached a content node (ask_options, ask_input, ai_response, transfer, message)
            advanceNode = nextNode;
            break;
          }
        }

        if (advanceNode.id !== contentNode.id) {
          const advanceStatus = advanceNode.type.startsWith('ask_') || advanceNode.type === 'condition'
            ? 'waiting_input' : 'active';

          const { error: advErr } = await supabaseClient
            .from('chat_flow_states')
            .update({ current_node_id: advanceNode.id, status: advanceStatus })
            .eq('id', newState.id);

          if (advErr) {
            console.error('[process-chat-flow] ❌ Auto-advance update error:', advErr);
          } else {
            console.log(`[process-chat-flow] ✅ Auto-advanced to ${advanceNode.type} (${advanceNode.id}) status=${advanceStatus}`);
          }

          // Se avançou para ask_options, entregar as opções ao cliente
          if (advanceNode.type === 'ask_options') {
            const advMsg = advanceNode.data?.message || null;
            const advOpts = (advanceNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }));
            await deliverManualMessage(advMsg, advOpts);
          } else if (advanceNode.type === 'message') {
            await deliverManualMessage(advanceNode.data?.message || null);
          }
        }
      }

      return new Response(
        JSON.stringify({
          useAI: false,
          response: startMessage,
          options,
          flowId: flow.id,
          flowName: flow.name,
          flowStarted: true,
          manualTrigger: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verificar se existe estado ativo para esta conversa
    // 🆕 FIX: Usar order+limit ao invés de maybeSingle para evitar erro quando
    // há múltiplos estados ativos (race condition master flow + draft de teste).
    // O mais recente (draft) tem prioridade.
    const { data: activeStates, error: stateError } = await supabaseClient
      .from('chat_flow_states')
      .select('*, chat_flows(*)')
      .eq('conversation_id', conversationId)
      .in('status', ['active', 'waiting_input', 'in_progress'])
      .order('started_at', { ascending: false })
      .limit(1);

    const activeState = activeStates?.[0] || null;

    // 🆕 Se há múltiplos estados ativos, cancelar os antigos (cleanup)
    if (activeStates && activeStates.length > 1) {
      console.log(`[process-chat-flow] ⚠️ Found ${activeStates.length} active states, keeping most recent, cancelling others`);
      const idsToCancel = activeStates.slice(1).map((s: any) => s.id);
      await supabaseClient
        .from('chat_flow_states')
        .update({ status: 'cancelled' })
        .in('id', idsToCancel);
    }

    if (stateError) {
      console.error('[process-chat-flow] Error fetching state:', stateError);
      return new Response(
        JSON.stringify({ useAI: true, reason: "Error fetching flow state" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🧪 TEST MODE GUARD: Cancelar estados residuais de fluxos automáticos
    if (activeState && isTestMode && !manualTrigger) {
      const isManualTestState = (activeState.collected_data as any)?.__manual_test === true;
      if (!isManualTestState) {
        console.log('[process-chat-flow] 🧪 TEST MODE: Cancelando estado residual de fluxo automático:', activeState.flow_id);
        await supabaseClient
          .from('chat_flow_states')
          .update({ status: 'cancelled' })
          .eq('id', activeState.id);

        return new Response(JSON.stringify({
          useAI: false,
          skipAutoResponse: true,
          reason: 'test_mode_residual_cancelled',
          message: 'Modo teste ativo - estado residual cancelado',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // 2. Se tem estado ativo, processar resposta do usuário
    if (activeState) {
      console.log(`[process-chat-flow] 📌 Active flow found: flow=${activeState.flow_id} node=${activeState.current_node_id} status=${activeState.status}`);
      
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

      // 🆕 Carregar contactData e conversationData para resolver variáveis de contato/conversa
      let activeContactData: any = null;
      let activeConversationData: any = null;
      {
        const { data: convData } = await supabaseClient
          .from('conversations')
          .select('id, contact_id, channel, status, priority, protocol_number, queue, created_at, resolved_at')
          .eq('id', conversationId)
          .maybeSingle();
        activeConversationData = convData;
        if (convData?.contact_id) {
          const { data: ctData } = await supabaseClient
            .from('contacts')
            .select('*')
            .eq('id', convData.contact_id)
            .maybeSingle();
          activeContactData = ctData;
          enrichContactIsCustomer(activeContactData);
        }
      }
      // Helper para reconstruir variablesContext (chamado após cada mudança em collectedData)
      const rebuildCtx = () => buildVariablesContext(collectedData, activeContactData, activeConversationData);
      let variablesContext = rebuildCtx();

      console.log(`[process-chat-flow] 🔄 Processing node: type=${currentNode.type} id=${currentNode.id} msg="${(userMessage || '').slice(0, 60)}" collectedKeys=[${Object.keys(collectedData).filter(k => !k.startsWith('__')).join(',')}]`);

      // ============================================================
      // 🆕 HANDLER: verify_customer_otp (máquina de estados interna)
      // Sub-estados salvos em collectedData.__otp_step
      // ============================================================
      if (currentNode.type === 'verify_customer_otp') {
        const otpStep = collectedData.__otp_step || 'ask_email';
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const maxAttempts = currentNode.data?.max_attempts || 3;
        const verifiedKey = currentNode.data?.save_verified_as || 'customer_verified';

        console.log(`[process-chat-flow] 🔐 OTP step: ${otpStep} | msg: "${(userMessage || '').slice(0, 40)}"`);

        // --- SUB-ESTADO: ask_email → usuário digitou email ---
        if (otpStep === 'ask_email') {
          const emailInput = userMessage.trim().toLowerCase();
          // Validar formato de email
          const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput);
          if (!emailValid) {
            return new Response(JSON.stringify({
              useAI: false,
              response: "Por favor, informe um email válido (exemplo@email.com)",
              retry: true,
              flowId: activeState.flow_id,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          collectedData.__otp_email = emailInput;
          collectedData.__otp_step = 'check_email';

          // Verificar email na base
          try {
            const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-customer-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({ email: emailInput }),
            });
            const verifyData = await verifyRes.json();

            if (verifyData.found) {
              // Cliente encontrado → enviar OTP
              console.log('[process-chat-flow] 🔐 Customer found, sending OTP to:', emailInput);
              collectedData.__otp_customer_name = verifyData.customer?.name || '';
              collectedData.__otp_customer_id = verifyData.customer?.id || '';

              await fetch(`${supabaseUrl}/functions/v1/send-verification-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({ email: emailInput }),
              });

              collectedData.__otp_step = 'wait_code';
              collectedData.__otp_attempts = 0;

              await supabaseClient.from('chat_flow_states').update({
                collected_data: collectedData,
                status: 'waiting_input',
              }).eq('id', activeState.id);

              const otpMsg = (currentNode.data?.message_otp_sent || "Enviamos um código de 6 dígitos para {{email}}. Digite o código:")
                .replace(/\{\{email\}\}/g, emailInput);

              return new Response(JSON.stringify({
                useAI: false,
                response: otpMsg,
                retry: false,
                flowId: activeState.flow_id,
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
              // Email não encontrado
              console.log('[process-chat-flow] 🔐 Email not found:', emailInput);
              collectedData.__otp_step = 'confirm_email';

              await supabaseClient.from('chat_flow_states').update({
                collected_data: collectedData,
                status: 'waiting_input',
              }).eq('id', activeState.id);

              const notFoundMsg = currentNode.data?.message_not_found || "Não encontramos este email em nossa base. O email está correto?";

              return new Response(JSON.stringify({
                useAI: false,
                response: notFoundMsg,
                retry: false,
                flowId: activeState.flow_id,
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } catch (err) {
            console.error('[process-chat-flow] ❌ Error verifying email:', err);
            collectedData.__otp_step = 'confirm_email';
            await supabaseClient.from('chat_flow_states').update({
              collected_data: collectedData,
              status: 'waiting_input',
            }).eq('id', activeState.id);

            return new Response(JSON.stringify({
              useAI: false,
              response: "Ocorreu um erro ao verificar o email. Tente novamente.",
              retry: false,
              flowId: activeState.flow_id,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        // --- SUB-ESTADO: confirm_email → usuário confirmou ou corrigiu email ---
        if (otpStep === 'confirm_email') {
          const input = userMessage.trim().toLowerCase();
          // Se parece um email novo, tentar de novo
          const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
          if (looksLikeEmail) {
            collectedData.__otp_email = input;
            collectedData.__otp_step = 'ask_email';
            await supabaseClient.from('chat_flow_states').update({
              collected_data: collectedData,
              status: 'waiting_input',
            }).eq('id', activeState.id);
            // Reprocessar como ask_email (recursão via re-invocação pelo webhook)
            // Simular resposta pedindo para tentar novamente
            return new Response(JSON.stringify({
              useAI: false,
              response: "Ok, vou verificar esse email. Aguarde...",
              flowId: activeState.flow_id,
              reprocess: true,
              reprocessMessage: input,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Respostas negativas = não é cliente
          const negativePatterns = ['nao', 'não', 'no', 'n', 'nope', 'nunca', 'nao sou', 'não sou', 'nao tenho', 'não tenho'];
          const isNegative = negativePatterns.some(p => input.includes(p));

          if (isNegative) {
            // Não é cliente → setar resultado e avançar
            collectedData[verifiedKey] = false;
            collectedData.__otp_result = 'not_customer';
            collectedData.customer_verified_email = '';
            collectedData.customer_verified_name = '';

            const notCustomerMsg = currentNode.data?.message_not_customer || "Vou encaminhar para nosso time comercial.";

            // Avançar para próximo nó
            const nextAfterOtp = findNextNode(flowDef, currentNode);
            if (nextAfterOtp) {
              // Auto-traverse conditions
              let resolvedNode = nextAfterOtp;
              while (resolvedNode && ['condition', 'input', 'start'].includes(resolvedNode.type)) {
                if (resolvedNode.type === 'condition') {
                  const condPath = evaluateConditionPath(resolvedNode.data, collectedData, userMessage);
                  const afterCond = findNextNode(flowDef, resolvedNode, condPath);
                  if (!afterCond || !['condition', 'input', 'start'].includes(afterCond.type)) {
                    resolvedNode = afterCond;
                    break;
                  }
                  resolvedNode = afterCond;
                } else {
                  resolvedNode = findNextNode(flowDef, resolvedNode);
                }
              }

              if (resolvedNode) {
                const nextStatus = resolvedNode.type.startsWith('ask_') || resolvedNode.type === 'condition' || resolvedNode.type === 'verify_customer_otp'
                  ? 'waiting_input' : 'active';
                await supabaseClient.from('chat_flow_states').update({
                  collected_data: collectedData,
                  current_node_id: resolvedNode.id,
                  status: nextStatus,
                }).eq('id', activeState.id);

                if (resolvedNode.type === 'transfer') {
                  await supabaseClient.from('chat_flow_states').update({
                    status: 'transferred',
                    completed_at: new Date().toISOString(),
                  }).eq('id', activeState.id);

                  return new Response(JSON.stringify({
                    useAI: false,
                    response: notCustomerMsg,
                    transfer: true,
                    departmentId: resolvedNode.data?.department_id || null,
                    transferType: resolvedNode.data?.transfer_type,
                    collectedData,
                    flowId: activeState.flow_id,
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                variablesContext = rebuildCtx();
                const nextMsg = replaceVariables(resolvedNode.data?.message || '', variablesContext);
                return new Response(JSON.stringify({
                  useAI: resolvedNode.type === 'ai_response',
                  aiNodeActive: resolvedNode.type === 'ai_response',
                  response: [notCustomerMsg, nextMsg].filter(Boolean).join('\n\n'),
                  flowId: activeState.flow_id,
                  collectedData,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
            }

            // Fallback: sem próximo nó
            await supabaseClient.from('chat_flow_states').update({
              collected_data: collectedData,
              status: 'completed',
              completed_at: new Date().toISOString(),
            }).eq('id', activeState.id);

            return new Response(JSON.stringify({
              useAI: false,
              response: notCustomerMsg,
              flowCompleted: true,
              collectedData,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          // Resposta sim ou ambígua → pedir email novamente
          collectedData.__otp_step = 'ask_email';
          await supabaseClient.from('chat_flow_states').update({
            collected_data: collectedData,
            status: 'waiting_input',
          }).eq('id', activeState.id);

          const askAgainMsg = currentNode.data?.message_ask_email || "Para verificar sua identidade, me informe seu email cadastrado:";
          return new Response(JSON.stringify({
            useAI: false,
            response: "Ok, por favor informe novamente seu email:",
            flowId: activeState.flow_id,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- SUB-ESTADO: wait_code → usuário digitou código OTP ---
        if (otpStep === 'wait_code') {
          const codeInput = userMessage.trim();
          const email = collectedData.__otp_email;
          const attempts = (collectedData.__otp_attempts || 0) + 1;
          collectedData.__otp_attempts = attempts;

          try {
            const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-code`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
              body: JSON.stringify({ email, code: codeInput }),
            });
            const verifyData = await verifyRes.json();

            if (verifyData.success) {
              // ✅ Código correto!
              console.log('[process-chat-flow] 🔐 OTP verified successfully for:', email);
              collectedData[verifiedKey] = true;
              collectedData.__otp_result = 'verified';
              collectedData.customer_verified_email = email;
              collectedData.customer_verified_name = collectedData.__otp_customer_name || '';

              // Promover contato se necessário
              if (collectedData.__otp_customer_id && activeConversationData?.contact_id) {
                await supabaseClient.from('contacts').update({
                  kiwify_validated: true,
                }).eq('id', activeConversationData.contact_id);
              }

              // Avançar para próximo nó
              const nextAfterOtp = findNextNode(flowDef, currentNode);
              let resolvedNode = nextAfterOtp;
              while (resolvedNode && ['condition', 'input', 'start'].includes(resolvedNode.type)) {
                if (resolvedNode.type === 'condition') {
                  const condPath = evaluateConditionPath(resolvedNode.data, collectedData, userMessage);
                  const afterCond = findNextNode(flowDef, resolvedNode, condPath);
                  if (!afterCond || !['condition', 'input', 'start'].includes(afterCond.type)) {
                    resolvedNode = afterCond;
                    break;
                  }
                  resolvedNode = afterCond;
                } else {
                  resolvedNode = findNextNode(flowDef, resolvedNode);
                }
              }

              if (resolvedNode) {
                const nextStatus = resolvedNode.type.startsWith('ask_') || resolvedNode.type === 'condition' || resolvedNode.type === 'verify_customer_otp'
                  ? 'waiting_input' : 'active';
                await supabaseClient.from('chat_flow_states').update({
                  collected_data: collectedData,
                  current_node_id: resolvedNode.id,
                  status: nextStatus,
                }).eq('id', activeState.id);

                variablesContext = rebuildCtx();
                const nextMsg = replaceVariables(resolvedNode.data?.message || '', variablesContext);

                if (resolvedNode.type === 'transfer') {
                  await supabaseClient.from('chat_flow_states').update({
                    status: 'transferred',
                    completed_at: new Date().toISOString(),
                  }).eq('id', activeState.id);

                  return new Response(JSON.stringify({
                    useAI: false,
                    response: "✅ Identidade verificada!\n\n" + (nextMsg || "Transferindo..."),
                    transfer: true,
                    departmentId: resolvedNode.data?.department_id || null,
                    collectedData,
                    flowId: activeState.flow_id,
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                if (resolvedNode.type === 'ai_response') {
                  return new Response(JSON.stringify({
                    useAI: true,
                    aiNodeActive: true,
                    response: "✅ Identidade verificada!",
                    flowId: activeState.flow_id,
                    collectedData,
                    nodeId: resolvedNode.id,
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                return new Response(JSON.stringify({
                  useAI: false,
                  response: "✅ Identidade verificada!\n\n" + nextMsg,
                  flowId: activeState.flow_id,
                  collectedData,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }

              // Sem próximo nó
              await supabaseClient.from('chat_flow_states').update({
                collected_data: collectedData,
                status: 'completed',
                completed_at: new Date().toISOString(),
              }).eq('id', activeState.id);

              return new Response(JSON.stringify({
                useAI: false,
                response: "✅ Identidade verificada!",
                flowCompleted: true,
                collectedData,
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            } else {
              // ❌ Código incorreto
              if (attempts >= maxAttempts) {
                console.log('[process-chat-flow] 🔐 OTP max attempts reached');
                collectedData[verifiedKey] = false;
                collectedData.__otp_result = 'failed';

                // Avançar para próximo nó com resultado failed
                const nextAfterOtp = findNextNode(flowDef, currentNode);
                let resolvedNode = nextAfterOtp;
                while (resolvedNode && ['condition', 'input', 'start'].includes(resolvedNode.type)) {
                  if (resolvedNode.type === 'condition') {
                    const condPath = evaluateConditionPath(resolvedNode.data, collectedData, userMessage);
                    const afterCond = findNextNode(flowDef, resolvedNode, condPath);
                    if (!afterCond || !['condition', 'input', 'start'].includes(afterCond.type)) {
                      resolvedNode = afterCond;
                      break;
                    }
                    resolvedNode = afterCond;
                  } else {
                    resolvedNode = findNextNode(flowDef, resolvedNode);
                  }
                }

                if (resolvedNode) {
                  const nextStatus = resolvedNode.type.startsWith('ask_') || resolvedNode.type === 'condition' || resolvedNode.type === 'verify_customer_otp'
                    ? 'waiting_input' : 'active';
                  await supabaseClient.from('chat_flow_states').update({
                    collected_data: collectedData,
                    current_node_id: resolvedNode.id,
                    status: nextStatus,
                  }).eq('id', activeState.id);

                  variablesContext = rebuildCtx();
                  const nextMsg = replaceVariables(resolvedNode.data?.message || '', variablesContext);
                  return new Response(JSON.stringify({
                    useAI: resolvedNode.type === 'ai_response',
                    aiNodeActive: resolvedNode.type === 'ai_response',
                    response: "❌ Máximo de tentativas excedido.\n\n" + nextMsg,
                    flowId: activeState.flow_id,
                    collectedData,
                  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                await supabaseClient.from('chat_flow_states').update({
                  collected_data: collectedData,
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                }).eq('id', activeState.id);

                return new Response(JSON.stringify({
                  useAI: false,
                  response: "❌ Máximo de tentativas excedido. Vou transferir para um atendente.",
                  flowCompleted: true,
                  collectedData,
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }

              // Ainda tem tentativas
              await supabaseClient.from('chat_flow_states').update({
                collected_data: collectedData,
                status: 'waiting_input',
              }).eq('id', activeState.id);

              return new Response(JSON.stringify({
                useAI: false,
                response: `${verifyData.error || 'Código inválido.'} Tentativa ${attempts}/${maxAttempts}. Tente novamente:`,
                retry: true,
                flowId: activeState.flow_id,
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } catch (err) {
            console.error('[process-chat-flow] ❌ Error verifying OTP code:', err);
            await supabaseClient.from('chat_flow_states').update({
              collected_data: collectedData,
              status: 'waiting_input',
            }).eq('id', activeState.id);

            return new Response(JSON.stringify({
              useAI: false,
              response: "Ocorreu um erro ao verificar o código. Tente novamente:",
              retry: true,
              flowId: activeState.flow_id,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      }

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
          console.log(`[process-chat-flow] ❌ Validation failed: type=${validationType} node=${currentNode.id} error="${validation.error}" input="${(userMessage || '').slice(0, 40)}"`);
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
        console.log(`[process-chat-flow] 💾 Saving data: key="${currentNode.data.save_as}" value="${(userMessage || '').slice(0, 50)}" node=${currentNode.id}`);
        collectedData[currentNode.data.save_as] = userMessage;
        variablesContext = rebuildCtx(); // Rebuild after collecting new data
      }

      // Determinar próximo nó
      let nextNode: any = null;
      let path: string | undefined;

      if (currentNode.type === 'ask_options') {
        // ============================================================
        // 🆕 VALIDAÇÃO ESTRITA (Contrato v2.3)
        // - Só aceita número válido OU texto exato
        // - NÃO usa fuzzy matching
        // - Se inválido: NÃO avança, reenvia opções
        // ============================================================
        const options = currentNode.data?.options || [];
        const selectedOption = matchAskOption(userMessage, options);
        
        if (!selectedOption) {
          // ❌ ENTRADA INVÁLIDA → NÃO AVANÇA
          // 🆕 Log estruturado para auditoria (Plano v2.3)
          console.log('[process-chat-flow] invalidOption conv=' + conversationId + ' flow=' + activeState.flow_id + ' node=' + currentNode.id + ' msg="' + userMessage + '"');
          console.log('[process-chat-flow] ❌ Invalid option response:', userMessage, '| Options:', options.map((o: any) => o.label).join(', '));
          
          // Formatar opções para reenvio
          const formattedOptions = options.map((opt: any) => ({
            label: opt.label,
            value: opt.value,
            id: opt.id
          }));
          
          return new Response(
            JSON.stringify({
              useAI: false,
              response: "Desculpe, não entendi sua resposta. 🙂\n\nPara que eu possa te ajudar, por favor responda com o *número* (1, 2, 3...) ou o *nome* de uma das opções abaixo:",
              options: formattedOptions,
              retry: true,
              flowId: activeState.flow_id,
              flowName: activeState.chat_flows?.name || null,
              nodeId: currentNode.id,
              invalidOption: true,
              preventAI: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // ✅ Opção válida - avança normalmente
        console.log(`[process-chat-flow] ✅ ask_options: selected="${selectedOption.label}" (value=${selectedOption.value}) input="${userMessage}" node=${currentNode.id}`);
        path = selectedOption.id;
        collectedData[currentNode.data?.save_as || 'choice'] = selectedOption.value || selectedOption.label;
      } else if (currentNode.type === 'condition') {
        // Inactivity condition: client responded → false (not inactive)
        if (currentNode.data?.condition_type === 'inactivity' && !inactivityTimeout) {
          console.log(`[process-chat-flow] ⏱ condition: type=inactivity node=${currentNode.id} → client responded → path=false`);
          path = 'false';
        } else {
          path = evaluateConditionPath(currentNode.data, collectedData, userMessage, { inactivityTimeout });
          console.log(`[process-chat-flow] 🔀 condition: type=${currentNode.data?.condition_type} node=${currentNode.id} → path="${path}"`);
        }
      } else if (currentNode.type === 'ai_response') {
        // ============================================================
        // 🆕 MODO PERSISTENTE: IA responde múltiplas perguntas
        // O nó ai_response "segura" a conversa até condição de saída
        // ============================================================

        // 🆕 AUTO VALIDATE CUSTOMER: Triagem silenciosa antes de responder
        if (currentNode.data?.auto_validate_customer === true && activeContactData && !activeContactData.kiwify_validated) {
          const validateFields: string[] = currentNode.data?.validate_fields || ['phone', 'email', 'cpf'];
          console.log(`[process-chat-flow] 🔍 Auto-validando cliente. Campos: ${validateFields.join(', ')}`);

          const validationPromises: Promise<any>[] = [];

          if (validateFields.includes('phone') && (activeContactData.phone || activeContactData.whatsapp_id)) {
            validationPromises.push(
              supabaseClient.functions.invoke('validate-by-kiwify-phone', {
                body: { phone: activeContactData.phone, whatsapp_id: activeContactData.whatsapp_id, contact_id: activeContactData.id }
              }).then(r => ({ type: 'phone', ...r })).catch(e => ({ type: 'phone', error: e }))
            );
          }

          if (validateFields.includes('email') && activeContactData.email) {
            validationPromises.push(
              supabaseClient.functions.invoke('verify-customer-email', {
                body: { email: activeContactData.email, contact_id: activeContactData.id }
              }).then(r => ({ type: 'email', ...r })).catch(e => ({ type: 'email', error: e }))
            );
          }

          if (validateFields.includes('cpf') && activeContactData.document) {
            validationPromises.push(
              supabaseClient.functions.invoke('validate-by-cpf', {
                body: { cpf: activeContactData.document, contact_id: activeContactData.id }
              }).then(r => ({ type: 'cpf', ...r })).catch(e => ({ type: 'cpf', error: e }))
            );
          }

          if (validationPromises.length > 0) {
            try {
              const results = await Promise.allSettled(validationPromises);
              for (const r of results) {
                if (r.status === 'fulfilled' && r.value?.data?.found) {
                  console.log(`[process-chat-flow] ✅ Cliente validado via ${r.value.type}`);
                  activeContactData.kiwify_validated = true;
                  activeContactData.is_customer = true;
                  activeContactData.status = 'customer';
                  // Atualizar variablesContext após auto-validação
                  if (typeof rebuildCtx === 'function') {
                    variablesContext = rebuildCtx();
                  }
                  break;
                }
              }
            } catch (e) {
              console.warn('[process-chat-flow] ⚠️ Erro na auto-validação (não crítico):', e);
            }
          }
        }

        // ========= UPGRADE 1: Anti-duplicação (texto + janela 5s) =========
        collectedData.__ai = collectedData.__ai || { interaction_count: 0 };

        const now = Date.now();
        const msgLower = (userMessage || '').toLowerCase().trim();

        const lastMsg = String(collectedData.__ai.last_message || '').toLowerCase().trim();
        const lastTs = Number(collectedData.__ai.last_timestamp || 0);

        const isDuplicate =
          msgLower.length > 0 &&
          msgLower === lastMsg &&
          (now - lastTs) < 5000;

        if (!isDuplicate) {
          collectedData.__ai.interaction_count = Number(collectedData.__ai.interaction_count || 0) + 1;
          collectedData.__ai.last_message = userMessage || '';
          collectedData.__ai.last_timestamp = now;
        } else {
          console.log('[process-chat-flow] ⚠️ Duplicate AI message detected, skipping counter increment');
        }

        const aiCount = Number(collectedData.__ai.interaction_count || 0);
        // ==================================================================

        const exitKeywords: string[] = currentNode.data?.exit_keywords || [];
        const maxInteractions: number = currentNode.data?.max_ai_interactions ?? 0;
        const forbidFinancial: boolean = currentNode.data?.forbid_financial ?? false;
        const forbidCommercial: boolean = currentNode.data?.forbid_commercial ?? false;

        // 🔒 TRAVA FINANCEIRA: Detectar intenção financeira como exit do nó AI
        const financialIntentPattern = /saque|sacar|reembolso|estorno|(?<!\bendereco\s+de\s*)(?<!\bendere[çc]o\s+de\s*)(?<!\blocal\s+de\s*)devolu[çc][ãa]o|(?<!\bendereco\s+de\s*)(?<!\bendere[çc]o\s+de\s*)(?<!\blocal\s+de\s*)devolver|cancelar.*assinatura|meu dinheiro|(sacar|tirar|retirar|ver|consultar|meu)\s*saldo|(fazer|realizar|efetuar|cancelar|estornar)\s*pagamento|(cancelar|contestar|cobran[çc]a\s*indevida)|retirar|retirada|caixa|carteira|pix|transferir\s*saldo|tirar\s*dinheiro|tirar\s*meu|valor\s*(que|da|do|em)|ressarcimento/i;
        const financialIntentMatch = (forceFinancialExit && forbidFinancial) || (forbidFinancial && msgLower.length > 0 && financialIntentPattern.test(userMessage || ''));
        if (forceFinancialExit) {
          console.log('[process-chat-flow] 🔒 forceFinancialExit=true recebido do webhook, forçando exit do nó AI');
        }

        // 🛒 TRAVA COMERCIAL: Detectar intenção de compra como exit do nó AI
        const commercialIntentPattern = /comprar|quero comprar|quanto custa|pre[çc]o|proposta|or[çc]amento|cat[aá]logo|assinar|plano|tabela de pre[çc]o|conhecer.*produto|demonstra[çc][aã]o|demo|trial|teste gr[aá]tis|upgrade|downgrade|mudar.*plano/i;
        const commercialIntentMatch = (forceCommercialExit && forbidCommercial) || (forbidCommercial && msgLower.length > 0 && commercialIntentPattern.test(userMessage || ''));
        if (forceCommercialExit) {
          console.log('[process-chat-flow] 🛒 forceCommercialExit=true recebido do webhook, forçando exit do nó AI');
        }

        if (financialIntentMatch) {
          console.log(`[process-chat-flow] 🔒 TRAVA FINANCEIRA: Intenção financeira detectada no nó AI, tratando como exit`);
          
          try {
            await supabaseClient
              .from('ai_events')
              .insert({
                entity_type: 'conversation',
                entity_id: conversationId,
                event_type: 'ai_blocked_financial',
                model: 'process-chat-flow',
                output_json: {
                  phase: 'flow_node_exit',
                  node_id: currentNode.id,
                  flow_id: activeState.flow_id,
                  interaction_count: aiCount,
                  message_preview: (userMessage || '').substring(0, 200),
                },
                input_summary: (userMessage || '').substring(0, 200),
              });
          } catch (logErr) {
            console.error('[process-chat-flow] ⚠️ Failed to log financial block event:', logErr);
          }

          delete collectedData.__ai;
        }

        if (commercialIntentMatch) {
          console.log(`[process-chat-flow] 🛒 TRAVA COMERCIAL: Intenção comercial detectada no nó AI, tratando como exit`);
          
          try {
            await supabaseClient
              .from('ai_events')
              .insert({
                entity_type: 'conversation',
                entity_id: conversationId,
                event_type: 'ai_blocked_commercial',
                model: 'process-chat-flow',
                output_json: {
                  phase: 'flow_node_exit',
                  node_id: currentNode.id,
                  flow_id: activeState.flow_id,
                  interaction_count: aiCount,
                  message_preview: (userMessage || '').substring(0, 200),
                },
                input_summary: (userMessage || '').substring(0, 200),
              });
          } catch (logErr) {
            console.error('[process-chat-flow] ⚠️ Failed to log commercial block event:', logErr);
          }

          delete collectedData.__ai;
        }

        // Verificar exit keyword (case-insensitive includes)
        const keywordMatch = !financialIntentMatch && !commercialIntentMatch && exitKeywords.length > 0 && exitKeywords.some((kw: string) =>
          msgLower.includes(String(kw || '').toLowerCase().trim())
        );

        // Verificar max interações
        const maxReached = !financialIntentMatch && !commercialIntentMatch && maxInteractions > 0 && aiCount >= maxInteractions;

        // 🆕 forceAIExit: IA detectou handoff (strict RAG ou confidence) e quer sair do nó
        if (forceAIExit) {
          console.log('[process-chat-flow] 🔄 forceAIExit=true recebido do webhook, forçando exit do nó AI (IA não conseguiu resolver)');
        }
        const aiExitForced = !!forceAIExit;

        if (financialIntentMatch || commercialIntentMatch || keywordMatch || maxReached || aiExitForced) {
          const exitReason = financialIntentMatch ? 'financial_blocked' : commercialIntentMatch ? 'commercial_blocked' : aiExitForced ? 'ai_handoff_exit' : keywordMatch ? 'exit_keyword' : 'max_interactions';
          console.log(`[process-chat-flow] 🔄 AI persistent EXIT: reason=${exitReason} keyword=${keywordMatch} maxReached=${maxReached} financial=${financialIntentMatch} commercial=${commercialIntentMatch} count=${aiCount}`);

          // Log de transferência estruturado em ai_events
          try {
            await supabaseClient
              .from('ai_events')
              .insert({
                entity_type: 'conversation',
                entity_id: conversationId,
                event_type: 'ai_transfer',
                model: 'process-chat-flow',
                output_json: {
                  exit_reason: exitReason,
                  interaction_count: aiCount,
                  max_interactions: maxInteractions,
                  exit_keywords_configured: exitKeywords,
                  keyword_matched: keywordMatch ? msgLower : null,
                  flow_id: activeState.flow_id,
                  node_id: currentNode.id,
                },
                input_summary: (userMessage || '').substring(0, 200),
                department_id: null,
              });
            console.log(`[process-chat-flow] 📊 Transfer reason logged: ${exitReason}`);
          } catch (logErr) {
            console.error('[process-chat-flow] ⚠️ Failed to log transfer reason:', logErr);
          }

          // ✅ UPGRADE: max_interactions ou aiExitForced deve AVANÇAR para próximo nó
          if ((maxReached || aiExitForced) && !keywordMatch) {
            const fallbackMsg = currentNode.data?.fallback_message;
            if (fallbackMsg && String(fallbackMsg).trim().length > 0) {
              try {
                await supabaseClient.from('messages').insert({
                  conversation_id: conversationId,
                  content: String(fallbackMsg),
                  sender_type: 'system',
                  is_ai_generated: true,
                  is_internal: false,
                  status: 'sent',
                  channel: 'web_chat',
                });
                console.log('[process-chat-flow] ✅ fallback_message inserted on AI exit (will advance)');
              } catch (sendErr) {
                console.error('[process-chat-flow] ⚠️ Failed to insert fallback_message:', sendErr);
              }
            }
            console.log(`[process-chat-flow] 🔄 AI exit: reason=${aiExitForced ? 'ai_handoff_exit' : 'max_interactions'} (${aiCount}/${maxInteractions}) - advancing to next node`);
          }

          // Em ambos os casos (keyword ou max), limpa __ai e deixa o fluxo seguir
          delete collectedData.__ai;
          // Cai no findNextNode normal abaixo
        } else {
          // FICAR: atualizar state e retornar aiNodeActive
          // 🆕 DIAGNOSTIC: Log quando forbid_financial=true mas não detectou intent (ajuda diagnóstico)
          if (forbidFinancial && msgLower.length > 0) {
            console.log(`[process-chat-flow] ⚠️ DIAGNOSTIC: forbid_financial=true mas financialIntentMatch=false. userMessage="${(userMessage || '').substring(0, 100)}" msgLower="${msgLower.substring(0, 100)}" regexTest=${financialIntentPattern.test(userMessage || '')}`);
          }
          if (forbidCommercial && msgLower.length > 0) {
            console.log(`[process-chat-flow] ⚠️ DIAGNOSTIC: forbid_commercial=true mas commercialIntentMatch=false. userMessage="${(userMessage || '').substring(0, 100)}"`);
          }
          console.log(`[process-chat-flow] 🔄 AI persistent STAY: interaction #${aiCount} (max=${maxInteractions}, keywords=${exitKeywords.length})`);

          await supabaseClient
            .from('chat_flow_states')
            .update({
              collected_data: collectedData,
              current_node_id: currentNode.id,
            })
            .eq('id', activeState.id);

          return new Response(
            JSON.stringify({
              useAI: true,
              aiNodeActive: true,
              stayOnNode: true,
              nodeId: currentNode.id,
              flowId: activeState.flow_id,
              contextPrompt: currentNode.data?.context_prompt,
              useKnowledgeBase: currentNode.data?.use_knowledge_base !== false,
              collectedData,
              allowedSources: buildAllowedSources(currentNode.data),
              responseFormat: 'text_only',
              personaId: currentNode.data?.persona_id || null,
              personaName: currentNode.data?.persona_name || null,
              kbCategories: currentNode.data?.kb_categories || null,
              fallbackMessage: currentNode.data?.fallback_message || null,
              objective: currentNode.data?.objective || null,
              maxSentences: currentNode.data?.max_sentences ?? 3,
              forbidQuestions: currentNode.data?.forbid_questions ?? true,
              forbidOptions: currentNode.data?.forbid_options ?? true,
              forbidFinancial: currentNode.data?.forbid_financial ?? false,
              forbidCommercial: currentNode.data?.forbid_commercial ?? false,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      nextNode = findNextNode(flowDef, currentNode, path);
      console.log(`[process-chat-flow] ➡️ Transition: from=${currentNode.type}(${currentNode.id}) path=${path || 'default'} → next=${nextNode?.type || 'null'}(${nextNode?.id || 'none'})`);

      // 🔒 FIX: Financial/Commercial exit SEM próximo nó → forçar handoff
      if (!nextNode && (financialIntentMatch || commercialIntentMatch)) {
        const exitType = financialIntentMatch ? 'financial' : 'commercial';
        console.log(`[process-chat-flow] 🔒 ${exitType} exit com nextNode=null → forçando handoff`);
        
        // Buscar departamento financeiro/comercial dinamicamente
        let targetDeptId: string | null = null;
        const deptSearchName = financialIntentMatch ? '%financ%' : '%comerci%';
        try {
          const { data: deptRow } = await supabaseClient
            .from('departments')
            .select('id')
            .ilike('name', deptSearchName)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          targetDeptId = deptRow?.id || null;
          console.log(`[process-chat-flow] 🏢 Departamento ${exitType} encontrado:`, targetDeptId || 'nenhum (handoff genérico)');
        } catch (deptErr) {
          console.error(`[process-chat-flow] ⚠️ Erro buscando departamento ${exitType}:`, deptErr);
        }

        const handoffMsg = financialIntentMatch
          ? 'Entendi. Para assuntos financeiros, vou te encaminhar para um atendente humano agora.'
          : 'Ótimo! Vou te conectar com nosso time comercial para te ajudar com isso.';

        // Completar flow state como transferred
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            current_node_id: currentNode.id,
            status: 'transferred',
            completed_at: new Date().toISOString(),
          })
          .eq('id', activeState.id);

        // Atualizar conversa para waiting_human
        const convUpdate: any = { ai_mode: 'waiting_human', assigned_to: null };
        if (targetDeptId) convUpdate.department = targetDeptId;
        await supabaseClient
          .from('conversations')
          .update(convUpdate)
          .eq('id', conversationId);
        
        console.log(`[process-chat-flow] ✅ Handoff ${exitType} aplicado (sem próximo nó): dept=${targetDeptId || 'genérico'}`);

        return new Response(
          JSON.stringify({
            useAI: false,
            response: handoffMsg,
            transfer: true,
            departmentId: targetDeptId,
            collectedData,
            exitReason: `${exitType}_blocked_no_next_node`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 🆕 Auto-travessia de nós sem conteúdo (condition, input, start)
      let traversalSteps = 0;
      const MAX_TRAVERSAL = 20;

      while (nextNode && ['condition', 'input', 'start'].includes(nextNode.type) && traversalSteps < MAX_TRAVERSAL) {
        traversalSteps++;
        console.log(`[process-chat-flow] ⏩ Auto-traverse[${traversalSteps}] ${nextNode.type} (${nextNode.id})`);
        
        if (nextNode.type === 'condition') {
          // ⏱ Inactivity condition: stop and wait (save metadata)
          if (nextNode.data?.condition_type === 'inactivity' && !inactivityTimeout) {
            // 🔧 FIX: Se o usuário ACABOU de enviar mensagem, ele está ATIVO
            // Seguir caminho "Não" (ativo) imediatamente em vez de parar e esperar
            if (userMessage && userMessage.trim().length > 0) {
              console.log(`[process-chat-flow] ⏱ Inactivity condition reached but user just sent a message — treating as ACTIVE (path false)`);
              nextNode = findNextNode(flowDef, nextNode, 'false');
              continue; // continua o while de auto-traverse
            }

            console.log(`[process-chat-flow] ⏱ Inactivity condition reached during traversal — saving waiting_input with timeout metadata`);
            const timeoutMinutes = parseInt(nextNode.data?.condition_value || '5', 10);
            const inactivityMeta = {
              ...collectedData,
              __inactivity: {
                timeout_minutes: timeoutMinutes,
                started_at: new Date().toISOString(),
                node_id: nextNode.id,
              }
            };
            await supabaseClient
              .from('chat_flow_states')
              .update({
                current_node_id: nextNode.id,
                collected_data: inactivityMeta,
                status: 'waiting_input',
              })
              .eq('id', activeState.id);

            return new Response(
              JSON.stringify({
                useAI: false,
                response: null,
                flowId: activeState.flow_id,
                waitingInactivity: true,
                timeoutMinutes,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const condPath = evaluateConditionPath(nextNode.data, collectedData, userMessage, { inactivityTimeout });
          console.log(`[process-chat-flow] 🔀 Condition ${nextNode.id}: → path ${condPath}`);
          nextNode = findNextNode(flowDef, nextNode, condPath);
        } else {
          nextNode = findNextNode(flowDef, nextNode);
        }
      }

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

        // Avançar para o próximo nó após fetch_order (automático) — loop completo
        let afterFetchNode = findNextNode(flowDef, nextNode);
        
        // Loop de auto-traverse: atravessar condition, input, start até conteúdo
        while (afterFetchNode && ['condition', 'input', 'start'].includes(afterFetchNode.type)) {
          if (afterFetchNode.type === 'condition') {
            const condPath = evaluateConditionPath(afterFetchNode.data, collectedData, userMessage);
            const resolved = findNextNode(flowDef, afterFetchNode, condPath);
            if (!resolved || !['condition', 'input', 'start'].includes(resolved.type)) {
              afterFetchNode = resolved;
              break;
            }
            afterFetchNode = resolved;
          } else {
            // input/start: atravessar
            afterFetchNode = findNextNode(flowDef, afterFetchNode);
          }
        }
        
        if (afterFetchNode) {
          nextNode = afterFetchNode;
          const fetchStatus = nextNode.type.startsWith('ask_') || nextNode.type === 'condition'
            ? 'waiting_input' : 'active';
          await supabaseClient
            .from('chat_flow_states')
            .update({
              collected_data: collectedData,
              current_node_id: nextNode.id,
              status: fetchStatus,
            })
            .eq('id', activeState.id);
        }
      }

      // 🆕 Handler especial para validate_customer
      if (nextNode?.type === 'validate_customer') {
        console.log('[process-chat-flow] 🛡️ Processing validate_customer node');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        // Buscar dados do contato da conversa
        const { data: vcConv } = await supabaseClient
          .from('conversations')
          .select('contact_id')
          .eq('id', conversationId)
          .maybeSingle();
        
        let vcContact: any = null;
        if (vcConv?.contact_id) {
          const { data: c } = await supabaseClient
            .from('contacts')
            .select('phone, email, document, whatsapp_id, first_name, last_name, kiwify_validated')
            .eq('id', vcConv.contact_id)
            .maybeSingle();
          vcContact = c;
        }

        const validatedKey = nextNode.data?.save_validated_as || 'customer_validated';
        const nameKey = nextNode.data?.save_customer_name_as || 'customer_name_found';
        const emailKey = nextNode.data?.save_customer_email_as || 'customer_email_found';

        let found = false;
        let customerName = '';
        let customerEmail = '';

        if (vcContact && !vcContact.kiwify_validated) {
          const validationPromises: Promise<any>[] = [];
          
          // Phone validation
          if (nextNode.data?.validate_phone !== false && (vcContact.phone || vcContact.whatsapp_id)) {
            validationPromises.push(
              fetch(`${supabaseUrl}/functions/v1/validate-by-kiwify-phone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({ phone: vcContact.phone, whatsapp_id: vcContact.whatsapp_id, contact_id: vcConv?.contact_id })
              }).then(r => r.json()).catch(() => ({ found: false }))
            );
          }
          
          // Email validation
          if (nextNode.data?.validate_email !== false && vcContact.email) {
            validationPromises.push(
              fetch(`${supabaseUrl}/functions/v1/verify-customer-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({ email: vcContact.email, contact_id: vcConv?.contact_id })
              }).then(r => r.json()).catch(() => ({ found: false }))
            );
          }
          
          // CPF validation
          if (nextNode.data?.validate_cpf === true && vcContact.document) {
            validationPromises.push(
              fetch(`${supabaseUrl}/functions/v1/validate-by-cpf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                body: JSON.stringify({ cpf: vcContact.document, contact_id: vcConv?.contact_id })
              }).then(r => r.json()).catch(() => ({ found: false }))
            );
          }

          if (validationPromises.length > 0) {
            const results = await Promise.allSettled(validationPromises);
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value?.found) {
                found = true;
                if (r.value.customer?.name) customerName = r.value.customer.name;
                if (r.value.customer?.email) customerEmail = r.value.customer.email;
              }
            }
          }

          if (found && vcConv?.contact_id) {
            await supabaseClient
              .from('contacts')
              .update({ kiwify_validated: true, status: 'customer' })
              .eq('id', vcConv.contact_id);
            console.log('[process-chat-flow] ✅ Contact promoted to customer via validate_customer node');
          }
        } else if (vcContact?.kiwify_validated) {
          found = true;
          customerName = [vcContact.first_name, vcContact.last_name].filter(Boolean).join(' ');
          customerEmail = vcContact.email || '';
        }

        collectedData[validatedKey] = found;
        collectedData[nameKey] = customerName;
        collectedData[emailKey] = customerEmail;

        console.log('[process-chat-flow] 🛡️ Validate customer result:', { found, customerName, customerEmail });

        // Update state
        await supabaseClient
          .from('chat_flow_states')
          .update({ collected_data: collectedData, current_node_id: nextNode.id })
          .eq('id', activeState.id);

        // Auto-traverse to next node
        let afterValidateNode = findNextNode(flowDef, nextNode);
        while (afterValidateNode && ['condition', 'input', 'start'].includes(afterValidateNode.type)) {
          if (afterValidateNode.type === 'condition') {
            const condPath = evaluateConditionPath(afterValidateNode.data, collectedData, userMessage);
            const resolved = findNextNode(flowDef, afterValidateNode, condPath);
            if (!resolved || !['condition', 'input', 'start'].includes(resolved.type)) {
              afterValidateNode = resolved;
              break;
            }
            afterValidateNode = resolved;
          } else {
            afterValidateNode = findNextNode(flowDef, afterValidateNode);
          }
        }

        if (afterValidateNode) {
          nextNode = afterValidateNode;
          const vcStatus = nextNode.type.startsWith('ask_') || nextNode.type === 'condition'
            ? 'waiting_input' : 'active';
          await supabaseClient
            .from('chat_flow_states')
            .update({ collected_data: collectedData, current_node_id: nextNode.id, status: vcStatus })
            .eq('id', activeState.id);
        }
      }

      // 🆕 Handler especial para verify_customer_otp (entrada inicial)
      if (nextNode?.type === 'verify_customer_otp') {
        console.log('[process-chat-flow] 🔐 Entering verify_customer_otp node');
        
        collectedData.__otp_step = 'ask_email';
        collectedData.__otp_attempts = 0;

        await supabaseClient.from('chat_flow_states').update({
          collected_data: collectedData,
          current_node_id: nextNode.id,
          status: 'waiting_input',
        }).eq('id', activeState.id);

        const askEmailMsg = nextNode.data?.message_ask_email || "Para verificar sua identidade, me informe seu email cadastrado:";

        return new Response(JSON.stringify({
          useAI: false,
          response: askEmailMsg,
          flowId: activeState.flow_id,
          flowName: activeState.chat_flows?.name || null,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (!nextNode || nextNode.type === 'end') {
        console.log(`[process-chat-flow] 🏁 Flow completed: flow=${activeState.flow_id} node=${nextNode?.id || 'none'} collectedKeys=[${Object.keys(collectedData).filter(k => !k.startsWith('__')).join(',')}]`);
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
          ? replaceVariables(nextNode.data.message, variablesContext)
          : "Obrigado! Suas informações foram registradas.";

        // Executar ação final se configurada
        if (nextNode?.data?.end_action === 'create_lead') {
          console.log('[process-chat-flow] Creating lead from collected data');
          // TODO: Implementar criação de lead
        }

        // 🎫 EndNode action: create_ticket
        if (nextNode?.data?.end_action === 'create_ticket') {
          const actionData = nextNode.data.action_data || {};
          const subject = replaceVariables(actionData.subject || nextNode.data.subject_template || 'Ticket do Fluxo', variablesContext);
          const description = replaceVariables(actionData.description || nextNode.data.description_template || '', variablesContext);
          const internalNote = (actionData.internal_note || nextNode.data.internal_note)
            ? replaceVariables(actionData.internal_note || nextNode.data.internal_note, variablesContext)
            : null;
          const ticket = await createTicketFromFlow(supabaseClient, {
            conversationId: conversationId,
            flowStateId: activeState.id,
            nodeId: nextNode.id,
            contactId: activeState.conversations?.contact_id || null,
            subject,
            description,
            category: actionData.ticket_category || nextNode.data.ticket_category || 'outro',
            priority: actionData.ticket_priority || nextNode.data.ticket_priority || 'medium',
            departmentId: actionData.department_id || nextNode.data.department_id || null,
            internalNote,
            useCollectedData: actionData.use_collected_data || nextNode.data.use_collected_data || false,
            collectedData,
          });
          if (ticket) collectedData.__last_ticket_id = ticket.id;
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
        console.log(`[process-chat-flow] 🔄 Transfer node: id=${nextNode.id} dept=${nextNode.data?.department_id || 'none'} flow=${activeState.flow_id}`);
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
            response: replaceVariables(nextNode.data?.message || "Transferindo para um atendente...", variablesContext),
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
        console.log(`[process-chat-flow] 🤖 AI response node: id=${nextNode.id} persona=${nextNode.data?.persona_id || 'default'} maxInteractions=${nextNode.data?.max_ai_interactions || 0} exitKeywords=[${(nextNode.data?.exit_keywords || []).join(',')}]`);
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
            aiNodeActive: true,
            nodeId: nextNode.id,
            flowId: activeState.flow_id,
            flowName: activeState.chat_flows?.name || null,
            contextPrompt: nextNode.data?.context_prompt,
            useKnowledgeBase: nextNode.data?.use_knowledge_base !== false,
            collectedData,
            allowedSources: buildAllowedSources(nextNode.data),
            responseFormat: 'text_only',
            personaId: nextNode.data?.persona_id || null,
            personaName: nextNode.data?.persona_name || null,
            kbCategories: nextNode.data?.kb_categories || null,
            fallbackMessage: nextNode.data?.fallback_message || null,
            objective: nextNode.data?.objective || null,
            maxSentences: nextNode.data?.max_sentences ?? 3,
            forbidQuestions: nextNode.data?.forbid_questions ?? true,
            forbidOptions: nextNode.data?.forbid_options ?? true,
            forbidFinancial: nextNode.data?.forbid_financial ?? false,
            forbidCommercial: nextNode.data?.forbid_commercial ?? false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atualizar estado e retornar próxima pergunta
      console.log(`[process-chat-flow] 📋 Next node: type=${nextNode.type} id=${nextNode.id} hasOptions=${nextNode.type === 'ask_options'} save_as=${nextNode.data?.save_as || 'none'}`);
      // === AUTO-AVANÇO para nós message no caminho principal ===
      // Se o próximo nó é 'message', entregar a mensagem e continuar avançando
      // até encontrar um nó que colete input (ask_*, ai_response, transfer, end)
      const extraMessages: string[] = [];
      
      while (nextNode && (nextNode.type === 'message' || nextNode.type === 'create_ticket')) {
        if (nextNode.type === 'create_ticket') {
          // 🎫 Mid-flow: criar ticket e auto-avançar
          const subject = replaceVariables(nextNode.data?.subject_template || 'Ticket do Fluxo', variablesContext);
          const description = replaceVariables(nextNode.data?.description_template || '', variablesContext);
          const internalNote = nextNode.data?.internal_note
            ? replaceVariables(nextNode.data.internal_note, variablesContext)
            : null;
          const ticket = await createTicketFromFlow(supabaseClient, {
            conversationId: conversationId,
            flowStateId: activeState.id,
            nodeId: nextNode.id,
            contactId: activeState.conversations?.contact_id || null,
            subject,
            description,
            category: nextNode.data?.ticket_category || 'outro',
            priority: nextNode.data?.ticket_priority || 'medium',
            departmentId: nextNode.data?.department_id || null,
            internalNote,
            useCollectedData: nextNode.data?.use_collected_data || false,
            collectedData,
          });
          if (ticket) collectedData.__last_ticket_id = ticket.id;
          console.log(`[process-chat-flow] 🎫 Auto-advancing past create_ticket node ${nextNode.id}`);
        } else {
          const msgText = replaceVariables(nextNode.data?.message || "", variablesContext);
          extraMessages.push(msgText);
          console.log(`[process-chat-flow] 📨 Auto-advancing past message node ${nextNode.id}: "${msgText.substring(0, 50)}..."`);
        }
        
        const afterMessage = findNextNode(flowDef, nextNode);
        if (!afterMessage) {
          nextNode = null;
          break;
        }
        
        // Se próximo é condition, avaliar e continuar
        if (afterMessage.type === 'condition') {
          const condPath = evaluateConditionPath(afterMessage.data, collectedData, userMessage);
          const afterCond = findNextNode(flowDef, afterMessage, condPath);
          nextNode = afterCond || null;
        } else if (afterMessage.type === 'input' || afterMessage.type === 'start') {
          nextNode = findNextNode(flowDef, afterMessage);
        } else {
          nextNode = afterMessage;
        }
      }
      
      // Se acabou sem nó (todos eram message sem saída), completar o fluxo
      if (!nextNode) {
        console.log(`[process-chat-flow] 🏁 Flow completed after message chain`);
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', activeState.id);

        const lastMsg = extraMessages.length > 0 ? extraMessages.join('\n\n') : 'Fluxo finalizado.';
        return new Response(
          JSON.stringify({
            useAI: false,
            response: lastMsg,
            flowId: activeState.flow_id,
            flowName: activeState.chat_flows?.name || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se chegou a end, completar
      if (nextNode.type === 'end') {
        console.log(`[process-chat-flow] 🏁 Flow completed (end node after messages)`);
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', activeState.id);

        // 🎫 EndNode action: create_ticket (after auto-advance)
        if (nextNode.data?.end_action === 'create_ticket') {
          const actionData = nextNode.data.action_data || {};
          const subject = replaceVariables(actionData.subject || nextNode.data.subject_template || 'Ticket do Fluxo', variablesContext);
          const description = replaceVariables(actionData.description || nextNode.data.description_template || '', variablesContext);
          const internalNote = (actionData.internal_note || nextNode.data.internal_note)
            ? replaceVariables(actionData.internal_note || nextNode.data.internal_note, variablesContext)
            : null;
          const ticket = await createTicketFromFlow(supabaseClient, {
            conversationId: conversationId,
            flowStateId: activeState.id,
            nodeId: nextNode.id,
            contactId: activeState.conversations?.contact_id || null,
            subject,
            description,
            category: actionData.ticket_category || nextNode.data.ticket_category || 'outro',
            priority: actionData.ticket_priority || nextNode.data.ticket_priority || 'medium',
            departmentId: actionData.department_id || nextNode.data.department_id || null,
            internalNote,
            useCollectedData: actionData.use_collected_data || nextNode.data.use_collected_data || false,
            collectedData,
          });
          if (ticket) collectedData.__last_ticket_id = ticket.id;
        }

        const endMsg = replaceVariables(nextNode.data?.message || '', variablesContext);
        const allMessages = [...extraMessages, endMsg].filter(Boolean).join('\n\n');
        return new Response(
          JSON.stringify({
            useAI: false,
            response: allMessages || 'Atendimento finalizado.',
            flowId: activeState.flow_id,
            flowName: activeState.chat_flows?.name || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Se chegou a transfer após auto-avanço de messages, executar transferência
      if (nextNode.type === 'transfer') {
        console.log(`[process-chat-flow] 🔄 Transfer node after message chain: ${nextNode.id}`);

        // Acumular mensagem do transfer node junto com mensagens intermediárias
        const transferMsg = replaceVariables(nextNode.data?.message || "Transferindo...", variablesContext);
        const allTransferMessages = [...extraMessages, transferMsg].filter(Boolean).join('\n\n');

        // Completar flow state como transferred
        await supabaseClient
          .from('chat_flow_states')
          .update({
            collected_data: collectedData,
            current_node_id: nextNode.id,
            status: 'transferred',
            completed_at: new Date().toISOString(),
          })
          .eq('id', activeState.id);

        return new Response(JSON.stringify({
          useAI: false,
          response: allTransferMessages,
          transfer: true,
          departmentId: nextNode.data?.department_id || null,
          transferType: nextNode.data?.transfer_type,
          collectedData,
          flowId: activeState.flow_id,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Fix 2: Status semântico correto
      const nextStatus = nextNode.type.startsWith('ask_') || nextNode.type === 'condition' || nextNode.type === 'verify_customer_otp'
        ? 'waiting_input' : 'active';

      await supabaseClient
        .from('chat_flow_states')
        .update({
          collected_data: collectedData,
          current_node_id: nextNode.id,
          status: nextStatus,
        })
        .eq('id', activeState.id);

      const nextMessage = replaceVariables(nextNode.data?.message || "", variablesContext);
      const options = nextNode.type === 'ask_options' 
        ? (nextNode.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value }))
        : null;

      // Combinar mensagens intermediárias com a mensagem do nó final
      const allMessages = [...extraMessages, nextMessage].filter(Boolean).join('\n\n');

      return new Response(
        JSON.stringify({
          useAI: false,
          response: allMessages,
          options,
          flowId: activeState.flow_id,
          flowName: activeState.chat_flows?.name || null,
          ...(nextNode.type === 'ai_response' ? { aiNodeActive: true } : {}),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🧪 MODO TESTE: Bloquear triggers e Master Flow automáticos
    // Em modo teste, APENAS fluxos iniciados manualmente devem rodar
    if (isTestMode && !manualTrigger) {
      console.log('[process-chat-flow] 🧪 TEST MODE: Bloqueando auto-triggers e Master Flow');
      return new Response(JSON.stringify({
        useAI: false,
        aiNodeActive: false,
        skipAutoResponse: true,
        reason: 'test_mode_manual_only',
        message: 'Modo teste ativo - apenas fluxos manuais permitidos'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
          
          // 🆕 MELHORIA: Exigir pelo menos 50% das keywords essenciais para match
          // 1 keyword → 1 match; 2 keywords → 1; 3 → 2; 4 → 2; 5 → 3...
          const minMatches = essentialKeywords.length <= 1 ? 1 : Math.ceil(essentialKeywords.length * 0.5);
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
      // 🆕 PROTEÇÃO: Verificar se existe estado ativo ANTES de iniciar Master Flow
      const { data: existingActiveFlowStates } = await supabaseClient
        .from('chat_flow_states')
        .select('id, flow_id, current_node_id')
        .eq('conversation_id', conversationId)
        .in('status', ['active', 'waiting_input', 'in_progress'])
        .order('started_at', { ascending: false })
        .limit(1);

      const existingActiveFlowState = existingActiveFlowStates?.[0] || null;

      if (existingActiveFlowState) {
        console.log('[process-chat-flow] ⚠️ Estado ativo encontrado - NÃO iniciar Master Flow');
        console.log('[process-chat-flow] Existing state:', existingActiveFlowState.id, 'flow:', existingActiveFlowState.flow_id, 'node:', existingActiveFlowState.current_node_id);
        
        // Mensagem genérica de retry para evitar perda de estado
        return new Response(
          JSON.stringify({
            useAI: false,
            response: "Desculpe, não entendi sua resposta. 🙂\n\nPor favor, verifique as opções acima e responda novamente.",
            retry: true,
            preventAI: true,
            flowId: existingActiveFlowState.flow_id,
            nodeId: existingActiveFlowState.current_node_id,
            invalidOption: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
        
        // ============================================================
        // 🆕 VERSÃO PRODUÇÃO-SAFE: Travessia com 4 correções críticas
        // 1. Nunca retorna response: "" (usa null)
        // 2. UPSERT de state (não duplica)
        // 3. Condition com cascata de handles
        // 4. Logs fortes para diagnóstico
        // ============================================================
        
        const NO_CONTENT = new Set(['input', 'start', 'condition']);
        const MAX_TRAVERSAL = 12;

        // 1) Descobrir startNode
        const targetIds = new Set((flowDef.edges || []).map((e: any) => e.target));
        const startNode = flowDef.nodes.find((n: any) => !targetIds.has(n.id)) || flowDef.nodes[0];

        console.log('[process-chat-flow] 🚀 Master Flow start:', startNode.type, startNode.id);

        // 2) Carregar contact/conversation uma vez
        const { data: conversation } = await supabaseClient
          .from('conversations')
          .select('id, contact_id, channel, status, priority, protocol_number, queue, created_at, resolved_at')
          .eq('id', conversationId)
          .maybeSingle();

        let contactData: any = null;
        if (conversation?.contact_id) {
          const { data: contact } = await supabaseClient
            .from('contacts')
            .select('*')
            .eq('id', conversation.contact_id)
            .maybeSingle();
          contactData = contact;
          enrichContactIsCustomer(contactData);
        }

        let collectedData: Record<string, any> = {};
        // 🆕 Build variablesContext for master flow replaceVariables calls
        const masterVariablesContext = buildVariablesContext(collectedData, contactData, conversation);

        // Função para avaliar condição — usa getVar() centralizado
        function evalCond(data: any): boolean {
          const { condition_type, condition_field, condition_value } = data || {};
          let fieldValue = condition_field
            ? getVar(condition_field, collectedData, contactData, conversation)
            : userMessage;

          console.log('[process-chat-flow] 🔍 Condition evaluation:', { 
            condition_type, 
            condition_field, 
            condition_value, 
            fieldValue,
            contactId: contactData?.id
          });

          switch (condition_type) {
            case 'has_data':
            case 'not_empty':
              return !!fieldValue && String(fieldValue).trim().length > 0;
            case 'is_empty':
            case 'no_data':
              return !fieldValue || String(fieldValue).trim().length === 0;
            case 'equals':
              return String(fieldValue ?? '').toLowerCase() === String(condition_value ?? '').toLowerCase();
            case 'not_equals':
              return String(fieldValue ?? '').toLowerCase() !== String(condition_value ?? '').toLowerCase();
            case 'is_true':
              return fieldValue === true || fieldValue === 'true';
            case 'is_false':
              return fieldValue === false || fieldValue === 'false' || !fieldValue;
            case 'contains':
              return String(fieldValue ?? '').toLowerCase().includes(String(condition_value ?? '').toLowerCase());
            default:
              console.log('[process-chat-flow] ⚠️ Unknown condition_type:', condition_type);
              return false;
          }
        }

        // 3) Loop de travessia com cascata de handles
        let node: any = startNode;
        let steps = 0;

        while (node && NO_CONTENT.has(node.type) && steps < MAX_TRAVERSAL) {
          steps++;
          console.log(`[process-chat-flow] ⏩ Traversing[${steps}] ${node.type} (${node.id})`);

          if (node.type === 'condition') {
            // Detectar multi-regra vs clássico
            const hasMultiRules = node.data?.condition_rules?.length > 0;
            let next: any = null;

          if (hasMultiRules) {
              // 🆕 FIX: Se não há userMessage real, parar na condição e aguardar input
              if (!userMessage || userMessage.trim().length === 0) {
                console.log('[process-chat-flow] 🛑 Master flow: multi-rule condition without userMessage — stopping as waiting_input');
                break;
              }
              // Multi-regra: usar evaluateConditionPath que retorna rule.id ou "else"
              const path = evaluateConditionPath(node.data, collectedData, userMessage);
              console.log(`[process-chat-flow] 🔀 Multi-rule condition path: "${path}"`);
              next = findNextNode(flowDef, node, path);
              if (next) {
                console.log(`[process-chat-flow] ✓ Found next node via multi-rule handle "${path}":`, next.type);
              }
            } else {
              // Clássico: true/false com cascata de handles
              const result = evalCond(node.data);
              console.log(`[process-chat-flow] 🔀 Classic condition result: ${result}`);
              const handles = result ? ['true', 'yes', '1'] : ['false', 'no', '2'];
              console.log('[process-chat-flow] 🔀 Trying handles:', handles.join(', '));
              for (const h of handles) {
                next = findNextNode(flowDef, node, h);
                if (next) {
                  console.log(`[process-chat-flow] ✓ Found next node via handle "${h}":`, next.type);
                  break;
                }
              }
            }

            if (!next) {
              console.log('[process-chat-flow] ⚠️ No next node for condition - stopping traversal');
              break;
            }
            node = next;
          } else {
            const next = findNextNode(flowDef, node);
            if (!next) {
              console.log('[process-chat-flow] ⚠️ No next node - stopping traversal');
              break;
            }
            node = next;
          }
        }

        console.log('[process-chat-flow] 📍 Content node:', node?.type, node?.id, `steps=${steps}`);

        // 4) CORREÇÃO #2: UPSERT de state (não duplicar)
        const { data: existingState } = await supabaseClient
          .from('chat_flow_states')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('flow_id', masterFlow.id)
          .in('status', ['active', 'waiting_input'])
          .maybeSingle();

        let stateId: string | null = null;

        if (existingState?.id) {
          stateId = existingState.id;
          console.log('[process-chat-flow] 📝 Updating existing state:', stateId);
          await supabaseClient
            .from('chat_flow_states')
            .update({ 
              current_node_id: node.id, 
              collected_data: collectedData,
              status: node.type === 'condition' ? 'waiting_input' : 'active',
            })
            .eq('id', existingState.id);
        } else {
          const { data: newState, error } = await supabaseClient
            .from('chat_flow_states')
            .insert({
              conversation_id: conversationId,
              flow_id: masterFlow.id,
              current_node_id: node.id,
              collected_data: collectedData,
              // 🆕 condition (multi-regra parada) → waiting_input
              status: node.type === 'condition' ? 'waiting_input' : 'active',
            })
            .select('id')
            .single();

          if (error) {
            console.error('[process-chat-flow] Error creating state:', error);
            return new Response(
              JSON.stringify({
                useAI: false,
                response: null,
                error: 'Failed to create flow state',
                flowId: masterFlow.id,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          stateId = newState.id;
          console.log('[process-chat-flow] ✅ Created new state:', stateId);
        }

        // 5) Responder baseado no nó final - CORREÇÃO #1: Nunca response: ""

        // 🆕 Condição multi-regra aguardando input — não enviar nada, só registrar estado
        if (node.type === 'condition') {
          console.log('[process-chat-flow] 🛑 Master flow stopped at condition node — waiting for user message');
          return new Response(
            JSON.stringify({
              useAI: false,
              response: null,
              flowId: masterFlow.id,
              flowStarted: true,
              isMasterFlow: true,
              waitingConditionInput: true,
              debug: { startNodeType: startNode.type, contentNodeType: node.type, steps, stateId }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (node.type === 'ai_response') {
          return new Response(
            JSON.stringify({ 
              useAI: true, 
              aiNodeActive: true, 
              nodeId: node.id, 
              flowId: masterFlow.id, 
              flowStarted: true,
              masterFlowId: masterFlow.id,
              masterFlowName: masterFlow.name,
              allowedSources: buildAllowedSources(node.data),
              responseFormat: 'text_only',
              personaId: node.data?.persona_id || null,
              kbCategories: node.data?.kb_categories || null,
              contextPrompt: node.data?.context_prompt || null,
              fallbackMessage: node.data?.fallback_message || null,
              objective: node.data?.objective || null,
              maxSentences: node.data?.max_sentences ?? 3,
              forbidQuestions: node.data?.forbid_questions ?? true,
              forbidOptions: node.data?.forbid_options ?? true,
              forbidFinancial: node.data?.forbid_financial ?? false,
              forbidCommercial: node.data?.forbid_commercial ?? false,
              debug: { startNodeType: startNode.type, contentNodeType: node.type, steps, stateId }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (node.type === 'transfer') {
          await supabaseClient
            .from('chat_flow_states')
            .update({ status: 'transferred' })
            .eq('id', stateId);
            
          const transferMsg = replaceVariables(node.data?.message || 'Transferindo para um atendente...', masterVariablesContext);
          const msg = (transferMsg || '').trim();
          return new Response(
            JSON.stringify({ 
              useAI: false, 
              response: msg.length ? msg : null,  // ✅ null quando vazio
              transfer: true, 
              transferType: node.data?.transfer_type,
              departmentId: node.data?.department_id,
              flowId: masterFlow.id, 
              flowStarted: true,
              isMasterFlow: true,
              debug: { startNodeType: startNode.type, contentNodeType: node.type, steps, stateId }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (node.type === 'end') {
          await supabaseClient
            .from('chat_flow_states')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', stateId);
            
          const endMsg = replaceVariables(node.data?.message || '', masterVariablesContext);
          const msg = (endMsg || '').trim();
          return new Response(
            JSON.stringify({ 
              useAI: false, 
              response: msg.length ? msg : null,  // ✅ null quando vazio
              flowCompleted: true, 
              flowId: masterFlow.id,
              isMasterFlow: true,
              debug: { startNodeType: startNode.type, contentNodeType: node.type, steps, stateId }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // message / ask_options / ask_*
        const contentMessage = replaceVariables(node.data?.message || '', masterVariablesContext);
        const msg = (contentMessage || '').trim();  // ✅ CORREÇÃO #1
        const options = node.type === 'ask_options'
          ? (node.data?.options || []).map((opt: any) => ({ label: opt.label, value: opt.value, id: opt.id }))
          : null;

        return new Response(
          JSON.stringify({
            useAI: false,
            response: msg.length ? msg : null,  // ✅ nunca "" - sempre null quando vazio
            options,
            flowId: masterFlow.id,
            flowStarted: true,
            isMasterFlow: true,
            debug: { startNodeType: startNode.type, contentNodeType: node.type, steps, stateId }
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
        // 🆕 FIX: Multi-regra com keywords precisa de mensagem real
        const hasMultiRules = currentNode.data?.condition_rules?.length > 0;
        if (hasMultiRules && (!userMessage || userMessage.trim().length === 0)) {
          console.log('[process-chat-flow] 🛑 New flow: multi-rule condition without userMessage — stopping as waiting_input');
          break;
        }
        const path = evaluateConditionPath(currentNode.data, {}, userMessage);
        console.log('[process-chat-flow] 🔍 Condição avaliada → path:', path);
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
        // 🆕 condition (multi-regra parada) → waiting_input
        status: startNode.type === 'condition' ? 'waiting_input' : 'active',
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
    
    // 🆕 Condição multi-regra aguardando input
    if (startNode.type === 'condition') {
      console.log('[process-chat-flow] 🛑 New flow stopped at condition node — waiting for user message');
      return new Response(
        JSON.stringify({
          useAI: false,
          response: null,
          flowId: matchedFlow.id,
          flowStarted: true,
          waitingConditionInput: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          allowedSources: buildAllowedSources(startNode.data),
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
          forbidFinancial: startNode.data?.forbid_financial ?? false,
          forbidCommercial: startNode.data?.forbid_commercial ?? false,
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
