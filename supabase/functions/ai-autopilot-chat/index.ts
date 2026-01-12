import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: Buscar modelo AI configurado no banco
async function getConfiguredAIModel(supabaseClient: any): Promise<string> {
  try {
    const { data } = await supabaseClient
      .from('system_configurations')
      .select('value')
      .eq('key', 'ai_default_model')
      .maybeSingle();
    
    return data?.value || 'google/gemini-2.5-flash';
  } catch (error) {
    console.error('[ai-autopilot-chat] Error fetching AI model config:', error);
    return 'google/gemini-2.5-flash';
  }
}

// FASE 2: Função para gerar hash SHA-256 da pergunta normalizada
async function generateQuestionHash(message: string): Promise<string> {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/g, "") // Remove pontuação
    .trim();
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========== SECURITY HELPERS - LGPD DATA MASKING ==========

function maskEmail(email: string | null | undefined): string {
  if (!email) return 'Não identificado';
  const [user, domain] = email.split('@');
  if (!domain) return 'Email inválido';
  const maskedUser = user.length > 3 
    ? user.slice(0, 2) + '***' 
    : user.slice(0, 1) + '***';
  return `${maskedUser}@${domain}`;
}

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'Não cadastrado';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-${digits.slice(-4)}`;
}

// ============================================================
// 🔒 HELPER: Seleção de Instância WhatsApp
// SEMPRE prioriza a instância vinculada à conversa
// ============================================================
async function getWhatsAppInstanceForConversation(
  supabaseClient: any,
  conversationId: string,
  conversationWhatsappInstanceId: string | null
): Promise<any | null> {
  // 1. Se a conversa tem instância vinculada, usar ela
  if (conversationWhatsappInstanceId) {
    const { data: linkedInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('id', conversationWhatsappInstanceId)
      .single();
    
    if (linkedInstance) {
      console.log('[getWhatsAppInstance] ✅ Usando instância VINCULADA:', {
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instance_name,
        phoneNumber: linkedInstance.phone_number,
        status: linkedInstance.status
      });
      return linkedInstance;
    } else {
      console.warn('[getWhatsAppInstance] ⚠️ Instância vinculada não encontrada:', conversationWhatsappInstanceId);
    }
  }
  
  // 2. Fallback: buscar instância conectada APENAS se não houver vinculada
  console.warn('[getWhatsAppInstance] ⚠️ Conversa', conversationId, 'sem instância vinculada - usando fallback');
  const { data: fallbackInstance } = await supabaseClient
    .from('whatsapp_instances')
    .select('*')
    .eq('status', 'connected')
    .order('created_at', { ascending: true }) // Ordenar para consistência
    .limit(1)
    .maybeSingle();
  
  if (fallbackInstance) {
    console.log('[getWhatsAppInstance] 🔄 Usando instância FALLBACK:', {
      instanceId: fallbackInstance.id,
      instanceName: fallbackInstance.instance_name,
      phoneNumber: fallbackInstance.phone_number
    });
  } else {
    console.error('[getWhatsAppInstance] ❌ Nenhuma instância WhatsApp disponível');
  }
  
  return fallbackInstance;
}

// ============================================================
// 🔒 CONSTANTES GLOBAIS - Unificadas para prevenir inconsistências
// ============================================================
const FALLBACK_PHRASES = [
  'vou chamar um especialista',
  'vou transferir para um atendente',
  'transferir para um atendente',
  'encaminhar para um humano',
  'não tenho essa informação',
  'não encontrei essa informação',
  'não consegui encontrar',
  'não consegui registrar',
  'momento por favor',
  'chamar um atendente',
  // 🆕 Frases faltantes que causavam cache poisoning
  'desculpe',
  'não consegui processar',
  'não consigo',
  'infelizmente não',
  'não posso ajudar',
  'não sei como',
  'sorry',
  'i cannot',
  'unable to'
];

// 🔐 BARREIRA FINANCEIRA UNIFICADA - Palavras que EXIGEM cliente identificado + OTP
const FINANCIAL_BARRIER_KEYWORDS = [
  'saque',
  'sacar',
  'saldo',
  'pix',
  'dinheiro',
  'pagamento',
  'reembolso',
  'comissão',
  'carteira',
  'transferência',
  'estorno',
  'cancelar',
  'cancelamento',
  'devolução',
  'devolver',
  'meu dinheiro'
];

// ============================================================
// 🎯 SISTEMA ANTI-ALUCINAÇÃO - SCORE DE CONFIANÇA (Sprint 2)
// ============================================================

interface RetrievedDocument {
  id: string;
  title: string;
  content: string;
  category?: string;
  similarity: number;
  updated_at?: string;
}

interface ConfidenceResult {
  score: number;
  components: {
    retrieval: number;
    coverage: number;
    conflicts: boolean;
  };
  action: 'direct' | 'cautious' | 'handoff';
  reason: string;
  department?: string;
}

// Thresholds
const SCORE_DIRECT = 0.80;
const SCORE_CAUTIOUS = 0.65;

// Indicadores de conflito
const CONFLICT_INDICATORS = ['porém', 'entretanto', 'no entanto', 'diferente', 'contrário', 'atualizado', 'novo', 'antigo'];

// Gatilhos de handoff imediato por departamento
const IMMEDIATE_HANDOFF_TRIGGERS: Record<string, string[]> = {
  financeiro: ['estorno judicial', 'processo', 'advogado', 'procon', 'reclamação formal', 'cobrança indevida', 'fraude'],
  juridico: ['contrato', 'termos de uso', 'lgpd', 'dados pessoais', 'indenização'],
  tecnico: ['sistema fora', 'erro crítico', 'perdi tudo', 'não funciona nada'],
};

// Helper: Calcular cobertura da query pelos documentos
function calculateCoverage(query: string, documents: RetrievedDocument[]): number {
  if (documents.length === 0) return 0;
  
  const queryWords = query.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  if (queryWords.length === 0) return 0;
  
  const allContent = documents.map(d => 
    `${d.title} ${d.content}`.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  ).join(' ');
  
  const coveredWords = queryWords.filter(word => allContent.includes(word));
  return coveredWords.length / queryWords.length;
}

// Helper: Detectar conflitos entre documentos
function detectConflicts(documents: RetrievedDocument[]): boolean {
  if (documents.length < 2) return false;
  
  // Verificar diferença de idade entre documentos (mais de 90 dias)
  const now = Date.now();
  const ages = documents
    .filter(d => d.updated_at)
    .map(d => now - new Date(d.updated_at!).getTime());
  
  if (ages.length >= 2) {
    const maxAge = Math.max(...ages);
    const minAge = Math.min(...ages);
    const ageDiffDays = (maxAge - minAge) / (1000 * 60 * 60 * 24);
    if (ageDiffDays > 90) return true;
  }
  
  // Verificar indicadores textuais de conflito
  const contents = documents.map(d => d.content.toLowerCase());
  return CONFLICT_INDICATORS.some(indicator =>
    contents.some(c => c.includes(indicator))
  );
}

// Helper: Verificar handoff imediato
function checkImmediateHandoff(query: string): { triggered: boolean; dept?: string; reason?: string } {
  const queryLower = query.toLowerCase();
  
  for (const [dept, triggers] of Object.entries(IMMEDIATE_HANDOFF_TRIGGERS)) {
    for (const trigger of triggers) {
      if (queryLower.includes(trigger)) {
        return { 
          triggered: true, 
          dept, 
          reason: `Gatilho imediato: "${trigger}"` 
        };
      }
    }
  }
  return { triggered: false };
}

// Helper: Determinar departamento por keywords
function pickDepartment(question: string): string {
  const q = question.toLowerCase();
  const deptKeywords: Record<string, string[]> = {
    financeiro: ['pix', 'reembolso', 'estorno', 'comissão', 'boleto', 'fatura', 'saque', 'pagamento'],
    tecnico: ['erro', 'bug', 'login', 'acesso', 'integração', 'api', 'token', 'não funciona'],
    comercial: ['preço', 'proposta', 'plano', 'upgrade', 'desconto', 'assinatura'],
    logistica: ['envio', 'prazo', 'entrega', 'coleta', 'rastreio', 'transportadora']
  };
  
  for (const [dept, keywords] of Object.entries(deptKeywords)) {
    if (keywords.some(k => q.includes(k))) return dept;
  }
  return 'suporte_n1';
}

// 🎯 FUNÇÃO PRINCIPAL: Calcular Score de Confiança
function calculateConfidenceScore(query: string, documents: RetrievedDocument[]): ConfidenceResult {
  // 1. Verificar gatilhos de handoff imediato
  const immediateCheck = checkImmediateHandoff(query);
  if (immediateCheck.triggered) {
    return {
      score: 0,
      components: { retrieval: 0, coverage: 0, conflicts: false },
      action: 'handoff',
      reason: immediateCheck.reason!,
      department: immediateCheck.dept
    };
  }
  
  // 2. Sem documentos = handoff
  if (documents.length === 0) {
    return {
      score: 0,
      components: { retrieval: 0, coverage: 0, conflicts: false },
      action: 'handoff',
      reason: 'Nenhum documento relevante encontrado na KB',
      department: pickDepartment(query)
    };
  }
  
  // 3. Calcular componentes
  const confRetrieval = Math.max(...documents.map(d => d.similarity || 0));
  const coverage = calculateCoverage(query, documents);
  const conflicts = detectConflicts(documents);
  
  // 4. FÓRMULA: SCORE = 0.6*retrieval + 0.4*coverage - 0.25*conflicts
  let score = (0.6 * confRetrieval) + (0.4 * coverage);
  if (conflicts) score -= 0.25;
  score = Math.max(0, Math.min(1, score)); // Clamp 0-1
  
  // 5. Determinar ação
  let action: 'direct' | 'cautious' | 'handoff';
  let reason: string;
  
  if (score >= SCORE_DIRECT) {
    action = 'direct';
    reason = `Alta confiança (${(score * 100).toFixed(0)}%) - Resposta direta`;
  } else if (score >= SCORE_CAUTIOUS) {
    action = 'cautious';
    reason = `Confiança média (${(score * 100).toFixed(0)}%) - Resposta cautelosa`;
  } else {
    action = 'handoff';
    reason = `Baixa confiança (${(score * 100).toFixed(0)}%) - Handoff recomendado`;
  }
  
  return {
    score,
    components: { retrieval: confRetrieval, coverage, conflicts },
    action,
    reason,
    department: action === 'handoff' ? pickDepartment(query) : undefined
  };
}

// Helper: Gerar prefixo de resposta baseado na confiança
function generateResponsePrefix(action: 'direct' | 'cautious' | 'handoff'): string {
  switch (action) {
    case 'direct':
      return ''; // Sem prefixo para respostas diretas
    case 'cautious':
      return '**Baseado nas informações disponíveis:**\n\n';
    case 'handoff':
      return ''; // Handoff usa mensagem própria
  }
}

// Estrutura de log para métricas
interface ConfidenceLog {
  conversation_id: string;
  query_preview: string;
  score: number;
  components: { retrieval: number; coverage: number; conflicts: boolean };
  action: string;
  reason: string;
  department?: string;
  retrieved_docs: string[];
  timestamp: string;
}

// 🆕 Padrões de INTENÇÃO financeira (não keyword solta) - Usado globalmente
const FINANCIAL_ACTION_PATTERNS = [
  // Padrões melhorados para capturar variações naturais
  /quero\s+(fazer\s+)?(um\s+)?saque/i,                // "quero fazer um saque", "quero saque"
  /preciso\s+(fazer\s+)?(um\s+)?saque/i,              // "preciso fazer um saque"
  /saque\s+(da\s+)?(minha\s+)?carteira/i,             // "saque da minha carteira"
  /fazer\s+(um\s+)?saque/i,                           // "fazer saque"
  
  // Padrões existentes mantidos
  /quero\s+(sacar|reembolso|meu\s+dinheiro)/i,
  /preciso\s+(sacar|de\s+reembolso|do\s+meu\s+dinheiro)/i,
  /cadê\s+(meu\s+saldo|meu\s+dinheiro|meu\s+pix)/i,
  /não\s+(recebi|caiu|chegou)\s+(o\s+)?(pix|pagamento|saldo|dinheiro)/i,
  /devolver\s+(meu\s+)?dinheiro/i,
  /estornar|estorno/i,
  /erro\s+(no|de)\s+pagamento/i,
  /quero\s+meu\s+dinheiro/i,
  /cobrar|cobraram\s+errado/i,
  
  // Novos padrões para melhor cobertura
  /ver\s+(meu\s+)?saldo/i,                            // "quero ver meu saldo"
  /consultar\s+(meu\s+)?saldo/i,                      // "consultar saldo"
  /quanto\s+tenho\s+(de\s+)?saldo/i,                  // "quanto tenho de saldo"
  /transferir\s+(meu\s+)?saldo/i,                     // "transferir meu saldo"
  /retirar\s+(meu\s+)?dinheiro/i,                     // "retirar meu dinheiro"
  /pagar.*pix/i,                                       // "pagar via pix"
];

// 🆕 Perguntas INFORMATIVAS - NÃO criar ticket - Usado globalmente
const INFORMATIONAL_PATTERNS = [
  /como\s+(funciona|faz|é|posso)/i,
  /o\s+que\s+(é|significa)/i,
  /qual\s+(é|o)/i,
  /pode\s+me\s+explicar/i,
  /quero\s+saber/i,
  /me\s+explica/i,
];

  // Template de mensagem de sucesso do ticket (CONTEXTUAL)
function createTicketSuccessMessage(
  ticketId: string, 
  issueType: string = 'financeiro', 
  orderId?: string,
  withdrawalData?: { amount?: number; cpf_last4?: string },
  ticketNumber?: string | null
): string {
  // Usa ticket_number se disponível, senão fallback para UUID truncado
  const formattedId = ticketNumber || ticketId.slice(0, 8).toUpperCase();
  
  // FASE 5: Mensagem específica para SAQUE com dados coletados
  if (issueType === 'saque' && withdrawalData?.amount) {
    return `**Solicitação de saque registrada!**

**Protocolo:** #${formattedId}
**Valor Solicitado:** R$ ${withdrawalData.amount.toFixed(2)}
${withdrawalData.cpf_last4 ? `**CPF (final):** ...${withdrawalData.cpf_last4}` : ''}
**Prazo:** até 7 dias úteis

**Você receberá um email confirmando a abertura do chamado.**
**Quando o saque for processado, você será notificado por email também.**

**IMPORTANTE:** O saque será creditado via PIX na chave informada, vinculada ao seu CPF. Não é possível transferir para conta de terceiros.`;
  }
  
  const ticketMessages: Record<string, string> = {
    'financeiro': `Entendi sua solicitação financeira. Abri o ticket #${formattedId} para nossa equipe resolver.`,
    'reembolso': `Registrei seu pedido de reembolso no ticket #${formattedId}. Vamos analisar e retornar.`,
    'devolucao': `Registrei seu pedido de devolução no ticket #${formattedId}. Vamos processar e retornar.`,
    'troca': `Registrei sua solicitação de troca no ticket #${formattedId}. Nossa equipe vai cuidar disso.`,
    'defeito': `Criei o ticket #${formattedId} para nossa equipe técnica analisar seu caso.`,
    'tecnico': `Criei o ticket #${formattedId} para nossa equipe técnica analisar seu caso.`,
    'default': `Abri o ticket #${formattedId}. Nossa equipe vai cuidar disso para você.`
  };
  
  const baseMessage = ticketMessages[issueType] || ticketMessages['default'];
  const orderInfo = orderId ? `\n\n**Pedido:** ${orderId}` : '';
  
  return `${baseMessage}${orderInfo}`;
}

interface AutopilotChatRequest {
  conversationId: string;
  customerMessage: string;
  maxHistory?: number;
  customer_context?: {
    name: string;
    email: string;
    isVerified: boolean;
  } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, customerMessage, maxHistory = 10, customer_context }: AutopilotChatRequest = await req.json();
    
    // Validação defensiva
    if (!conversationId || conversationId === 'undefined') {
      console.error('[ai-autopilot-chat] ❌ conversationId inválido:', conversationId);
      return new Response(JSON.stringify({ 
        error: 'conversationId é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[ai-autopilot-chat] Request received:', { conversationId, messagePreview: customerMessage?.substring(0, 50) });

    // 🚨 FASE 3: Declarar variáveis fora do try para acesso no catch
    let conversation: any = null;
    let responseChannel = 'web_chat';
    let contact: any = null;
    let department: string | null = null;

    // 🚨 FASE 3: Fallback Gracioso - Try-catch interno para capturar falhas da IA
    try {
      // 1. Buscar conversa e informações do contato (ANTES do cache)
      const { data: conversationData, error: convError } = await supabaseClient
        .from('conversations')
        .select(`
          *,
          contacts!inner(
            id, first_name, last_name, email, phone, whatsapp_id, company, status, document
          )
        `)
        .eq('id', conversationId)
        .single();

      if (convError || !conversationData) {
        console.error('[ai-autopilot-chat] Conversa não encontrada:', convError);
        return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      conversation = conversationData;
      contact = conversation.contacts as any;
      department = conversation.department || null;

      // 🛡️ VERIFICAÇÃO DEFENSIVA: Não processar se não está em autopilot
      if (conversation.ai_mode !== 'autopilot') {
        console.log('[ai-autopilot-chat] ⚠️ Conversa não está em autopilot. ai_mode:', conversation.ai_mode, '- IGNORANDO');
        return new Response(
          JSON.stringify({ 
            skipped: true, 
            reason: `Conversa em modo ${conversation.ai_mode}`,
            ai_mode: conversation.ai_mode
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // FASE 4: Buscar canal da ÚLTIMA mensagem do cliente (não da conversa)
      const { data: lastCustomerMessage } = await supabaseClient
        .from('messages')
        .select('channel')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      responseChannel = lastCustomerMessage?.channel || 'web_chat';
    
      console.log(`[ai-autopilot-chat] Canal da última mensagem: ${responseChannel}, Departamento: ${department}`);

    // FASE 1: Verificar se deve pular cache para experiência personalizada
    const contactHasEmailForCache = contact.email && contact.email.trim() !== '';
    const isFinancialForCache = FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
    const isFirstContactGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|ei|eae|e aí|hey|hi|hello)[\s!.,?]*$/i.test(customerMessage.trim());

    const shouldSkipCacheForPersonalization = 
      (contactHasEmailForCache && isFirstContactGreeting) || // Cliente conhecido + saudação
      isFinancialForCache || // Contexto financeiro (precisa OTP)
      (!contactHasEmailForCache && responseChannel === 'whatsapp'); // Lead novo WhatsApp

    // Gerar hash da pergunta (usado tanto para busca quanto para salvar cache depois)
    const questionHash = await generateQuestionHash(customerMessage);

    if (shouldSkipCacheForPersonalization) {
      console.log('[ai-autopilot-chat] ⚡ SKIP CACHE para experiência personalizada');
    } else {
      // FASE 2: Verificar cache antes de processar (zero latência para perguntas repetidas)
      const { data: cachedResponse } = await supabaseClient
        .from('ai_response_cache')
        .select('answer, context_ids, created_at')
        .eq('question_hash', questionHash)
        .gte('created_at', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()) // ✅ FASE 3: TTL reduzido para 1h
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedResponse) {
        console.log('✅ [CACHE HIT] Resposta instantânea recuperada do cache');
        
        // 🆕 FASE 1: Verificar se resposta cacheada é fallback e executar handoff real
        const isCachedFallback = FALLBACK_PHRASES.some(phrase => 
          cachedResponse.answer.toLowerCase().includes(phrase)
        );
        
        if (isCachedFallback) {
          console.log('🚨 [CACHE] Resposta cacheada é FALLBACK - IGNORANDO cache e gerando nova resposta');
          
          // 1. Mudar modo para copilot
          await supabaseClient
            .from('conversations')
            .update({ ai_mode: 'copilot' })
            .eq('id', conversationId);
          
          // 2. Rotear para agente humano
          await supabaseClient.functions.invoke('route-conversation', {
            body: { conversationId }
          });
          
          // 3. Criar ticket se for financeiro (com verificação de INTENÇÃO, não keyword solta)
          const isInformational = INFORMATIONAL_PATTERNS.some(p => p.test(customerMessage));
          const isFinancial = !isInformational && FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
          
          let ticketProtocol = '';
          if (isFinancial) {
            // 🔒 ANTI-DUPLICAÇÃO: Verificar se conversa já tem ticket vinculado
            if (conversation.related_ticket_id) {
              console.log('[CACHE] ⚠️ Conversa já possui ticket vinculado - pulando criação:', conversation.related_ticket_id);
              ticketProtocol = conversation.related_ticket_id.slice(0, 8).toUpperCase();
            } else {
              // Criar ticket apenas se não houver
              const { data: ticket } = await supabaseClient
                .from('tickets')
              .insert({
                  customer_id: contact.id,
                  subject: `Solicitação Financeira - ${customerMessage.substring(0, 50)}`,
                  description: customerMessage,
                  priority: 'high',
                  status: 'open',
                  category: 'financeiro',
                  source_conversation_id: conversationId
                })
                .select()
                .single();
              
              if (ticket) {
                ticketProtocol = ticket.id.slice(0, 8).toUpperCase();
                console.log('🎫 [CACHE] Ticket financeiro criado:', ticket.id);
                
                // Vincular à conversa
                await supabaseClient
                  .from('conversations')
                  .update({ related_ticket_id: ticket.id })
                  .eq('id', conversationId);
              }
            }
          }
          
          // 4. Registrar nota interna
          await supabaseClient.from('interactions').insert({
            customer_id: contact.id,
            type: 'internal_note',
            content: `Handoff automático (cache poisoning detectado): "${customerMessage}"`,
            channel: responseChannel
          });
          
          // 5. Invalidar esse cache
          await supabaseClient
            .from('ai_response_cache')
            .delete()
            .eq('question_hash', questionHash);
          
          console.log('✅ [CACHE] Handoff executado, cache invalidado');
          
          // 🆕 6. RETORNAR RESPOSTA IMEDIATA DE HANDOFF (não usar cache ruim!)
          const handoffMessage = isFinancial && ticketProtocol
            ? `Entendi sua solicitação financeira. Estou transferindo você para um especialista humano que vai te ajudar com isso.\n\nProtocolo criado: #${ticketProtocol}`
            : `Entendi sua dúvida. Estou transferindo você para um especialista humano que poderá te ajudar melhor.`;
          
          // Salvar mensagem de handoff no banco
          const { data: handoffMessageData } = await supabaseClient
            .from("messages")
            .insert({
              conversation_id: conversationId,
              content: handoffMessage,
              sender_type: "user",
              is_ai_generated: true,
              channel: responseChannel,
            })
            .select('id')
            .single();
          
          // Atualizar last_message_at
          await supabaseClient
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
          
          // Se for WhatsApp, enviar via Evolution API
          if (responseChannel === 'whatsapp' && handoffMessageData) {
            const whatsappInstance = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id
            );

            if (whatsappInstance) {
              const { error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
                body: {
                  instance_id: whatsappInstance.id,
                  phone_number: contact.phone,
                  whatsapp_id: contact.whatsapp_id,
                  message: handoffMessage,
                },
              });

              if (!whatsappError) {
                await supabaseClient
                  .from('messages')
                  .update({ status: 'sent' })
                  .eq('id', handoffMessageData.id);
              }
            }
          }
          
          // 🆕 RETORNAR AQUI - Não deixar o código continuar para retornar cache ruim
          return new Response(
            JSON.stringify({
              status: 'handoff_executed',
              message: handoffMessage,
              from_cache: false,
              handoff_reason: 'cached_fallback_detected',
              ticket_created: isFinancial,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // ❌ REMOVIDO: Não inserir mensagem do cliente aqui - já foi inserida por useSendMessageOffline/handle-whatsapp-event/inbound-email

        // Salvar resposta da IA (do cache)
        const { data: aiMessageData } = await supabaseClient
          .from("messages")
          .insert({
            conversation_id: conversationId,
            content: cachedResponse.answer,
            sender_type: "user",
            is_ai_generated: true,
            attachment_url: JSON.stringify(cachedResponse.context_ids || []),
            channel: responseChannel, // ✅ FASE 4: Adicionar canal
          })
          .select('id')
          .single();

        // Atualizar last_message_at
        await supabaseClient
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);

        // Se for WhatsApp, enviar mensagem via Evolution API
        if (responseChannel === 'whatsapp') {
          const whatsappInstance = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id
          );

          if (whatsappInstance && aiMessageData) {
            console.log('[ai-autopilot-chat] 📤 Enviando resposta cached via WhatsApp');

            const { error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
              body: {
                instance_id: whatsappInstance.id,
                phone_number: contact.phone,
                whatsapp_id: contact.whatsapp_id,
                message: cachedResponse.answer,
              },
            });

            if (!whatsappError) {
              await supabaseClient
                .from('messages')
                .update({ status: 'sent' })
                .eq('id', aiMessageData.id);
            }
          }
        }

        return new Response(
          JSON.stringify({
            message: cachedResponse.answer,
            from_cache: true,
            used_articles: cachedResponse.context_ids || [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('⚠️ [CACHE MISS] Processando nova resposta...');
    
    // FASE 4: Rate Limiting (10 mensagens por minuto por conversa)
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseClient
      .rpc('check_rate_limit', {
        p_identifier: `conversation_${conversationId}`,
        p_action_type: 'ai_autopilot_message',
        p_max_requests: 10,
        p_window_minutes: 1,
        p_block_minutes: 60
      });

    if (rateLimitError) {
      console.error('[ai-autopilot-chat] Erro ao verificar rate limit:', rateLimitError);
    }

    if (rateLimitAllowed === false) {
      console.warn('[ai-autopilot-chat] Rate limit excedido para conversa:', conversationId);
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again in a moment.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ============================================================
    // FASE 5: VERIFICAÇÃO DE DUPLICATA - ANTES do processamento da IA
    // ============================================================
    console.log('[ai-autopilot-chat] 🔍 Verificando duplicatas...');
    
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('content, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'user')
      .eq('is_ai_generated', true)
      .gte('created_at', new Date(Date.now() - 10000).toISOString()) // Últimos 10 segundos
      .order('created_at', { ascending: false })
      .limit(3);

    const isDuplicate = recentMessages?.some(msg => 
      msg.content.length > 50 && // Só verificar mensagens longas (evitar falsos positivos com "ok", "sim")
      (Date.now() - new Date(msg.created_at).getTime()) < 5000 // Menos de 5 segundos
    );

    if (isDuplicate) {
      console.warn('[ai-autopilot-chat] ⚠️ Mensagem duplicada detectada - ignorando processamento');
      return new Response(JSON.stringify({ 
        status: 'duplicate',
        message: 'Mensagem duplicada ignorada'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`[ai-autopilot-chat] Processando mensagem para conversa ${conversationId}...`);

    // 2. Buscar persona baseado em routing rules (canal + departamento)
    const { data: routingRules, error: rulesError } = await supabaseClient
      .from('ai_routing_rules')
      .select(`
        *,
        ai_personas!inner(id, name, role, system_prompt, temperature, max_tokens, knowledge_base_paths, is_active, use_priority_instructions, data_access)
      `)
      .eq('channel', responseChannel)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('[ai-autopilot-chat] Erro ao buscar routing rules:', rulesError);
    }

    // Filtrar regra que combina canal + departamento (se existir)
    let selectedRule = routingRules?.find(rule => rule.department === department);
    
    // Fallback: regra só com canal (department null)
    if (!selectedRule) {
      selectedRule = routingRules?.find(rule => rule.department === null);
    }

    if (!selectedRule || !selectedRule.ai_personas) {
      console.error('[ai-autopilot-chat] Nenhuma persona configurada para este canal/departamento');
      return new Response(JSON.stringify({ 
        error: 'Nenhuma persona configurada para este canal/departamento' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const persona = selectedRule.ai_personas as any;
    console.log(`[ai-autopilot-chat] Persona selecionada: ${persona.name} (${persona.id})`);
    console.log('[ai-autopilot-chat] 🔐 Data Access Config:', persona.data_access);
    
    // ✅ Verificar permissões de acesso a dados da persona
    const personaDataAccess = persona.data_access || {
      customer_data: true,
      knowledge_base: true,
      order_history: false,
      financial_data: false
    };
    
    const canAccessCustomerData = personaDataAccess.customer_data !== false;
    const canAccessKnowledgeBase = personaDataAccess.knowledge_base !== false;
    const canAccessFinancialData = personaDataAccess.financial_data === true;

    // 🎓 Buscar exemplos de treinamento (Few-Shot Learning)
    const { data: trainingExamples } = await supabaseClient
      .from('ai_training_examples')
      .select('*')
      .eq('persona_id', persona.id)
      .eq('is_active', true)
      .limit(10);

    console.log('[ai-autopilot-chat] Training examples found:', trainingExamples?.length || 0);

    // Formatar como few-shot messages
    const fewShotMessages = trainingExamples?.flatMap((example: any) => [
      { role: 'user', content: example.input_text },
      { role: 'assistant', content: example.ideal_output }
    ]) || [];

    // 3. Buscar tools vinculadas à persona
    const { data: personaTools, error: toolsError } = await supabaseClient
      .from('ai_persona_tools')
      .select(`
        ai_tools!inner(*)
      `)
      .eq('persona_id', persona.id);

    if (toolsError) {
      console.error('[ai-autopilot-chat] Erro ao buscar tools:', toolsError);
    }

    const enabledTools = personaTools
      ?.filter((pt: any) => pt.ai_tools?.is_enabled)
      .map((pt: any) => pt.ai_tools) || [];

    console.log(`[ai-autopilot-chat] ${enabledTools.length} tools disponíveis para esta persona`);

    // 4. Buscar histórico de mensagens
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(maxHistory);

    if (messagesError) {
      console.error('[ai-autopilot-chat] Erro ao buscar histórico:', messagesError);
    }

    const messageHistory = messages?.reverse().map(m => ({
      role: m.sender_type === 'contact' ? 'user' : 'assistant',
      content: m.content
    })) || [];

    // Obter API keys antecipadamente
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // Buscar modelo AI configurado dinamicamente
    const configuredAIModel = await getConfiguredAIModel(supabaseClient);
    console.log(`[ai-autopilot-chat] Using AI model: ${configuredAIModel}`);
    
    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error('Nenhuma API key configurada (OPENAI_API_KEY ou LOVABLE_API_KEY)');
    }
    
    // Helper: Fetch com timeout de 60 segundos
    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 60000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const response = await fetch(url, { 
          ...options, 
          signal: controller.signal 
        });
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Helper: Chamar IA com fallback resiliente OpenAI → Lovable AI
    const callAIWithFallback = async (payload: any) => {
      if (OPENAI_API_KEY) {
        try {
          const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model: 'gpt-4o-mini', ...payload }),
          }, 60000);
          
          if (response.ok) {
            return await response.json();
          }
          
          if (response.status === 429 || response.status === 401) {
            throw new Error('OpenAI unavailable');
          }
          
          throw new Error(`OpenAI error: ${response.status}`);
        } catch (error) {
          // Continue para fallback
        }
      }
      
      if (!LOVABLE_API_KEY) {
        throw new Error('Nenhuma API key configurada');
      }
      
      const fallbackResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: configuredAIModel, ...payload }),
      }, 60000);
      
      if (!fallbackResponse.ok) {
        if (fallbackResponse.status === 429) {
          throw new Error('QUOTA_ERROR: Erro de Saldo/Cota na IA.');
        }
        throw new Error(`Lovable AI failed: ${fallbackResponse.status}`);
      }
      
      return await fallbackResponse.json();
    }

    // FASE 1 & 2: Classificar intenção com lógica invertida (skip vs search)
    console.log('[ai-autopilot-chat] Classificando intenção da mensagem...');
    
    let intentType = 'search'; // Default: sempre buscar
    let knowledgeArticles: any[] = [];
    
    try {
      const intentData = await callAIWithFallback({
        messages: [
          { 
            role: 'system', 
            content: `Classifique a mensagem:
- "skip" APENAS se for: saudação pura (oi, olá, bom dia), confirmação pura (ok, entendi, beleza), ou elogio/agradecimento puro (obrigado, valeu)
- "search" para QUALQUER outra coisa (perguntas, dúvidas, problemas, informações, etc.)

Se tiver QUALQUER indício de pergunta ou dúvida, responda "search".
Responda APENAS: skip ou search`
          },
          { role: 'user', content: customerMessage }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      intentType = intentData.choices?.[0]?.message?.content?.trim().toLowerCase() || 'search';
      console.log(`[ai-autopilot-chat] Intenção detectada: ${intentType}`);
    } catch (error) {
      console.error('[ai-autopilot-chat] Erro na classificação de intenção:', error);
      // Fallback: buscar na base em caso de erro
      intentType = 'search';
    }
    
    // FASE 1 & 3: Lógica invertida - buscar para tudo, exceto "skip"
    if (intentType === 'skip') {
      // Saudações/confirmações puras: pular busca na base, responder naturalmente
      console.log('[ai-autopilot-chat] ⚡ Skip detectado - pulando busca na base');
    } else {
      // QUALQUER outra coisa: buscar na base de conhecimento
      console.log('[ai-autopilot-chat] 🔍 Search - consultando base de conhecimento...');
      
      // ✅ Verificar se persona tem permissão para acessar knowledge base
      if (!canAccessKnowledgeBase) {
        console.log('[ai-autopilot-chat] 🚫 Persona NÃO tem acesso à base de conhecimento - pulando busca');
        knowledgeArticles = [];
      } else {
        // FASE 1: Verificar se persona tem categorias específicas configuradas
        const personaCategories = persona.knowledge_base_paths || [];
        const hasPersonaCategories = personaCategories.length > 0;
      
      console.log('[ai-autopilot-chat] 📂 Persona categories:', {
        persona_id: persona.id,
        persona_name: persona.name,
        allowed_categories: hasPersonaCategories ? personaCategories : 'ALL (sem filtro)',
        category_filter_applied: hasPersonaCategories
      });
      
      try {
        // FASE 5: Query Expansion + Semantic Search Múltiplo
        if (OPENAI_API_KEY || LOVABLE_API_KEY) {
          console.log('[ai-autopilot-chat] 🚀 Iniciando Query Expansion...');
          
          // Step 1: Expandir query para múltiplas variações
          let expandedQueries: string[] = [customerMessage];
          
          try {
            const { data: expansionData, error: expansionError } = await supabaseClient.functions.invoke(
              'expand-query',
              { body: { query: customerMessage } }
            );

            if (!expansionError && expansionData?.expanded_queries) {
              // 🛡️ FASE A+B: Sanitizar queries expandidas - remover tokens sujos
              const rawQueries = expansionData.expanded_queries as string[];
              const sanitizedQueries = rawQueries
                .filter((q: string) => {
                  if (!q || typeof q !== 'string') return false;
                  const trimmed = q.trim();
                  // Remover tokens inválidos: code fences, brackets, strings muito curtas
                  if (trimmed.length < 5) return false;
                  if (/^[\[\]{}"`']+$/.test(trimmed)) return false;
                  if (trimmed.startsWith('```')) return false;
                  if (trimmed === 'json' || trimmed === 'JSON') return false;
                  return true;
                })
                .map((q: string) => q.trim())
                .slice(0, 5); // Limitar a 5 queries expandidas
              
              expandedQueries = [customerMessage, ...sanitizedQueries];
              console.log(`[ai-autopilot-chat] ✅ Query expandida em ${expandedQueries.length} variações (sanitizadas)`);
            } else {
              console.log('[ai-autopilot-chat] ⚠️ Usando apenas query original (expansion falhou)');
            }
          } catch (expansionError) {
            console.error('[ai-autopilot-chat] Erro no query expansion:', expansionError);
          }

          // Step 2: Buscar embeddings para todas as queries expandidas
          const articleMap: Map<string, any> = new Map();
          let embeddingAttempted = false;
          let embeddingSucceeded = false;
          
          // 🛡️ FASE A: Só tentar embeddings se OPENAI_API_KEY existir
          if (OPENAI_API_KEY) {
            embeddingAttempted = true;
            
            for (const query of expandedQueries) {
              try {
                console.log(`[ai-autopilot-chat] 🔍 Gerando embedding para: "${query.substring(0, 50)}..."`);
                
                const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: query,
                  }),
                });

                if (embeddingResponse.ok) {
                  embeddingSucceeded = true;
                  const embeddingData = await embeddingResponse.json();
                  const queryEmbedding = embeddingData.data[0].embedding;
                  
                  // Buscar artigos similares
                  const { data: semanticResults, error: semanticError } = await supabaseClient.rpc(
                    'match_knowledge_articles',
                    {
                      query_embedding: queryEmbedding,
                      match_threshold: 0.50,
                      match_count: 5,
                    }
                  );

                  if (!semanticError && semanticResults) {
                    // Adicionar ao mapa para deduplicar (mantém melhor similaridade)
                    semanticResults.forEach((article: any) => {
                      const existing = articleMap.get(article.id);
                      if (!existing || article.similarity > existing.similarity) {
                        articleMap.set(article.id, article);
                      }
                    });
                  }
                } else {
                  console.warn(`[ai-autopilot-chat] ⚠️ Embedding falhou com status: ${embeddingResponse.status}`);
                }
              } catch (error) {
                console.error(`[ai-autopilot-chat] ❌ Erro no embedding para query: "${query}"`, error);
              }
            }
          } else {
            console.log('[ai-autopilot-chat] ⚠️ OPENAI_API_KEY não configurada - pulando embeddings');
          }

          // Step 3: Converter mapa para array e aplicar filtros
          let allArticles = Array.from(articleMap.values());
          console.log(`[ai-autopilot-chat] 📊 Total de artigos únicos encontrados: ${allArticles.length}`);
          
          // 🛡️ FASE A: FALLBACK ROBUSTO - Executar busca por palavras-chave se:
          // 1. Embeddings não foram tentados (sem OPENAI_API_KEY)
          // 2. Embeddings falharam completamente
          // 3. Embeddings retornaram 0 resultados
          const needsKeywordFallback = !embeddingAttempted || !embeddingSucceeded || allArticles.length === 0;
          
          if (needsKeywordFallback) {
            console.log('[ai-autopilot-chat] 🔄 FALLBACK ATIVO: Buscando por palavras-chave...', {
              reason: !embeddingAttempted ? 'no_openai_key' : !embeddingSucceeded ? 'embedding_failed' : 'no_results',
              original_query: customerMessage.substring(0, 50)
            });
            
            // Extrair palavras-chave relevantes (remover stopwords comuns)
            const stopwords = ['a', 'o', 'e', 'é', 'de', 'da', 'do', 'que', 'para', 'com', 'em', 'um', 'uma', 'os', 'as', 'no', 'na', 'por', 'mais', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'vocês', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas', 'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'aquilo', 'estou', 'está', 'estamos', 'estão', 'estive', 'esteve', 'estivemos', 'estiveram', 'estava', 'estávamos', 'estavam', 'estivera', 'estivéramos', 'esteja', 'estejamos', 'estejam', 'estivesse', 'estivéssemos', 'estivessem', 'estiver', 'estivermos', 'estiverem', 'hei', 'há', 'havemos', 'hão', 'houve', 'houvemos', 'houveram', 'houvera', 'houvéramos', 'haja', 'hajamos', 'hajam', 'houvesse', 'houvéssemos', 'houvessem', 'houver', 'houvermos', 'houverem', 'houverei', 'houverá', 'houveremos', 'houverão', 'houveria', 'houveríamos', 'houveriam', 'sou', 'somos', 'são', 'era', 'éramos', 'eram', 'fui', 'foi', 'fomos', 'foram', 'fora', 'fôramos', 'seja', 'sejamos', 'sejam', 'fosse', 'fôssemos', 'fossem', 'for', 'formos', 'forem', 'serei', 'será', 'seremos', 'serão', 'seria', 'seríamos', 'seriam', 'tenho', 'tem', 'temos', 'tém', 'tinha', 'tínhamos', 'tinham', 'tive', 'teve', 'tivemos', 'tiveram', 'tivera', 'tivéramos', 'tenha', 'tenhamos', 'tenham', 'tivesse', 'tivéssemos', 'tivessem', 'tiver', 'tivermos', 'tiverem', 'terei', 'terá', 'teremos', 'terão', 'teria', 'teríamos', 'teriam', 'quero', 'preciso', 'gostaria', 'oi', 'olá', 'bom', 'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'ok', 'sim', 'não'];
            
            const keywords = customerMessage
              .toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .split(/\s+/)
              .filter(word => word.length > 2 && !stopwords.includes(word));
            
            // Termos específicos para busca direta (alta prioridade)
            const directTerms = ['shopeecreation', 'shopee', 'creation', 'loja', 'produtos', 'cadastro', 'nivelamento', 'formulario'];
            const messageLower = customerMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const matchedDirectTerms = directTerms.filter(term => messageLower.includes(term));
            
            console.log('[ai-autopilot-chat] 🔑 Keywords extraídas:', keywords.slice(0, 10));
            console.log('[ai-autopilot-chat] 🎯 Termos diretos encontrados:', matchedDirectTerms);
            
            // Buscar por título ou conteúdo contendo as palavras-chave
            if (keywords.length > 0 || matchedDirectTerms.length > 0) {
              const searchTerms = [...new Set([...matchedDirectTerms, ...keywords])].slice(0, 8);
              
              for (const term of searchTerms) {
                let query = supabaseClient
                  .from('knowledge_articles')
                  .select('id, title, content, category, updated_at')
                  .eq('status', 'published')
                  .or(`title.ilike.%${term}%,content.ilike.%${term}%`);
                
                if (hasPersonaCategories) {
                  query = query.in('category', personaCategories);
                }
                
                const { data: keywordResults } = await query.limit(3);
                
                if (keywordResults && keywordResults.length > 0) {
                  keywordResults.forEach((article: any) => {
                    // Calcular uma similaridade aproximada baseada em quantos termos casam
                    const titleLower = article.title?.toLowerCase() || '';
                    const contentLower = article.content?.toLowerCase() || '';
                    const matchCount = searchTerms.filter(t => 
                      titleLower.includes(t) || contentLower.includes(t)
                    ).length;
                    
                    const approxSimilarity = Math.min(0.5 + (matchCount * 0.1), 0.85);
                    
                    const existing = articleMap.get(article.id);
                    if (!existing || approxSimilarity > (existing.similarity || 0)) {
                      articleMap.set(article.id, { ...article, similarity: approxSimilarity });
                    }
                  });
                }
              }
              
              // Atualizar allArticles com resultados do fallback
              allArticles = Array.from(articleMap.values());
              console.log(`[ai-autopilot-chat] 📊 Artigos após fallback: ${allArticles.length}`);
            }
          }

          // Filtrar por categoria se persona tiver configurado
          if (hasPersonaCategories) {
            allArticles = allArticles.filter((a: any) => 
              personaCategories.includes(a.category)
            );
            console.log(`[ai-autopilot-chat] 🔒 Filtro de categoria: ${articleMap.size} → ${allArticles.length} artigos`);
          }

          if (allArticles.length > 0) {
            // Ordenar por similaridade e pegar top 5
            knowledgeArticles = allArticles
              .sort((a: any, b: any) => b.similarity - a.similarity)
              .slice(0, 5)
          .map((a: any) => ({
            id: a.id,
            title: a.title,
            content: a.content,
            category: a.category,
            similarity: a.similarity, // 🆕 Preservar score de similaridade
          }));
            
            console.log(`[ai-autopilot-chat] ✅ Query Expansion + Semantic: ${knowledgeArticles.length} artigos finais:`, 
              allArticles.slice(0, 5).map((a: any) => `${a.title} [${a.category}] (${(a.similarity * 100).toFixed(1)}%)`));
          } else {
            console.log('[ai-autopilot-chat] ⚠️ Nenhum artigo relevante após filtros');
          }
        }
      } catch (searchError) {
        console.error('[ai-autopilot-chat] ❌ Erro geral na busca de conhecimento:', searchError);
        // knowledgeArticles permanece vazio, mas não quebra o fluxo
      }
      } // Fechamento do else de canAccessKnowledgeBase
    }

    // 5. FASE 1: Identity Wall - Verificar se contato tem email
    const contactEmail = customer_context?.email || contact.email;
    const contactHasEmail = !!contactEmail;
    const contactName = customer_context?.name || `${contact.first_name} ${contact.last_name}`.trim();
    const contactCompany = contact.company ? ` da empresa ${contact.company}` : '';
    const contactStatus = contact.status || 'lead';
    
    // 🔐 LGPD: Dados mascarados para exposição à IA
    const safeEmail = maskEmail(contactEmail);
    const safePhone = maskPhone(contact.phone);
    
    console.log('[ai-autopilot-chat] 🔐 Identity Wall Check:', {
      hasEmail: contactHasEmail,
      email: safeEmail,
      channel: responseChannel,
      isKnownCustomer: contactHasEmail
    });
    
    let knowledgeContext = '';
    if (knowledgeArticles.length > 0) {
      knowledgeContext = `\n\n**📚 BASE DE CONHECIMENTO:**\n${knowledgeArticles.map(a => 
        `**${a.title}**\n${a.content}`
      ).join('\n\n---\n\n')}`;
    }
    
    // FASE 2: Preparar contexto financeiro (CPF mascarado)
    const contactCPF = contact.document || ''; // CPF completo
    const maskedCPF = contactCPF.length >= 4 ? `***.***.***-${contactCPF.slice(-2)}` : 'Não cadastrado';
    const cpfLast4 = contactCPF.length >= 4 ? contactCPF.slice(-4) : '';
    
    // 🔐 DEBUG: Log CPF data
    console.log('[ai-autopilot-chat] 🔐 CPF DEBUG:', {
      has_document: !!contact.document,
      document_length: contact.document?.length,
      maskedCPF: maskedCPF,
      cpfLast4: cpfLast4,
      contact_status: contact.status
    });
    
    // ============================================================
    // 🔒 DEFINIÇÕES UNIFICADAS DE CLIENTE (evita inconsistências)
    // ============================================================
    // ✅ CORREÇÃO: Cliente verificado = tem email cadastrado (independente de status)
    // Status é atualizado automaticamente pelo webhook Kiwify quando há compra
    const isContactVerified = !!contact.email;
    const hasCompleteCadastro = !!contactCPF; // CPF cadastrado
    const canAccessFinancialFeatures = isContactVerified && hasCompleteCadastro;
    
    console.log('[ai-autopilot-chat] 🔍 CUSTOMER STATUS:', {
      contact_id: contact.id,
      contact_name: contactName,
      has_email: !!contact.email,
      contact_status: contact.status,
      has_cpf: hasCompleteCadastro,
      is_contact_verified: isContactVerified,
      can_access_financial_features: canAccessFinancialFeatures,
      channel: responseChannel
    });
    
    // ✅ CORREÇÃO: Cliente real = tem email + tem CPF (independente de status)
    const isRealCustomer = !!contact.email && hasCompleteCadastro;
    const canRequestWithdrawal = canAccessFinancialFeatures;
    const withdrawalBlockReason = !hasCompleteCadastro 
      ? 'CPF não cadastrado - não é cliente verificado'
      : !contact.email
        ? 'Email não cadastrado - precisa se identificar primeiro'
        : null;
    
    // 🚨 PORTEIRO FINANCEIRO - Exige OTP SEMPRE para transações financeiras
    const isFinancialRequest = FINANCIAL_BARRIER_KEYWORDS.some(keyword =>
      customerMessage.toLowerCase().includes(keyword)
    );

    // Verificar se tem verificação OTP recente (1 HORA para operações financeiras)
    const { data: recentVerification } = await supabaseClient
      .from('email_verifications')
      .select('*')
      .eq('email', contactEmail)
      .eq('verified', true)
      .gte('created_at', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()) // 1h ao invés de 24h
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const hasRecentOTPVerification = !!recentVerification;
    
    // 🆕 FASE: Verificar se cliente JÁ FEZ OTP ALGUMA VEZ (primeiro contato)
    // Se nunca verificou = primeiro contato, precisa OTP para identificar
    let hasEverVerifiedOTP = false;
    if (contactEmail) {
      const { data: anyVerification } = await supabaseClient
        .from('email_verifications')
        .select('id')
        .eq('email', contactEmail)
        .eq('verified', true)
        .limit(1);
      
      hasEverVerifiedOTP = !!(anyVerification && anyVerification.length > 0);
    }

    console.log('[ai-autopilot-chat] 🔍 FIRST CONTACT CHECK:', {
      contact_email: contactEmail,
      has_ever_verified_otp: hasEverVerifiedOTP,
      is_first_contact: !hasEverVerifiedOTP && contactHasEmail
    });
    
    console.log('[ai-autopilot-chat] 🔍 FINANCIAL SECURITY CHECK:', {
      is_financial_request: isFinancialRequest,
      has_recent_otp: hasRecentOTPVerification,
      otp_verified_at: recentVerification?.created_at || null,
      can_show_financial_data: hasRecentOTPVerification && isRealCustomer
    });

    // BARREIRA FINANCEIRA: Pedido financeiro SEM verificação OTP recente
    const financialBarrierActive = isFinancialRequest && !hasRecentOTPVerification;

    // Flag para mostrar dados sensíveis (só após OTP verificado + permissão da persona)
    const canShowFinancialData = hasRecentOTPVerification && isRealCustomer && canAccessFinancialData;
    
    // FASE 3 & 4: Identity Wall + Diferenciação Cliente vs Lead
    let identityWallNote = '';
    
    // Detectar se é a primeira mensagem pós-verificação (FASE 3)
    const isRecentlyVerified = customer_context?.isVerified === true;
    
    // Detectar se é contexto financeiro na mensagem atual
    const isFinancialContext = FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
    
    // 🎯 BYPASS DA IA: Saudação Direta APENAS na PRIMEIRA MENSAGEM da conversa
    const isFirstMessage = messageHistory.length <= 1;
    
    if (intentType === 'skip' && !isFinancialContext && isFirstMessage) {
      // CASO 1: Cliente conhecido = saudação personalizada direta
      if (contactHasEmail) {
        console.log('[ai-autopilot-chat] 🎯 BYPASS DA IA - Saudação direta para cliente conhecido');
        
        const directGreeting = `Olá ${contactName}! Bem-vindo(a) de volta! Como posso te ajudar hoje?`;
        
        // Salvar mensagem da IA
        const { data: savedMsg } = await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: directGreeting,
            sender_type: 'user',
            is_ai_generated: true,
            channel: responseChannel
          })
          .select()
          .single();
        
        // Enviar via WhatsApp se necessário
        if (responseChannel === 'whatsapp') {
          const whatsappInstance = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id
          );
          
          if (whatsappInstance) {
            await supabaseClient.functions.invoke('send-whatsapp-message', {
              body: {
                instance_id: whatsappInstance.id,
                phone_number: contact.phone,
                whatsapp_id: contact.whatsapp_id,
                message: directGreeting
              }
            });
          }
        }
        
        return new Response(JSON.stringify({
          response: directGreeting,
          messageId: savedMsg?.id,
          directGreeting: true,
          debug: { 
            reason: 'known_customer_greeting_bypass',
            customer_name: contactName,
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // CASO 2: Lead novo sem email = pedir email direto
      if (!contactHasEmail && responseChannel === 'whatsapp') {
        console.log('[ai-autopilot-chat] 🎯 BYPASS DA IA - Pedindo email para lead novo');
        
        const leadGreeting = `Olá${contactName ? ' ' + contactName : ''}! Para garantir um atendimento personalizado e seguro, preciso que você me informe seu email.`;
        
        // Salvar mensagem da IA
        const { data: savedMsg } = await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: leadGreeting,
            sender_type: 'user',
            is_ai_generated: true,
            channel: responseChannel
          })
          .select()
          .single();
        
        // Enviar via WhatsApp
        const whatsappInstance = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id
        );
        
        if (whatsappInstance) {
          await supabaseClient.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: whatsappInstance.id,
              phone_number: contact.phone,
              whatsapp_id: contact.whatsapp_id,
              message: leadGreeting
            }
          });
        }
        
        return new Response(JSON.stringify({
          response: leadGreeting,
          messageId: savedMsg?.id,
          directGreeting: true,
          needsEmail: true,
          debug: { 
            reason: 'new_lead_email_request_bypass',
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // FASE 1: Criar instrução prioritária que vai NO INÍCIO do prompt (se habilitado)
    let priorityInstruction = '';
    
    // ✅ CONTROLE: Só usar priorityInstruction se persona tiver use_priority_instructions=true
    const usePriorityInstructions = persona.use_priority_instructions === true;
    
    // ============================================================
    // 🔐 DETECÇÃO AUTOMÁTICA DE CÓDIGO OTP (6 dígitos)
    // ============================================================
    const isOTPCode = /^\d{6}$/.test(customerMessage.trim());
    
    if (isOTPCode && contactHasEmail) {
      console.log('[ai-autopilot-chat] 🔐 DECISION POINT: AUTO_OTP_VALIDATION', {
        detected_otp_code: true,
        contact_has_email: contactHasEmail,
        will_bypass_ai: true
      });
      
      try {
        const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('verify-code', {
          body: { 
            email: contactEmail,
            code: customerMessage.trim()
          }
        });
        
        if (otpError) throw otpError;
        
        const directOTPSuccessResponse = otpData?.success 
          ? `**Código validado com sucesso!**

Olá ${contactName}! Sua identidade foi confirmada. 

Agora posso te ajudar com questões financeiras. Como posso te ajudar?`
          : `**Código inválido ou expirado**

${otpData?.message || 'O código não é válido. Verifique e tente novamente.'}

Digite **"reenviar"** se precisar de um novo código.`;
        
        // Salvar mensagem no banco
        const { data: savedMsg } = await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: directOTPSuccessResponse,
            sender_type: 'user',
            is_ai_generated: true,
            channel: responseChannel
          })
          .select()
          .single();
        
        // Enviar via WhatsApp se necessário
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappInstance = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id
          );
          
          if (whatsappInstance) {
            await supabaseClient.functions.invoke('send-whatsapp-message', {
              body: {
                instance_id: whatsappInstance.id,
                phone_number: contact.phone,
                whatsapp_id: contact.whatsapp_id,
                message: directOTPSuccessResponse
              }
            });
          }
        }
        
        console.log('[ai-autopilot-chat] ✅ OTP AUTO-VALIDATION COMPLETE:', {
          otp_success: otpData?.success,
          response_sent: true
        });
        
        // ⚡ RETURN EARLY - OTP validado, não chamar IA
        return new Response(JSON.stringify({
          response: directOTPSuccessResponse,
          messageId: savedMsg?.id,
          otpValidated: otpData?.success || false,
          debug: { 
            reason: 'auto_otp_validation_bypass',
            otp_success: otpData?.success,
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('[ai-autopilot-chat] ❌ Erro ao validar OTP automaticamente:', error);
        // Se falhar, continua para IA tentar lidar
      }
    }
    
    // ============================================================
    // 🚨 IDENTITY WALL - OTP AUTOMÁTICO 
    // Regras:
    // 1. PRIMEIRO CONTATO (tem email, nunca verificou) → OTP para identificar
    // 2. CONTEXTO FINANCEIRO (já identificado, sem OTP recente) → OTP para segurança
    // 3. CLIENTE IDENTIFICADO (já verificou alguma vez) → Atendimento normal
    // ============================================================
    // Funciona para TODOS os canais (não só WhatsApp)
    if (contactHasEmail) {
      const maskedEmail = maskEmail(contactEmail);
      
      // Debug log comparando isFinancialRequest vs isFinancialContext
      console.log('[ai-autopilot-chat] 🔐 IDENTITY WALL DEBUG:', {
        is_financial_request: isFinancialRequest,
        is_financial_context: isFinancialContext,
        has_ever_verified_otp: hasEverVerifiedOTP,
        has_recent_otp: hasRecentOTPVerification,
        is_first_contact: !hasEverVerifiedOTP,
        message: customerMessage.substring(0, 50)
      });
      
      // CASO 1: PRIMEIRO CONTATO - Tem email mas NUNCA verificou OTP
      if (!hasEverVerifiedOTP) {
        console.log('[ai-autopilot-chat] 🔐 DECISION POINT: FIRST_CONTACT_OTP', {
          is_first_contact: true,
          has_ever_verified: false,
          will_send_otp: true,
          current_channel: responseChannel
        });
        
        try {
          // Enviar OTP automaticamente para identificação
          await supabaseClient.functions.invoke('send-verification-code', {
            body: { email: contactEmail, type: 'customer' }
          });
          
          // BYPASS DIRETO - NÃO CHAMAR A IA
          const directOTPResponse = `Olá ${contactName}! Bem-vindo(a)!

Para garantir um atendimento personalizado e seguro, preciso confirmar sua identidade.

Enviei um código de **6 dígitos** para **${maskedEmail}**.

Por favor, **digite o código** que você recebeu para continuar.`;

          // Salvar mensagem no banco
          const { data: savedMsg } = await supabaseClient
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: directOTPResponse,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            })
            .select()
            .single();
          
          // Enviar via WhatsApp se necessário
          if (responseChannel === 'whatsapp' && contact?.phone) {
            const whatsappInstance = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id
            );
            
            if (whatsappInstance) {
              await supabaseClient.functions.invoke('send-whatsapp-message', {
                body: {
                  instance_id: whatsappInstance.id,
                  phone_number: contact.phone,
                  whatsapp_id: contact.whatsapp_id,
                  message: directOTPResponse
                }
              });
            }
          }
          
          // ⚡ RETURN EARLY - NÃO CONTINUAR PARA A IA
          return new Response(JSON.stringify({
            response: directOTPResponse,
            messageId: savedMsg?.id,
            awaitingOTP: true,
            isFirstContact: true,
            debug: { 
              reason: 'first_contact_identification_otp',
              email_sent_to: maskedEmail,
              bypassed_ai: true,
              contact_name: contactName,
              channel: responseChannel
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('[ai-autopilot-chat] ❌ Erro ao disparar OTP primeiro contato:', error);
          // Se falhar, continua para IA tentar lidar
        }
      }
      
      // CASO 2: CONTEXTO FINANCEIRO - Cliente já identificado, precisa OTP recente
      else if (isFinancialRequest && !hasRecentOTPVerification) {
        console.log('[ai-autopilot-chat] 🔐 DECISION POINT: FINANCIAL_OTP_BARRIER', {
          is_financial_context: true,
          has_ever_verified: true,
          has_recent_otp: false,
          will_send_otp: true,
          current_channel: responseChannel
        });
        
        try {
          // Enviar OTP automaticamente
          await supabaseClient.functions.invoke('send-verification-code', {
            body: { email: contactEmail, type: 'customer' }
          });
          
          // BYPASS DIRETO - NÃO CHAMAR A IA
          const directOTPResponse = `**Verificação de Segurança**

Olá ${contactName}! Você é nosso cliente, mas questões financeiras são delicadas.

Para sua segurança, vou confirmar que é você mesmo.

Enviei um código de **6 dígitos** para **${maskedEmail}**.

Por favor, **digite o código** que você recebeu para continuar.`;

          // Salvar mensagem no banco
          const { data: savedMsg } = await supabaseClient
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: directOTPResponse,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            })
            .select()
            .single();
          
          // Enviar via WhatsApp se necessário
          if (responseChannel === 'whatsapp' && contact?.phone) {
            const whatsappInstance = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id
            );
            
            if (whatsappInstance) {
              await supabaseClient.functions.invoke('send-whatsapp-message', {
                body: {
                  instance_id: whatsappInstance.id,
                  phone_number: contact.phone,
                  whatsapp_id: contact.whatsapp_id,
                  message: directOTPResponse
                }
              });
            }
          }
          
          // ⚡ RETURN EARLY - NÃO CONTINUAR PARA A IA
          return new Response(JSON.stringify({
            response: directOTPResponse,
            messageId: savedMsg?.id,
            awaitingOTP: true,
            debug: { 
              reason: 'financial_barrier_auto_otp_all_channels',
              email_sent_to: maskedEmail,
              bypassed_ai: true,
              contact_name: contactName,
              channel: responseChannel,
              is_contact_verified: isContactVerified,
              can_access_financial: canAccessFinancialFeatures
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('[ai-autopilot-chat] ❌ Erro ao disparar OTP financeiro:', error);
          // Se falhar, continua para IA tentar lidar
        }
      }
      
      // CASO 3: CLIENTE IDENTIFICADO - Já verificou alguma vez, contexto normal
      else if (hasEverVerifiedOTP && !isFinancialRequest) {
        console.log('[ai-autopilot-chat] ✅ Cliente identificado - Atendimento normal sem OTP');
        
        priorityInstruction = `=== INSTRUÇÃO PRIORITÁRIA - IGNORE TUDO ABAIXO ATÉ SEGUIR ISSO ===

A PRIMEIRA coisa que você DEVE falar é uma saudação calorosa com o nome do cliente:
"Olá ${contactName}! Bem-vindo(a) de volta! Como posso te ajudar hoje?"

→ Você DEVE reconhecer que este é um cliente conhecido
→ NÃO peça email ou verificação
=== FIM DA INSTRUÇÃO PRIORITÁRIA ===

`;
        
        identityWallNote = `\n\n**CLIENTE IDENTIFICADO:**
Cliente: ${contactName}${contactCompany}
Email: ${contactEmail}
Status: ${contactStatus}

→ Seja caloroso e amigável
→ Mostre que reconhecemos o cliente
→ NÃO peça verificação (já foi identificado anteriormente)`;
      }
      
    } else if (!contactHasEmail && responseChannel === 'whatsapp') {
      // FASE 4: Lead (não tem email) - seguir Identity Wall e direcionar para comercial após verificação
      priorityInstruction = `=== INSTRUÇÃO PRIORITÁRIA - IGNORE TUDO ABAIXO ATÉ SEGUIR ISSO ===

Este contato NÃO tem email cadastrado. A PRIMEIRA coisa que você DEVE falar é:
"Olá! Para garantir um atendimento personalizado e seguro, preciso que você me informe seu email."

→ PARE AQUI. AGUARDE o cliente fornecer o email.
→ NÃO responda dúvidas técnicas até ter o email
=== FIM DA INSTRUÇÃO PRIORITÁRIA ===

`;
      
      identityWallNote = `\n\n**LEAD NOVO - Identity Wall OBRIGATÓRIO:**
Este cliente NÃO tem email cadastrado no sistema (é um LEAD, não um cliente existente).

**FLUXO OBRIGATÓRIO DE IDENTIFICAÇÃO:**
1. PRIMEIRA MENSAGEM: Cumprimente "${contactName}" e solicite o email de forma educada e direta:
   "Olá ${contactName}! Para garantir um atendimento personalizado e seguro, preciso que você me informe seu email."
   
2. AGUARDE o cliente fornecer o email

3. QUANDO cliente fornecer email: Use a ferramenta update_customer_email para registrar e enviar código de verificação

4. APÓS enviar código: Informe ao cliente:
   "Perfeito! Enviamos um código de 6 dígitos para [email]. Por favor, digite o código que você recebeu."

5. AGUARDE o cliente enviar o código de 6 dígitos

6. QUANDO cliente enviar código: Use a ferramenta verify_otp_code para validar

7. APÓS verificação bem-sucedida: Informe que ele será direcionado para o time comercial:
   "Identidade verificada! Vou te conectar com nosso time de vendas para te ajudar da melhor forma. Um consultor vai entrar em contato em breve!"
   E então faça handoff para copilot e chame route-conversation.

**IMPORTANTE:** NÃO atenda dúvidas técnicas, NÃO crie tickets, NÃO responda perguntas até o email estar verificado.
Se o cliente insistir em pular a verificação, explique que é uma política de segurança obrigatória.`;
    }
    
    // PORTEIRO FINANCEIRO ATIVADO
    if (financialBarrierActive) {
      if (contactHasEmail) {
        // Cenário: Tem email mas não tem OTP recente → Pedir verificação
        identityWallNote += `\n\n**=== PORTEIRO FINANCEIRO - VERIFICAÇÃO OBRIGATÓRIA ===**
O cliente pediu uma operação FINANCEIRA (${customerMessage}).
Ele TEM email cadastrado (${safeEmail}), MAS precisa verificar identidade via OTP.

**RESPOSTA OBRIGATÓRIA:**
"Para sua segurança, preciso confirmar sua identidade antes de prosseguir com operações financeiras. 
Vou enviar um código de verificação para ${safeEmail}. Aguarde..."

→ Use a tool update_customer_email para disparar o OTP (sistema já conhece o email)
→ NÃO mostre CPF, Nome, Saldo ou qualquer dado sensível
→ NÃO permita criar ticket de saque
→ AGUARDE o cliente digitar o código de 6 dígitos`;
      } else {
        // Cenário: Não tem email → Pedir email primeiro
        identityWallNote += `\n\n**=== PORTEIRO FINANCEIRO - IDENTIFICAÇÃO OBRIGATÓRIA ===**
O cliente fez uma solicitação FINANCEIRA MAS NÃO ESTÁ IDENTIFICADO.

**RESPOSTA OBRIGATÓRIA:**
"Para sua segurança, preciso validar seu cadastro antes de falar sobre valores. 
Qual é o seu **email de compra**?"

→ AGUARDE o cliente informar o email
→ NÃO fale de valores, prazos ou processos
→ NÃO crie ticket
→ PARE AQUI até identificação completa`;
      }
    }
    
    if (!identityWallNote) {
      identityWallNote = `\n\n**IMPORTANTE:** Este é um cliente já verificado. Cumprimente-o pelo nome (${contactName}) de forma calorosa. NÃO peça email ou validação.

${isRecentlyVerified ? '**⚠️ CLIENTE RECÉM-VERIFICADO:** Esta é a primeira mensagem pós-verificação. Não fazer handoff automático. Seja acolhedor e pergunte "Como posso te ajudar?".' : ''}`;
    }
    
    // 🐛 DEBUG: Confirmar que priorityInstruction está sendo gerada
    console.log('[ai-autopilot-chat] 📣 Priority Instruction:', priorityInstruction ? 'SET ✅' : 'EMPTY ❌');
    
    const contextualizedSystemPrompt = `${priorityInstruction}

**DIRETRIZ DE SEGURANÇA E PRIVACIDADE (LGPD - IMPORTANTE):**
- NUNCA escreva o e-mail completo, telefone ou CPF do cliente na resposta
- Se precisar confirmar a conta, use APENAS o formato mascarado fornecido (ex: ro***@gmail.com)
- Proteja os dados do cliente como se fossem seus
- O nome do cliente (${contactName}) é seguro para usar

**REGRAS DE PROTEÇÃO DE DADOS - CRÍTICO:**
1. NUNCA mostre emails completos - sempre use formato mascarado (ex: ko***@gm***.com)
2. NUNCA mostre CPF completo, telefone completo ou documentos completos
3. Se cliente disser "não recebi email", "não chegou código", ou "reenviar":
   - ❌ NÃO use verify_customer_email (essa ferramenta é só para email NOVO)
   - ✅ USE resend_otp para reenviar ao email JÁ cadastrado
   - Responda: "Vou reenviar o código para seu email cadastrado. Aguarde..."
4. A ferramenta verify_customer_email só deve ser usada quando cliente FORNECER um email novo pela primeira vez

---

Você é a Lais, assistente virtual inteligente da Parabellum / 3Cliques.
Sua missão é AJUDAR o cliente, não se livrar dele.

**COMO RESPONDER:**

1. **Saudações e Small Talk (Oi, Bom dia, Obrigado):**
   - Responda de forma calorosa e natural
   - NÃO busque na base de conhecimento
   - NÃO crie ticket
   - Exemplo: "Olá! Bom dia! Como posso te ajudar hoje?"

2. **Dúvidas e Perguntas (Como funciona...? O que é...?):**
   - Use seu conhecimento geral e a base de conhecimento fornecida
   - Se não tiver certeza, faça perguntas para esclarecer
   - NÃO crie ticket para dúvidas - tente responder primeiro

3. **Criação de Ticket - USE SOMENTE QUANDO:**
   - O cliente PEDIR EXPLICITAMENTE: "Quero falar com humano", "Abre um chamado"
   - For problema financeiro CONCRETO com intenção de ação: "Quero sacar", "Cadê meu dinheiro?", "Preciso de reembolso"
   - Você REALMENTE não souber responder APÓS tentar ajudar

4. **PROIBIDO:**
   - Criar ticket para perguntas informativas ("Como funciona o pagamento?")
   - Dizer "Não consegui processar" de cara - TENTE ajudar primeiro
   - Transferir para humano sem motivo real

---

**CÉREBRO FINANCEIRO - FLUXOGRAMA OBRIGATÓRIO:**

QUANDO cliente mencionar "reembolso", "cancelamento", "saque", "devolver dinheiro":

**PASSO 1: IDENTIFICAR O TIPO DE PEDIDO**
Pergunte ao cliente de forma clara e direta:
"Entendi que você quer resolver uma questão financeira. Para te ajudar corretamente, preciso saber:

Você quer:
**A)** Cancelar sua assinatura/curso (comprado na Kiwify)?
**B)** Sacar o saldo da sua carteira (Seu Armazém Drop)?"

→ AGUARDE a resposta do cliente antes de prosseguir

---

**CENÁRIO A: CANCELAMENTO KIWIFY (Assinatura/Curso)**

1. **RETENÇÃO BREVE** (opcional):
   "Posso saber o motivo? Talvez eu consiga te ajudar antes de você cancelar."

2. **SE CLIENTE INSISTIR EM CANCELAR:**
   - ❌ NÃO CRIE TICKET
   - Informe que o cancelamento é feito direto na plataforma:
   
   "Entendi! O cancelamento de cursos/assinaturas é feito diretamente pela plataforma Kiwify.
   
   📌 Você tem **7 dias de garantia** a partir da compra para solicitar reembolso.
   
   🔗 **Acesse aqui para cancelar:** https://reembolso.kiwify.com.br/login
   
   Use o mesmo email da compra para fazer login e solicitar o reembolso.
   
   Posso ajudar em mais alguma coisa?"

3. **ENCERRE O ASSUNTO** - Não crie ticket, não transfira para humano

---

**CENÁRIO B: SAQUE DE SALDO (Carteira Interna - Seu Armazém Drop)**

${canShowFinancialData 
  ? `Cliente VERIFICADO via OTP - Pode prosseguir com saque
     CPF cadastrado: ${maskedCPF}
     
     ATENÇÃO: Use EXATAMENTE o CPF fornecido acima: "${maskedCPF}"
     NUNCA escreva "Não cadastrado" se o CPF foi fornecido.`
  : !canAccessFinancialData
    ? `BLOQUEIO: Esta IA NÃO tem permissão para acessar dados financeiros.
       → Transfira para um agente humano imediatamente com: request_human_agent
       → Motivo: "Solicitação de dados financeiros requer assistência humana"`
    : `BLOQUEIO: Cliente NÃO verificou identidade via OTP nesta sessão.
       → NÃO mostre CPF ou Nome completo
       → NÃO permita criar ticket de saque
       → Informe: "Para sua segurança, preciso verificar sua identidade primeiro. Qual seu email de compra?"`}

**SE CLIENTE VERIFICADO via OTP, seguir passos:**

    1. **CONFIRMAÇÃO OBRIGATÓRIA DE DADOS:**
   Apresente os dados do cliente e peça confirmação:
   
   "Vou confirmar seus dados para o saque:
   
   **Nome:** ${canAccessCustomerData ? contactName : '[Dados Protegidos]'}
   **CPF:** ${maskedCPF}
   
   **Regra de Segurança:** O saque só pode ser feito via PIX para uma chave vinculada a este CPF cadastrado. Não é possível enviar para conta de terceiros.
   
   Os dados estão corretos?"

2. **SE CLIENTE CONFIRMAR (SIM):**
   - Pergunte sobre a chave PIX de forma inteligente (sem pedir dados já confirmados):
   
   "Perfeito! Posso fazer o PIX diretamente para seu CPF (${maskedCPF}) como chave?
   
   Ou, se preferir, envie outra chave PIX (email, telefone ou chave aleatória) - lembrando que precisa estar vinculada a este mesmo CPF.
   
   Qual opção prefere?"

   - SE cliente aceitar usar o CPF como chave (ex: "sim", "pode usar CPF", "usa o CPF", "pode ser"):
     - Chave PIX = CPF do cliente (use o CPF completo do cadastro, não o mascarado)
     - Tipo = "cpf"
     - Pergunte APENAS: "Certo! Qual valor você deseja sacar?"
   
   - SE cliente enviar outra chave (email, telefone, chave aleatória):
     - Identifique o tipo automaticamente
     - Confirme: "Vou usar a chave [CHAVE]. Qual valor você deseja sacar?"
   
   - APÓS receber o VALOR, execute create_ticket com:
     - issue_type: "saque"
     - subject: "Solicitação de Saque - R$ [VALOR]"
     - description: "Cliente ${contactName} solicita saque de R$ [VALOR]. Tipo PIX: [TIPO]. Chave PIX: [CHAVE]. CPF: ${maskedCPF}"
     - pix_key: [CHAVE - seja CPF ou outra informada]
     - pix_key_type: [TIPO - cpf/email/telefone/chave_aleatoria]
     - withdrawal_amount: [VALOR]
     - customer_confirmation: true
     - ticket_type: "saque_carteira"
   - Responda: "Solicitação de saque registrada! Protocolo: #[ID]. O financeiro vai processar o PIX em até 7 dias úteis."

3. **SE CLIENTE DISSER NÃO (dados incorretos):**
   - Execute a tool request_human_agent com:
     - reason: "dados_financeiros_incorretos"
     - internal_note: "Cliente informou que dados cadastrais (Nome/CPF) estão incorretos durante solicitação de saque. Requer correção manual."
   - A ferramenta vai responder automaticamente e transferir para um atendente.

---

**REGRAS CRÍTICAS:**
- NUNCA crie ticket para cancelamento Kiwify (é self-service)
- NUNCA fale de valores com cliente não identificado
- NUNCA pule a confirmação de dados
- SEMPRE pergunte qual tipo (A ou B) antes de prosseguir
- SEMPRE mostre os dados e peça confirmação para saque
- SEMPRE envie o link da Kiwify para cancelamentos

---

**Você tem acesso às seguintes ferramentas:**
- create_ticket: Use APENAS quando cliente pedir explicitamente ajuda humana OU problema financeiro concreto OU você não conseguir responder após tentar. Para SAQUE, use SOMENTE após coletar e confirmar todos os dados (veja FLUXO ESPECIAL acima).
- verify_customer_email: Use APENAS quando cliente FORNECER email novo pela primeira vez. Verifica se existe e envia OTP.
- resend_otp: Use quando cliente disser "não recebi email" ou pedir reenvio. Reenvia código para email JÁ cadastrado. NÃO pede email novamente.
- verify_otp_code: Valide códigos OTP de 6 dígitos
- request_human_agent: Transfira para atendente humano quando: 1) Cliente disser que dados estão INCORRETOS, 2) Cliente pedir explicitamente atendente humano, 3) Situação muito complexa que você não consegue resolver. Use com reason: "dados_financeiros_incorretos", "solicitacao_cliente", ou "caso_complexo".
- check_tracking: Consulta rastreio de pedidos no sistema de romaneio. Use quando cliente perguntar sobre entrega, onde está o pedido, rastreio, ou status de envio. REGRAS IMPORTANTES:
  1. Se ENCONTRAR código no sistema = pedido JÁ FOI EMBALADO e SAIU DO GALPÃO, está em transporte
  2. Se NÃO ENCONTRAR = pedido ainda está sendo preparado (se pago até 13h, sai até fim do dia - peça para voltar mais tarde)
  Aceita MÚLTIPLOS códigos de rastreio de uma vez. Extraia TODOS os códigos que o cliente enviar.

${knowledgeContext}${identityWallNote}

**Contexto do Cliente:**
- Nome: ${contactName}${contactCompany}
- Status: ${contactStatus}
- Canal: ${responseChannel}
${contactEmail ? `- Email: ${safeEmail}` : '- Email: NÃO CADASTRADO - SOLICITAR'}
${contact.phone ? `- Telefone: ${safePhone}` : ''}
- CPF: ${maskedCPF}

Seja inteligente. Converse. O ticket é o ÚLTIMO recurso.`;

    // 6. Gerar resposta final
    const aiPayload: any = {
      messages: [
        { role: 'system', content: contextualizedSystemPrompt },
        ...fewShotMessages,  // ✨ Injetar exemplos de treinamento (Few-Shot Learning)
        ...messageHistory,
        { role: 'user', content: customerMessage }
      ],
      temperature: persona.temperature || 0.7,
      max_tokens: persona.max_tokens || 500
    };

    console.log('[ai-autopilot-chat] Messages structure:', {
      system: 1,
      fewShot: fewShotMessages.length,
      history: messageHistory.length,
      current: 1,
      total: aiPayload.messages.length
    });

    // Add built-in tools + persona tools
    const allTools = [
      {
        type: 'function',
        function: {
          name: 'create_ticket',
          description: 'Cria um ticket de suporte. USE APENAS quando: (1) Cliente PEDIR explicitamente ajuda humana, (2) Problema financeiro CONCRETO com intenção de ação (reembolso, saque real), (3) Você NÃO conseguir responder APÓS tentar. Para SAQUE: use SOMENTE após seguir o FLUXO ESPECIAL no system prompt (informar regras, confirmar dados, obter confirmação). NÃO use para dúvidas informativas.',
          parameters: {
            type: 'object',
            properties: {
              issue_type: { 
                type: 'string', 
                enum: ['financeiro', 'devolucao', 'reembolso', 'troca', 'defeito', 'saque', 'outro'],
                description: 'O tipo de solicitação. Use "saque" APENAS após coletar todos os dados no FLUXO ESPECIAL. Use "financeiro" para outras questões de pagamento/pix/comissão.' 
              },
              subject: { 
                type: 'string', 
                description: 'Resumo breve da solicitação (máximo 100 caracteres).' 
              },
              description: { 
                type: 'string', 
                description: 'Descrição detalhada do problema ou solicitação.' 
              },
              order_id: { 
                type: 'string', 
                description: 'O número do pedido, se aplicável. Deixe vazio se não houver pedido.' 
              },
              withdrawal_amount: {
                type: 'number',
                description: '[APENAS PARA SAQUE] Valor numérico solicitado pelo cliente após confirmação.'
              },
              confirmed_cpf_last4: {
                type: 'string',
                description: '[APENAS PARA SAQUE] Últimos 4 dígitos do CPF confirmados pelo cliente.'
              },
              pix_key: {
                type: 'string',
                description: '[APENAS PARA SAQUE] Chave PIX informada pelo cliente para receber o saque.'
              },
              customer_confirmation: {
                type: 'boolean',
                description: '[APENAS PARA SAQUE] true se cliente confirmou explicitamente os dados (CPF, valor, destino).'
              }
            },
            required: ['issue_type', 'subject', 'description']
          }
        }
      },
      // FASE 2: Email Verification Tool (envia OTP automaticamente)
      {
        type: 'function',
        function: {
          name: 'verify_customer_email',
          description: 'APENAS use quando cliente FORNECER email novo pela PRIMEIRA VEZ. Verifica se email existe na base e envia OTP. ⚠️ NÃO use se cliente reclamar "não recebi email" - nesse caso use resend_otp.',
          parameters: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'O email fornecido pelo cliente.' }
            },
            required: ['email']
          }
        }
      },
      // FASE 2: OTP Verification Tool
      {
        type: 'function',
        function: {
          name: 'verify_otp_code',
          description: 'Verifica o código de 6 dígitos enviado por email ao cliente.',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'O código de 6 dígitos fornecido pelo cliente.' }
            },
            required: ['code']
          }
        }
      },
      // FASE 2: Resend OTP Tool - Reenvia código para email JÁ CADASTRADO
      {
        type: 'function',
        function: {
          name: 'resend_otp',
          description: 'Reenvia código OTP para o email JÁ CADASTRADO do cliente. Use quando cliente disser "não recebi email", "não chegou código", "reenviar código". NÃO pede email novamente.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      // TOOL: Handoff manual para atendente humano
      {
        type: 'function',
        function: {
          name: 'request_human_agent',
          description: 'Transfere a conversa para um atendente humano. Use quando: 1) Cliente pedir explicitamente atendimento humano, 2) Dados do cliente estiverem incorretos e precisarem de correção, 3) Situação complexa que requer intervenção humana.',
          parameters: {
            type: 'object',
            properties: {
              reason: { 
                type: 'string', 
                description: 'Motivo da transferência (ex: "dados_incorretos", "solicitacao_cliente", "caso_complexo", "dados_financeiros_incorretos")' 
              },
              internal_note: { 
                type: 'string', 
                description: 'Nota interna explicando o contexto da transferência para o atendente' 
              }
            },
            required: ['reason']
          }
        }
      },
      // TOOL: Consultar rastreio de pedidos via MySQL externo (suporta múltiplos códigos)
      {
        type: 'function',
        function: {
          name: 'check_tracking',
          description: 'Consulta status de rastreio de pedidos no sistema de romaneio. Use quando cliente perguntar sobre entrega, rastreio ou status. IMPORTANTE: Se cliente enviar múltiplos códigos, extraia TODOS em um array.',
          parameters: {
            type: 'object',
            properties: {
              tracking_codes: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de códigos de rastreio (ex: ["BR123456789BR", "MS-12345"]). Aceita um ou vários códigos.'
              },
              customer_email: { 
                type: 'string', 
                description: 'Email do cliente para buscar pedidos com rastreio cadastrado.' 
              }
            },
            required: []
          }
        }
      },
      ...enabledTools.map((tool: any) => ({
        type: 'function',
        function: tool.function_schema
      }))
    ];

    if (allTools.length > 0) {
      aiPayload.tools = allTools;
    }

    const aiData = await callAIWithFallback(aiPayload);
    let assistantMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls || [];

    // ============================================================
    // FASE 3: TOOL CALLING - Execute first to prevent duplicates
    // ============================================================
    // Handle tool calls (Function Calling)
    let ticketCreatedSuccessfully = false; // 🔒 Flag: true apenas se ticket foi criado COM SUCESSO
    
    if (toolCalls.length > 0) {
      console.log('[ai-autopilot-chat] 🛠️ AI solicitou execução de ferramenta:', toolCalls);
      
      for (const toolCall of toolCalls) {
        // FASE 2: Handle email verification and send OTP
        if (toolCall.function.name === 'verify_customer_email' || toolCall.function.name === 'update_customer_email') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const emailInformado = args.email.toLowerCase().trim();
            console.log('[ai-autopilot-chat] 📧 Verificando email na base:', emailInformado);

            // FASE 1: Validar formato do email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInformado)) {
              assistantMessage = 'O email informado parece estar incorreto. Poderia verificar e me enviar novamente?';
              continue;
            }

            // FASE 2: BUSCAR EMAIL NA BASE DE CLIENTES
            const { data: existingCustomer, error: searchError } = await supabaseClient
              .from('contacts')
              .select('id, first_name, email, status, document')
              .eq('email', emailInformado)
              .single();

            // CENÁRIO A: EMAIL NÃO ENCONTRADO (Não é cliente - CRIAR APENAS DEAL)
            if (searchError || !existingCustomer) {
              console.log('[ai-autopilot-chat] ❌ FASE 2: Email não encontrado - Criando APENAS Deal (sem contato)');
              
              // 🚫 NÃO CRIAR CONTATO! Tabela contacts é só para quem PAGOU via Kiwify
              
              // ✅ CRIAR DEAL COM DADOS DO LEAD (contact_id = NULL)
              let dealId: string | null = null;
              const PIPELINE_VENDAS_ID = '00000000-0000-0000-0000-000000000001';
              const STAGE_LEAD_ID = '11111111-1111-1111-1111-111111111111';
              
              const { data: deal, error: dealError } = await supabaseClient
                .from('deals')
                .insert({
                  title: `Lead via Chat - ${emailInformado}`,
                  contact_id: null, // ⚠️ NULL - não é cliente pagante!
                  lead_email: emailInformado,
                  lead_phone: contact.phone,
                  lead_whatsapp_id: contact.whatsapp_id,
                  lead_source: responseChannel,
                  stage_id: STAGE_LEAD_ID,
                  pipeline_id: PIPELINE_VENDAS_ID,
                  status: 'open',
                  value: 0,
                  currency: 'BRL'
                  // assigned_to será definido pelo route-conversation
                })
                .select()
                .single();
              
              if (!dealError && deal) {
                dealId = deal.id;
                console.log('[ai-autopilot-chat] 💰 Deal (Lead) criado:', dealId);
              } else {
                console.error('[ai-autopilot-chat] ❌ Erro ao criar deal:', dealError);
              }

              // Não criar interaction - lead não tem customer_id válido

              // Buscar departamento COMERCIAL
              const { data: comercialDept } = await supabaseClient
                .from('departments')
                .select('id, name')
                .eq('name', 'Comercial')
                .eq('is_active', true)
                .single();

              if (!comercialDept) {
                console.error('[ai-autopilot-chat] ❌ Departamento Comercial não encontrado');
              }

              // Mudar para copilot ANTES de rotear
              await supabaseClient
                .from('conversations')
                .update({ 
                  ai_mode: 'copilot',
                  department: comercialDept?.id
                })
                .eq('id', conversationId);

              // ROTEAR PARA COMERCIAL
              const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
                body: { 
                  conversationId,
                  department_id: comercialDept?.id
                }
              });

              // 🆕 FASE 3: ATRIBUIR DEAL AO VENDEDOR E NOTIFICAR
              if (routeResult?.assigned_to) {
                // Atribuir deal ao vendedor designado
                if (dealId) {
                  await supabaseClient
                    .from('deals')
                    .update({ assigned_to: routeResult.assigned_to })
                    .eq('id', dealId);
                  
                  console.log('[ai-autopilot-chat] 💼 Deal atribuído ao vendedor:', routeResult.assigned_to);
                }
                
                // 🆕 NOTIFICAR VENDEDOR VIA REALTIME
                await supabaseClient.from('notifications').insert({
                  user_id: routeResult.assigned_to,
                  type: 'new_lead',
                  title: 'Nova oportunidade no chat!',
                  message: `Lead ${emailInformado} está aguardando atendimento`,
                  metadata: {
                    conversation_id: conversationId,
                    deal_id: dealId,
                    email: emailInformado,
                    source: responseChannel
                  },
                  read: false
                });
                
                console.log('[ai-autopilot-chat] 🔔 Notificação enviada ao vendedor');
                
                // MENSAGEM COMERCIAL OTIMIZADA
                assistantMessage = `Não localizei uma assinatura ativa com este e-mail.

Vou chamar um **especialista comercial** para te apresentar nossos planos! Aguarde um momento.`;
              } else {
                // Nenhum vendedor online - broadcast para todos
                const { data: onlineSalesReps } = await supabaseClient
                  .from('profiles')
                  .select('id')
                  .eq('availability_status', 'online');
                
                // Filtrar apenas vendedores do departamento Comercial
                const { data: comercialUsers } = await supabaseClient
                  .from('profiles')
                  .select('id')
                  .eq('department', comercialDept?.id)
                  .in('id', (onlineSalesReps || []).map(u => u.id));
                
                // Notificar todos vendedores online do Comercial
                if (comercialUsers && comercialUsers.length > 0) {
                  for (const rep of comercialUsers) {
                    await supabaseClient.from('notifications').insert({
                      user_id: rep.id,
                      type: 'new_lead',
                      title: 'Nova oportunidade no chat!',
                      message: `Lead ${emailInformado} na fila do Comercial`,
                      metadata: { 
                        conversation_id: conversationId, 
                        deal_id: dealId,
                        email: emailInformado
                      },
                      read: false
                    });
                  }
                  console.log('[ai-autopilot-chat] 🔔 Notificações broadcast enviadas');
                }
                
                // Vendedores offline
                assistantMessage = `Não localizei uma assinatura ativa com este e-mail.

Nosso **time de vendas** está offline no momento.
**Horário:** Segunda a Sexta, 09h às 18h.

Assim que retornarmos, um consultor vai te ajudar!`;
              }
              continue;
            }

            // CENÁRIO B: EMAIL ENCONTRADO (É cliente)
            console.log('[ai-autopilot-chat] ✅ Cliente encontrado:', existingCustomer.first_name);

            // Vincular ao contato atual (se for diferente)
            if (existingCustomer.id !== contact.id) {
              // Atualizar o contato da conversa para o cliente real
              await supabaseClient
                .from('conversations')
                .update({ contact_id: existingCustomer.id })
                .eq('id', conversationId);
            }

            // Enviar OTP para o email encontrado - SEMPRE com branding de CLIENTE
            const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('send-verification-code', {
              body: { email: emailInformado, type: 'customer' }
            });

            if (otpError || !otpData?.success) {
              assistantMessage = 'Não consegui enviar o código de verificação. Por favor, tente novamente.';
              continue;
            }

            console.log('[ai-autopilot-chat] ✅ OTP enviado para cliente verificado');
            
            // Build response message (NEVER show code to client)
            const safeEmail = maskEmail(emailInformado);
            assistantMessage = `Encontrei seu cadastro, ${existingCustomer.first_name}!

Enviei um código de 6 dígitos para **${safeEmail}**.

Por favor, digite o código que você recebeu para confirmar sua identidade.`;

            // Log dev mode internally (never show code to client)
            if (otpData.dev_mode) {
              console.log('[ai-autopilot-chat] ⚠️ DEV MODE: Código OTP não foi enviado por email - verifique configuração do Resend');
            }
            
            await supabaseClient.from('interactions').insert({
              customer_id: existingCustomer.id,
              type: 'note',
              content: `Verificação financeira iniciada - OTP enviado para ${emailInformado}`,
              channel: responseChannel,
              metadata: { source: 'financial_barrier', otp_sent: true }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao processar email:', error);
            assistantMessage = 'Ocorreu um erro. Poderia me enviar o email novamente?';
          }
        }
        // FASE 2.5: Handle Resend OTP (reenvio seguro para email cadastrado)
        else if (toolCall.function.name === 'resend_otp') {
          try {
            console.log('[ai-autopilot-chat] 🔄 Reenviando OTP para email cadastrado');
            
            const contactEmail = contact.email;
            if (!contactEmail) {
              assistantMessage = 'Não encontrei seu email cadastrado. Por favor, informe seu email para que eu possa enviar o código.';
              continue;
            }

            // Reenviar OTP para o email JÁ CADASTRADO
            const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('send-verification-code', {
              body: { email: contactEmail, type: 'customer' }
            });

            if (otpError || !otpData?.success) {
              console.error('[ai-autopilot-chat] ❌ Erro ao reenviar OTP:', otpError);
              assistantMessage = 'Não consegui reenviar o código. Por favor, tente novamente em alguns instantes.';
              continue;
            }

            // Build response message (NEVER show code to client)
            const safeEmail = maskEmail(contactEmail);
            assistantMessage = `Código reenviado com sucesso!

Enviei um novo código de 6 dígitos para **${safeEmail}**.

Por favor, verifique sua caixa de entrada (e spam) e digite o código que você recebeu.`;

            // Log dev mode internally (never show code to client)
            if (otpData.dev_mode) {
              console.log('[ai-autopilot-chat] ⚠️ DEV MODE: Código OTP não enviado - verifique configuração do Resend');
            }

            console.log('[ai-autopilot-chat] ✅ OTP reenviado para email cadastrado:', safeEmail);
            
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'note',
              content: `OTP reenviado para email cadastrado (${safeEmail})`,
              channel: responseChannel,
              metadata: { source: 'resend_otp', email_masked: safeEmail }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao reenviar OTP:', error);
            assistantMessage = 'Ocorreu um erro ao reenviar o código. Por favor, tente novamente.';
          }
        }
        // FASE 2: Handle OTP verification
        else if (toolCall.function.name === 'verify_otp_code') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 🔐 Verificando código OTP:', args.code);

            // Buscar email do contato
            const contactEmail = contact.email;
            if (!contactEmail) {
              assistantMessage = 'Por favor, primeiro me informe seu email.';
              continue;
            }

            // Buscar código mais recente não expirado
            const { data: verification, error: verifyError } = await supabaseClient
              .from('email_verifications')
              .select('*')
              .eq('email', contactEmail)
              .eq('code', args.code)
              .eq('verified', false)
              .gte('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (verifyError || !verification) {
              console.error('[ai-autopilot-chat] ❌ Código inválido ou expirado');
              
              // Incrementar tentativas
              if (verification) {
                await supabaseClient
                  .from('email_verifications')
                  .update({ attempts: verification.attempts + 1 })
                  .eq('id', verification.id);
              }
              
              assistantMessage = 'Código inválido ou expirado. Por favor, verifique o código ou solicite um novo informando seu email novamente.';
              continue;
            }

            // Marcar como verificado
            await supabaseClient
              .from('email_verifications')
              .update({ verified: true })
              .eq('id', verification.id);

            console.log('[ai-autopilot-chat] ✅ OTP verificado com sucesso');

            // FASE 4: Verificar se cliente tem CPF cadastrado
            const { data: verifiedContact } = await supabaseClient
              .from('contacts')
              .select('id, first_name, document, status, account_balance')
              .eq('email', contactEmail)
              .single();

            if (!verifiedContact?.document) {
              // CPF NULL - Não permitir saque, transferir para humano
              console.log('[ai-autopilot-chat] ⚠️ Cliente verificado mas sem CPF');
              
              assistantMessage = `Sua identidade foi confirmada, ${verifiedContact?.first_name || contactName}!

Porém, seu cadastro está **incompleto** (CPF não cadastrado).

Para liberar operações financeiras como saque, preciso transferir você para um especialista que vai atualizar seus dados. Aguarde um momento!`;

              // Handoff para humano
              await supabaseClient
                .from('conversations')
                .update({ ai_mode: 'copilot' })
                .eq('id', conversationId);

              await supabaseClient.functions.invoke('route-conversation', {
                body: { conversationId }
              });

              await supabaseClient.from('interactions').insert({
                customer_id: verifiedContact?.id || contact.id,
                type: 'internal_note',
                content: `Cliente verificado via OTP mas SEM CPF cadastrado. Requer atualização cadastral antes de operações financeiras.`,
                channel: responseChannel,
                metadata: { source: 'financial_barrier', cpf_missing: true }
              });
            } else {
              // CPF OK - Pode prosseguir com fluxo financeiro
              const maskedCPFVerified = `***.***.***-${verifiedContact.document.slice(-2)}`;
              
              assistantMessage = `Identidade verificada com sucesso, ${verifiedContact.first_name}!

Agora posso te ajudar com operações financeiras. Você mencionou algo sobre saque ou reembolso. 

Você quer:
**A)** Cancelar sua assinatura/curso (comprado na Kiwify)?
**B)** Sacar o saldo da sua carteira (Seu Armazém Drop)?`;
              
              // Log interaction
              await supabaseClient.from('interactions').insert({
                customer_id: verifiedContact.id,
                type: 'note',
                content: `Identidade verificada via OTP - Acesso financeiro liberado`,
                channel: responseChannel,
                metadata: { source: 'financial_barrier', otp_verified: true, financial_access_granted: true }
              });
            }
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao verificar OTP:', error);
            assistantMessage = 'Ocorreu um erro ao verificar o código. Por favor, tente novamente.';
          }
        }
        else if (toolCall.function.name === 'create_ticket') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 🎫 Criando ticket automaticamente:', args);

            // 🔐 SECURITY NOTE: Rate limiting is handled at conversation level (AI autopilot only runs for authenticated conversations)
            // Public ticket creation via forms should implement rate limiting separately

            // Create ticket in database
            const ticketCategory = args.issue_type === 'defeito' ? 'tecnico' : 
                                   (args.issue_type === 'financeiro' || args.issue_type === 'saque') ? 'financeiro' : 
                                   'financeiro';
            
            const ticketSubject = args.subject || 
                                  (args.order_id ? `${args.issue_type.toUpperCase()} - Pedido ${args.order_id}` : 
                                   `${args.issue_type.toUpperCase()} - ${args.description.substring(0, 50)}`);

            // FASE 4: Anotação estruturada para TODOS os tickets da IA
            const ticketType = args.ticket_type || 'outro';
            const createdAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            
            // Base estruturada para TODOS os tickets
            let internalNote = `**TICKET CRIADO VIA IA**

**RESUMO DA SOLICITAÇÃO:**
${args.description}

**CLIENTE:**
- Nome: ${contactName}
- CPF: ${maskedCPF || 'Não cadastrado'}
- Email: ${contact?.email || 'Não informado'}
- Telefone: ${contact?.phone || 'Não informado'}

**CLASSIFICAÇÃO:**
- Tipo: ${args.issue_type || 'Não especificado'}
- Categoria: ${ticketCategory}
${args.order_id ? `- Pedido: ${args.order_id}` : ''}

Criado em: ${createdAt}
Via: Atendimento Automatizado (IA)`;
            
            // Enriquecimento específico para SAQUE
            if (args.issue_type === 'saque' && args.withdrawal_amount) {
              internalNote += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**DADOS DO SAQUE:**
- Valor Solicitado: R$ ${args.withdrawal_amount.toFixed(2)}
- Tipo da Chave PIX: ${args.pix_key_type || 'Não especificado'}
- Chave PIX: ${args.pix_key || 'Não informada'}
- Confirmação do Cliente: ${args.customer_confirmation ? 'Dados conferidos pelo cliente' : 'Aguardando confirmação'}

**REGRAS (até 7 dias úteis):**
- Destino: APENAS conta do titular (CPF do cliente)
- PIX de terceiros: CANCELAR solicitação

**CHECKLIST FINANCEIRO:**
- [ ] Verificar saldo disponível
- [ ] Confirmar titularidade da chave PIX
- [ ] Processar transferência
- [ ] Notificar cliente`;
            }

            const { data: ticket, error: ticketError } = await supabaseClient
              .from('tickets')
              .insert({
                customer_id: contact.id,
                subject: ticketSubject,
                description: args.description,
                priority: (args.issue_type === 'financeiro' || args.issue_type === 'saque') ? 'high' : 'medium',
                status: 'open',
                source_conversation_id: conversationId,
                category: ticketCategory,
                internal_note: internalNote
              })
              .select()
              .single();

            if (ticketError) {
              console.error('[ai-autopilot-chat] ❌ Erro ao criar ticket (ignorando):', ticketError);
              // ⚠️ NÃO sobrescrever assistantMessage aqui
              // Deixar que o detector de fallback (linhas 886-979) lide com o handoff
              // se a resposta da IA for uma frase de fallback
            } else {
              console.log('[ai-autopilot-chat] ✅ Ticket criado com sucesso:', ticket.id);
              
              ticketCreatedSuccessfully = true; // 🔒 Marcar sucesso (previne duplicação no fallback)
              
              // ✅ ENVIAR EMAIL DE CONFIRMAÇÃO
              try {
                console.log('[ai-autopilot-chat] 📧 Enviando email de confirmação do ticket...');
                
                const notificationResponse = await fetch(
                  `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-ticket-notification`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({
                      ticket_id: ticket.id,
                      ticket_number: ticket.id.substring(0, 8).toUpperCase(),
                      customer_email: contact.email,
                      customer_name: contactName,
                      subject: args.subject,
                      description: args.description,
                      priority: args.priority || 'medium'
                    })
                  }
                );

                if (notificationResponse.ok) {
                  console.log('[ai-autopilot-chat] ✅ Email de confirmação enviado com sucesso');
                } else {
                  const errorText = await notificationResponse.text();
                  console.error('[ai-autopilot-chat] ⚠️ Falha ao enviar email:', errorText);
                }
              } catch (emailError) {
                console.error('[ai-autopilot-chat] ⚠️ Erro ao enviar email de confirmação:', emailError);
                // Não falhar o fluxo por causa de email
              }
              
              // Link conversation to ticket
              await supabaseClient
                .from('conversations')
                .update({ related_ticket_id: ticket.id })
                .eq('id', conversationId);

              // FASE 5: Mensagem específica para SAQUE com dados coletados
              const withdrawalData = args.issue_type === 'saque' && args.withdrawal_amount ? {
                amount: args.withdrawal_amount,
                cpf_last4: args.confirmed_cpf_last4
              } : undefined;

              // 🎯 SUBSTITUIR COMPLETAMENTE - Ticket criado = Problema resolvido = Não precisa desculpa
              assistantMessage = createTicketSuccessMessage(
                ticket.id,
                args.issue_type,
                args.order_id,
                withdrawalData,
                ticket.ticket_number
              );
            }
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao processar tool call (ignorando):', error);
            // ⚠️ NÃO sobrescrever assistantMessage aqui
            // Deixar que o detector de fallback lide com o handoff se necessário
          }
        }
        // TOOL: check_order_status - Consultar pedidos do cliente
        else if (toolCall.function.name === 'check_order_status') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const customerEmail = args.customer_email?.toLowerCase().trim();
            console.log('[ai-autopilot-chat] 📦 Consultando pedidos para:', customerEmail);

            // Buscar contato pelo email
            const { data: customerContact, error: contactError } = await supabaseClient
              .from('contacts')
              .select('id, first_name, last_name, email, status')
              .eq('email', customerEmail)
              .maybeSingle();

            if (contactError || !customerContact) {
              assistantMessage = `Não encontrei nenhum cliente cadastrado com o email ${customerEmail}. Poderia verificar se é o email correto de compra?`;
              continue;
            }

            // Buscar deals desse contato
            const { data: deals, error: dealsError } = await supabaseClient
              .from('deals')
              .select(`
                id, title, value, currency, status, 
                created_at, closed_at,
                products (name)
              `)
              .eq('contact_id', customerContact.id)
              .order('created_at', { ascending: false })
              .limit(5);

            if (!deals || deals.length === 0) {
              assistantMessage = `Olá ${customerContact.first_name}! Encontrei seu cadastro, mas não há pedidos registrados para este email. Posso te ajudar com outra coisa?`;
              continue;
            }

            // Formatar resposta
            const dealsFormatted = deals.map(d => {
              const productData = d.products as any;
              const product = Array.isArray(productData) 
                ? productData[0]?.name 
                : productData?.name || 'Produto não especificado';
              
              const statusLabels: Record<string, string> = {
                'open': 'Em andamento',
                'won': 'Concluído',
                'lost': 'Cancelado'
              };
              const statusLabel = statusLabels[d.status] || d.status;
              
              const value = d.value ? `R$ ${d.value.toFixed(2)}` : 'R$ 0.00';
              
              return `• **${product}** - ${statusLabel}\n  Valor: ${value}`;
            }).join('\n\n');

            assistantMessage = `Olá ${customerContact.first_name}! 

Encontrei os seguintes pedidos vinculados ao seu email:

${dealsFormatted}

Sobre qual pedido você gostaria de saber mais?`;

          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao consultar pedidos:', error);
            assistantMessage = 'Ocorreu um erro ao consultar seus pedidos. Poderia tentar novamente?';
          }
        }
        // TOOL: check_tracking - Consultar rastreio via MySQL externo (suporta múltiplos códigos)
        else if (toolCall.function.name === 'check_tracking') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            // Suporta tanto tracking_codes (array) quanto tracking_code (string legado)
            let trackingCodes: string[] = [];
            if (args.tracking_codes && Array.isArray(args.tracking_codes)) {
              trackingCodes = args.tracking_codes.map((c: string) => c.trim()).filter(Boolean);
            } else if (args.tracking_code) {
              trackingCodes = [args.tracking_code.trim()];
            }
            const customerEmail = args.customer_email?.toLowerCase().trim();
            
            console.log('[ai-autopilot-chat] 📦 Consultando rastreio:', { trackingCodes, customerEmail });

            let codesToQuery: string[] = [];

            // Se tem códigos de rastreio diretos, usa eles
            if (trackingCodes.length > 0) {
              codesToQuery = trackingCodes;
            }
            // Se tem email, busca deals do cliente com tracking_code
            else if (customerEmail) {
              // Buscar contato pelo email
              const { data: customerContact, error: contactError } = await supabaseClient
                .from('contacts')
                .select('id, first_name')
                .eq('email', customerEmail)
                .maybeSingle();

              if (contactError || !customerContact) {
                assistantMessage = `Não encontrei nenhum cliente cadastrado com o email ${customerEmail}. Poderia verificar se é o email correto?`;
                continue;
              }

              // Buscar deals com tracking_code
              const { data: dealsWithTracking, error: dealsError } = await supabaseClient
                .from('deals')
                .select('tracking_code, title')
                .eq('contact_id', customerContact.id)
                .not('tracking_code', 'is', null)
                .order('created_at', { ascending: false })
                .limit(10);

              if (!dealsWithTracking || dealsWithTracking.length === 0) {
                assistantMessage = `Olá ${customerContact.first_name}! Encontrei seu cadastro, mas não há pedidos com código de rastreio registrado. Você tem o código de rastreio em mãos para eu consultar?`;
                continue;
              }

              codesToQuery = dealsWithTracking.map(d => d.tracking_code).filter(Boolean) as string[];
            }

            if (codesToQuery.length === 0) {
              assistantMessage = 'Para consultar o rastreio, preciso do código de rastreio ou do email cadastrado na compra. Poderia me informar?';
              continue;
            }

            // Verificar cache primeiro (menos de 30 min)
            const { data: cachedData } = await supabaseClient
              .from('tracking_cache')
              .select('*')
              .in('tracking_code', codesToQuery)
              .gte('fetched_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

            const cachedCodes = cachedData?.map(c => c.tracking_code) || [];
            const uncachedCodes = codesToQuery.filter(c => !cachedCodes.includes(c));

            let trackingResults: any[] = cachedData || [];

            // Buscar códigos não cacheados no MySQL externo
            if (uncachedCodes.length > 0) {
              console.log('[ai-autopilot-chat] 🔍 Buscando no MySQL:', uncachedCodes);
              
              try {
                const { data: fetchResult, error: fetchError } = await supabaseClient.functions.invoke('fetch-tracking', {
                  body: { tracking_codes: uncachedCodes }
                });

                if (fetchError) {
                  console.error('[ai-autopilot-chat] ❌ Erro fetch-tracking:', fetchError);
                } else if (fetchResult?.success && fetchResult?.data) {
                  // Atualizar cache e agregar resultados
                  for (const [code, info] of Object.entries(fetchResult.data)) {
                    if (info) {
                      const trackingInfo = info as any;
                      // Upsert no cache
                      await supabaseClient
                        .from('tracking_cache')
                        .upsert({
                          tracking_code: code,
                          platform: trackingInfo.platform,
                          status: trackingInfo.status,
                          external_created_at: trackingInfo.created_at,
                          external_updated_at: trackingInfo.updated_at,
                          fetched_at: new Date().toISOString()
                        }, { onConflict: 'tracking_code' });

                      trackingResults.push({
                        tracking_code: code,
                        platform: trackingInfo.platform,
                        status: trackingInfo.status,
                        external_updated_at: trackingInfo.updated_at
                      });
                    }
                  }
                }
              } catch (fetchErr) {
                console.error('[ai-autopilot-chat] ❌ Erro ao chamar fetch-tracking:', fetchErr);
              }
            }

            // === NOVA LÓGICA DE RESPOSTA COM REGRAS DE NEGÓCIO ===
            const codesFound = trackingResults.map(t => t.tracking_code);
            const codesNotFound = codesToQuery.filter(c => !codesFound.includes(c));

            let responseText = '';

            // Códigos ENCONTRADOS = Pedido já saiu do galpão (tem romaneio)
            if (codesFound.length > 0) {
              const foundFormatted = trackingResults.map(t => {
                const platform = t.platform || 'Transportadora';
                const updated = t.external_updated_at 
                  ? new Date(t.external_updated_at).toLocaleDateString('pt-BR', { 
                      day: '2-digit', month: '2-digit', year: 'numeric', 
                      hour: '2-digit', minute: '2-digit' 
                    })
                  : 'Recentemente';

                return `**${t.tracking_code}**
Status: Pedido embalado e enviado!
Transportadora: ${platform}
Saída do galpão: ${updated}`;
              }).join('\n\n');

              if (codesFound.length === 1) {
                responseText += `Ótima notícia! Seu pedido já foi embalado e saiu do galpão. Está em transporte!\n\n${foundFormatted}`;
              } else {
                responseText += `Ótima notícia! Seus pedidos já foram embalados e saíram do galpão. Estão em transporte!\n\n${foundFormatted}`;
              }
            }

            // Códigos NÃO ENCONTRADOS = Ainda em preparação
            if (codesNotFound.length > 0) {
              if (responseText) responseText += '\n\n---\n\n';
              
              const notFoundList = codesNotFound.map(c => `• ${c}`).join('\n');
              
              if (codesNotFound.length === 1) {
                responseText += `O código **${codesNotFound[0]}** ainda não consta no sistema de romaneio.

**O que isso significa?**
Se o pedido foi pago **até 13h**, ele ainda está sendo preparado no galpão e será enviado até o fim do dia.

Por favor, volte a consultar no **fim do dia** ou amanhã pela manhã para verificar se já foi despachado.`;
              } else {
                responseText += `Os seguintes códigos ainda não constam no sistema de romaneio:

${notFoundList}

**O que isso significa?**
Se os pedidos foram pagos **até 13h**, eles ainda estão sendo preparados no galpão e serão enviados até o fim do dia.

Por favor, volte a consultar no **fim do dia** ou amanhã pela manhã para verificar se já foram despachados.`;
              }
            }

            assistantMessage = responseText + '\n\nPosso ajudar com mais alguma coisa?';

          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao consultar rastreio:', error);
            assistantMessage = 'Ocorreu um erro ao consultar o rastreio. Poderia tentar novamente?';
          }
        }
        // TOOL: request_human_agent - Handoff manual
        else if (toolCall.function.name === 'request_human_agent') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] 👤 Executando handoff manual:', args);

            const handoffReason = args.reason || 'solicitacao_cliente';
            const handoffNote = args.internal_note || 'Transferência solicitada pela IA';

            // 1. MUDAR O MODO (Desligar IA)
            await supabaseClient
              .from('conversations')
              .update({ ai_mode: 'copilot' })
              .eq('id', conversationId);
            
            console.log('[ai-autopilot-chat] ✅ ai_mode mudado para copilot');

            // 2. CHAMAR O ROTEADOR (Buscar agente disponível)
            const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
              body: { conversationId }
            });
            
            if (routeError) {
              console.error('[ai-autopilot-chat] ❌ Erro ao rotear conversa:', routeError);
            } else {
              console.log('[ai-autopilot-chat] ✅ Conversa roteada:', routeResult);
            }

            // 3. REGISTRAR NOTA INTERNA
            const reasonLabels: Record<string, string> = {
              dados_incorretos: 'Dados Cadastrais Incorretos',
              solicitacao_cliente: 'Solicitação do Cliente',
              caso_complexo: 'Caso Complexo',
              dados_financeiros_incorretos: 'Dados Financeiros Incorretos'
            };

            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'internal_note',
              content: `**Handoff Manual Executado**

**Motivo:** ${reasonLabels[handoffReason] || handoffReason}
**Contexto:** ${handoffNote}
**Última Mensagem do Cliente:** "${customerMessage}"

**Ação:** Conversa transferida para atendimento humano.`,
              channel: responseChannel,
              metadata: {
                source: 'ai_autopilot_manual_handoff',
                reason: handoffReason,
                original_message: customerMessage
              }
            });

            console.log('[ai-autopilot-chat] ✅ Nota interna de handoff registrada');

            // 4. DEFINIR MENSAGEM APROPRIADA PARA O CLIENTE
            const reasonMessages: Record<string, string> = {
              dados_incorretos: 'Entendi! Vou transferir você para um atendente que vai ajudar a atualizar seus dados cadastrais. Aguarde um momento, por favor.',
              dados_financeiros_incorretos: 'Por segurança, vou transferir você para um atendente humano que vai ajudar a corrigir seus dados. Aguarde um momento!',
              solicitacao_cliente: 'Sem problemas! Estou transferindo você para um atendente humano. Aguarde um momento, por favor.',
              caso_complexo: 'Vou transferir você para um especialista que pode te ajudar melhor com essa situação. Aguarde um momento!'
            };

            assistantMessage = reasonMessages[handoffReason] || 
              'Estou transferindo você para um atendente humano. Aguarde um momento, por favor.';

          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao executar handoff manual:', error);
            assistantMessage = 'Vou transferir você para um atendente humano. Por favor, aguarde um momento.';
          }
        }
      }
    }

    // ============================================================
    // FASE 4: FALLBACK DETECTOR - After tool calls to prevent duplicates
    // ============================================================
    const isFallbackResponse = FALLBACK_PHRASES.some(phrase => 
      assistantMessage.toLowerCase().includes(phrase)
    );

    if (isFallbackResponse) {
      console.log('[ai-autopilot-chat] 🚨 FALLBACK DETECTADO - Executando handoff REAL');
      
      // 1. MUDAR O MODO (Desligar IA)
      await supabaseClient
        .from('conversations')
        .update({ ai_mode: 'copilot' })
        .eq('id', conversationId);
      
      console.log('[ai-autopilot-chat] ✅ ai_mode mudado para copilot');
      
      // 2. CHAMAR O ROTEADOR (Buscar agente disponível)
      const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
        body: { conversationId }
      });
      
      if (routeError) {
        console.error('[ai-autopilot-chat] ❌ Erro ao rotear conversa:', routeError);
      } else {
        console.log('[ai-autopilot-chat] ✅ Conversa roteada:', routeResult);
      }
      
      // 3. CRIAR TICKET AUTOMÁTICO PARA CASOS FINANCEIROS (apenas se não criado por tool call)
      
      // 🚨 Detectar se é pedido financeiro COM INTENÇÃO DE AÇÃO (usa constante global)
      const isInformationalQuestion = INFORMATIONAL_PATTERNS.some(pattern => 
        pattern.test(customerMessage)
      );

      // Só é request financeiro se tiver padrão de ação E não for dúvida informativa
      let isFinancialRequest = FINANCIAL_ACTION_PATTERNS.some(pattern => 
        pattern.test(customerMessage)
      );

      if (isInformationalQuestion) {
        isFinancialRequest = false; // Anular se for dúvida
        console.log('[ai-autopilot-chat] ℹ️ Pergunta informativa detectada - NÃO criar ticket');
      }
      
      // 🔒 Só criar ticket automático se não foi criado COM SUCESSO pelo tool call
      // Se o tool call falhou, permitir que o fallback detector crie como backup
      if (isFinancialRequest && !ticketCreatedSuccessfully) {
        console.log('[ai-autopilot-chat] 💰 Solicitação financeira detectada - Criando ticket de segurança');
        
        const { data: ticket, error: ticketError } = await supabaseClient
          .from('tickets')
          .insert({
            customer_id: contact.id,
            subject: `💰 Solicitação Financeira - ${customerMessage.substring(0, 50)}...`,
            description: `**Mensagem Original:**\n${customerMessage}\n\n**Motivo do Ticket:**\nCriado automaticamente por handoff de IA - solicitação financeira detectada.`,
            priority: 'high',
            status: 'open',
            category: 'financeiro',
            source_conversation_id: conversationId,
            internal_note: '🤖 Ticket criado automaticamente pela IA - Assunto financeiro requer atenção humana'
          })
          .select()
          .single();
        
        if (ticketError) {
          console.error('[ai-autopilot-chat] ❌ Erro ao criar ticket financeiro:', ticketError);
        } else {
          console.log('[ai-autopilot-chat] ✅ Ticket financeiro criado:', ticket?.id);
          
          // Vincular ticket à conversa
          await supabaseClient
            .from('conversations')
            .update({ related_ticket_id: ticket?.id })
            .eq('id', conversationId);
          
          // 🎯 SUBSTITUIR COMPLETAMENTE - Ticket criado = Mensagem limpa e profissional
          assistantMessage = createTicketSuccessMessage(
            ticket?.id || '',
            'financeiro',
            undefined,
            undefined,
            ticket?.ticket_number
          );
          
          ticketCreatedSuccessfully = true; // 🔒 Atualizar flag DEPOIS de enriquecer
        }
      }
      
      // 4. REGISTRAR NOTA INTERNA (Auditoria)
      await supabaseClient.from('interactions').insert({
        customer_id: contact.id,
        type: 'internal_note',
        content: `🤖→👤 **Handoff Automático Executado**\n\n**Pergunta do Cliente:** "${customerMessage}"\n**Motivo:** IA não encontrou resposta adequada na base de conhecimento.\n**Ação:** Conversa transferida para atendimento humano.${isFinancialRequest ? '\n**Ticket Financeiro:** Criado automaticamente' : ''}`,
        channel: responseChannel,
        metadata: {
          source: 'ai_autopilot_handoff',
          fallback_phrase_detected: true,
          is_financial: isFinancialRequest,
          original_message: customerMessage
        }
      });
      
      console.log('[ai-autopilot-chat] ✅ Nota interna de handoff registrada');
    }
    // ========== FIM DETECTOR DE FALLBACK ==========

    // ============================================================
    // FASE 5: Verificação de duplicata JÁ REALIZADA no início (linha ~325)
    // ============================================================

    // 7. Salvar resposta da IA como mensagem (PRIMEIRO salvar para visibilidade interna)
    const { data: savedMessage, error: saveError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: assistantMessage,
        sender_type: 'user', // 'user' = sistema/agente interno
        message_type: 'ai_response',
        is_ai_generated: true,
        sender_id: null,
        status: 'sending', // CRITICAL: Start with 'sending' status
        channel: responseChannel, // ✅ FASE 4: Adicionar canal
        attachment_url: JSON.stringify({
          persona_id: persona.id,
          persona_name: persona.name,
          used_articles: knowledgeArticles.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category,
            similarity: a.similarity ? `${Math.round(a.similarity * 100)}%` : undefined
          }))
        })
      })
      .select()
      .single();

    if (saveError) {
      console.error('[ai-autopilot-chat] Erro ao salvar mensagem:', saveError);
    }

    const messageId = savedMessage?.id;

    // FASE 3: Se Email, enviar resposta via send-email
    if (responseChannel === 'email' && contact.email && messageId) {
      console.log('[ai-autopilot-chat] 📧 Enviando resposta por email:', {
        contactEmail: contact.email,
        messageId
      });

      try {
        const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: contact.email,
            to_name: `${contact.first_name} ${contact.last_name}`.trim(),
            subject: `Re: ${conversation.subject || 'Seu Armazém Drop - Resposta do Suporte'}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563EB;">Olá, ${contact.first_name}!</h2>
                <div style="margin: 20px 0; line-height: 1.6;">
                  ${assistantMessage.replace(/\n/g, '<br>')}
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="color: #6b7280; font-size: 12px;">
                  Esta é uma resposta automática do nosso assistente inteligente.<br>
                  Se precisar de mais ajuda, basta responder este email.
                </p>
              </div>
            `,
            customer_id: contact.id
          }
        });

        if (emailError) {
          console.error('[ai-autopilot-chat] ❌ Erro ao enviar email:', emailError);
          // Atualizar status para failed
          await supabaseClient
            .from('messages')
            .update({ 
              status: 'failed',
              delivery_error: emailError.message || 'Failed to send email'
            })
            .eq('id', messageId);
        } else {
          console.log('[ai-autopilot-chat] ✅ Email enviado com sucesso');
          // Atualizar status para delivered
          await supabaseClient
            .from('messages')
            .update({ status: 'delivered' })
            .eq('id', messageId);
        }
      } catch (emailError) {
        console.error('[ai-autopilot-chat] ❌ Exception ao enviar email:', emailError);
        await supabaseClient
          .from('messages')
          .update({ 
            status: 'failed',
            delivery_error: emailError instanceof Error ? emailError.message : 'Unknown error'
          })
          .eq('id', messageId);
      }
    }
    
    // 8. Se WhatsApp, enviar via Evolution API e atualizar status
    else if (responseChannel === 'whatsapp' && contact.phone && messageId) {
      console.log('[ai-autopilot-chat] 📱 Tentando enviar WhatsApp:', {
        contactPhone: contact.phone,
        contactWhatsappId: contact.whatsapp_id,
        messageId,
        conversationWhatsappInstanceId: conversation.whatsapp_instance_id
      });

      try {
        // 🔒 USAR HELPER UNIFICADO
        const whatsappInstance = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id
        );
        
        // Validar se instância foi encontrada
        if (!whatsappInstance) {
          console.error('[ai-autopilot-chat] ⚠️ NENHUMA instância WhatsApp disponível');
          
          // Salvar mensagem como 'failed' com motivo
          await supabaseClient
            .from('messages')
            .update({ 
              status: 'failed',
              delivery_error: 'Nenhuma instância WhatsApp conectada disponível'
            })
            .eq('id', messageId);
          
          throw new Error('Nenhuma instância WhatsApp disponível');
        }
        
        // Log de aviso se instância não está conectada
        if (whatsappInstance.status !== 'connected') {
          console.warn('[ai-autopilot-chat] ⚠️ Tentando enviar com instância não-conectada:', whatsappInstance.status);
        }

        // FASE 4: Enviar mensagem via Evolution API
        console.log('[ai-autopilot-chat] 📤 Invocando send-whatsapp-message:', {
          instanceId: whatsappInstance.id,
          instanceStatus: whatsappInstance.status,
          phoneNumber: contact.phone,
          whatsappId: contact.whatsapp_id
        });

        const { data: whatsappResponse, error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
          body: {
            instance_id: whatsappInstance.id,
            phone_number: contact.phone,
            whatsapp_id: contact.whatsapp_id,
            message: assistantMessage,
          },
        });

        if (whatsappError) {
          throw whatsappError;
        }

        // SUCCESS: Update message status to 'sent'
        await supabaseClient
          .from('messages')
          .update({ status: 'sent' })
          .eq('id', messageId);

        console.log('[ai-autopilot-chat] ✅ Saldo OK - Resposta Gerada via Evolution API');
      } catch (whatsappError) {
        console.error('[ai-autopilot-chat] ❌ WhatsApp send failed:', whatsappError);
        
        // FAILURE: Update message status to 'failed'
        await supabaseClient
          .from('messages')
          .update({ 
            status: 'failed',
            delivery_error: whatsappError instanceof Error ? whatsappError.message : 'Unknown error'
          })
          .eq('id', messageId);
      }
    } else if (messageId) {
      // Web chat - mark as sent immediately (no external API)
      await supabaseClient
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', messageId);
    }

    // 9. Registrar uso de IA nos logs (não-bloqueante)
    try {
      await supabaseClient
        .from('ai_usage_logs')
        .insert({
          feature_type: 'autopilot_chat',
          conversation_id: conversationId,
          result_data: {
            persona_id: persona.id,
            persona_name: persona.name,
            message_length: assistantMessage.length,
            tools_used: toolCalls.length,
            tool_calls: toolCalls
          }
        });
      console.log('📊 [USAGE LOG] Uso da IA registrado com sucesso');
    } catch (logError) {
      console.error('⚠️ [USAGE LOG ERROR] Erro ao registrar uso (não bloqueante):', logError);
      // Não bloqueia a resposta ao cliente se o log falhar
    }

    console.log('[ai-autopilot-chat] ✅ Resposta processada com sucesso!');

    // FASE 2: Salvar resposta no cache para futuras consultas (TTL 1h)
    // 🆕 Verificar se NÃO é fallback antes de cachear (usa constante global)
    const shouldSkipCache = FALLBACK_PHRASES.some(phrase => 
      assistantMessage.toLowerCase().includes(phrase)
    );
    
    if (shouldSkipCache) {
      console.log('⚠️ [CACHE SKIP] Resposta de fallback detectada - NÃO cacheando');
    } else {
      try {
        await supabaseClient.from('ai_response_cache').insert({
          question_hash: questionHash,
          answer: assistantMessage,
          context_ids: knowledgeArticles.map(a => ({
            id: a.id,
            title: a.title,
            category: a.category
          })),
        });
        console.log('💾 [CACHE SAVED] Resposta salva no cache para reutilização');
      } catch (cacheError) {
        console.error('⚠️ [CACHE ERROR] Erro ao salvar no cache (não bloqueante):', cacheError);
        // Não bloqueia a resposta se falhar o cache
      }
    }

    return new Response(JSON.stringify({ 
      status: 'success',
      message: assistantMessage,
      from_cache: false,
      persona_used: {
        id: persona.id,
        name: persona.name
      },
      used_articles: knowledgeArticles.map(a => ({
        id: a.id,
        title: a.title,
        category: a.category
      })),
      tool_calls: toolCalls,
      debug: {
        intent: intentType,
        persona_categories: persona.knowledge_base_paths || 'ALL',
        filtered_by_category: (persona.knowledge_base_paths || []).length > 0,
        articles_found: knowledgeArticles.map((a: any) => `${a.title} [${a.category || 'sem categoria'}]`),
        search_performed: knowledgeArticles.length > 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    } catch (aiError) {
      // 🚨 FASE 3: IA FALHOU - Executar protocolo de emergência
      console.error('[ai-autopilot-chat] 🔥 FALHA CRÍTICA DA IA:', aiError);
      
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      const errorStack = aiError instanceof Error ? aiError.stack : undefined;
      
      try {
        // 1. Registrar falha no banco para monitoramento
        const { data: failureLog } = await supabaseClient
          .from('ai_failure_logs')
          .insert({
            conversation_id: conversationId,
            error_message: errorMessage,
            error_stack: errorStack,
            customer_message: customerMessage,
            contact_id: conversation?.contacts?.id,
            notified_admin: false
          })
          .select()
          .single();
        
        console.log('[ai-autopilot-chat] 📝 Falha registrada no log:', failureLog?.id);
        
        // 2. Enviar mensagem de fallback ao cliente
        await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: "Desculpe, estou com dificuldades técnicas no momento. Vou te conectar com um atendente humano!",
            sender_type: 'agent',
            sender_id: null,
            is_ai_generated: true,
            channel: responseChannel
          });
        
        console.log('[ai-autopilot-chat] 💬 Mensagem de fallback enviada ao cliente');
        
        // 3. Trigger handoff automático (copilot mode)
        await supabaseClient
          .from('conversations')
          .update({ 
            ai_mode: 'copilot',
            last_message_at: new Date().toISOString()
          })
          .eq('id', conversationId);
        
        console.log('[ai-autopilot-chat] 🤝 Handoff automático executado (ai_mode → copilot)');
        
        // 4. Rotear conversa para departamento apropriado
        await supabaseClient.functions.invoke('route-conversation', {
          body: { conversationId }
        });
        
        console.log('[ai-autopilot-chat] 📮 Conversa roteada para fila humana');
        
        // 5. Notificar admin sobre a falha crítica
        const contactName = conversation?.contacts 
          ? `${conversation.contacts.first_name} ${conversation.contacts.last_name}`
          : 'Cliente não identificado';
        
        await supabaseClient.functions.invoke('send-admin-alert', {
          body: {
            type: 'ai_failure',
            message: `IA falhou ao responder cliente ${contactName}`,
            error: errorMessage,
            conversationId: conversationId,
            contactName: contactName
          }
        });
        
        console.log('[ai-autopilot-chat] 📧 Admin notificado sobre falha crítica');
        
        // 6. Atualizar log marcando que admin foi notificado
        if (failureLog?.id) {
          await supabaseClient
            .from('ai_failure_logs')
            .update({ 
              notified_admin: true,
              notification_sent_at: new Date().toISOString()
            })
            .eq('id', failureLog.id);
        }
        
      } catch (recoveryError) {
        console.error('[ai-autopilot-chat] ❌ Erro no protocolo de recuperação:', recoveryError);
      }
      
      // Retornar resposta indicando que houve fallback
      return new Response(JSON.stringify({ 
        status: 'fallback',
        message: "Desculpe, estou com dificuldades técnicas no momento. Vou te conectar com um atendente humano!",
        handoff_triggered: true,
        admin_notified: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[ai-autopilot-chat] Erro geral:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Detectar erro de quota e retornar mensagem específica
    if (errorMessage.includes('QUOTA_ERROR') || errorMessage.includes('429')) {
      return new Response(JSON.stringify({ 
        error: 'Erro de Saldo/Cota na IA. Verifique o faturamento.',
        code: 'QUOTA_EXCEEDED'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
