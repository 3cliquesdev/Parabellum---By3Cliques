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
    
    return data?.value || 'openai/gpt-5-mini';
  } catch (error) {
    console.error('[ai-autopilot-chat] Error fetching AI model config:', error);
    return 'openai/gpt-5-mini';
  }
}

// Helper: Buscar template de mensagem do banco ai_message_templates
async function getMessageTemplate(
  supabaseClient: any,
  key: string,
  variables: Record<string, string> = {}
): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient
      .from('ai_message_templates')
      .select('content, is_active')
      .eq('key', key)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      console.log(`[getMessageTemplate] Template "${key}" não encontrado ou inativo`);
      return null;
    }

    // Substituir variáveis {{var}} pelos valores
    let content = data.content;
    Object.entries(variables).forEach(([varKey, value]) => {
      content = content.replace(new RegExp(`\\{\\{${varKey}\\}\\}`, 'g'), value || '');
    });

    console.log(`[getMessageTemplate] ✅ Template "${key}" carregado com sucesso`);
    return content;
  } catch (error) {
    console.error(`[getMessageTemplate] Erro ao buscar template "${key}":`, error);
    return null;
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
// 🔒 HELPER: Seleção de Instância WhatsApp (Multi-Provider)
// Suporta tanto Meta WhatsApp Cloud API quanto Evolution API
// SEMPRE prioriza a instância vinculada à conversa
// ============================================================
interface WhatsAppInstanceResult {
  instance: any;
  provider: 'meta' | 'evolution';
}

async function getWhatsAppInstanceWithProvider(
  supabaseClient: any,
  conversationId: string,
  conversationWhatsappInstanceId: string | null,
  whatsappProvider: string | null = 'evolution',
  whatsappMetaInstanceId: string | null = null
): Promise<WhatsAppInstanceResult | null> {
  
  // ========== META WHATSAPP CLOUD API ==========
  // 1. Se é Meta provider, buscar na tabela whatsapp_meta_instances
  if (whatsappProvider === 'meta' && whatsappMetaInstanceId) {
    const { data: metaInstance } = await supabaseClient
      .from('whatsapp_meta_instances')
      .select('*')
      .eq('id', whatsappMetaInstanceId)
      .maybeSingle();
    
    if (metaInstance && metaInstance.status === 'active') {
      console.log('[getWhatsAppInstance] ✅ Usando instância META:', {
        instanceId: metaInstance.id,
        phoneNumberId: metaInstance.phone_number_id,
        name: metaInstance.name,
        status: metaInstance.status
      });
      return { instance: metaInstance, provider: 'meta' };
    } else {
      console.warn('[getWhatsAppInstance] ⚠️ Instância META vinculada não encontrada ou inativa:', whatsappMetaInstanceId);
    }
  }
  
  // 2. Fallback para Meta se provider é meta mas instância vinculada não existe
  if (whatsappProvider === 'meta') {
    const { data: fallbackMeta } = await supabaseClient
      .from('whatsapp_meta_instances')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    
    if (fallbackMeta) {
      console.log('[getWhatsAppInstance] 🔄 Usando instância META FALLBACK:', {
        instanceId: fallbackMeta.id,
        phoneNumberId: fallbackMeta.phone_number_id,
        name: fallbackMeta.name
      });
      return { instance: fallbackMeta, provider: 'meta' };
    }
    
    console.error('[getWhatsAppInstance] ❌ Nenhuma instância Meta WhatsApp disponível');
    return null;
  }
  
  // ========== EVOLUTION API (Legacy) ==========
  // 3. Se a conversa tem instância Evolution vinculada, usar ela
  if (conversationWhatsappInstanceId) {
    const { data: linkedInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('id', conversationWhatsappInstanceId)
      .maybeSingle();
    
    if (linkedInstance) {
      console.log('[getWhatsAppInstance] ✅ Usando instância Evolution VINCULADA:', {
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instance_name,
        phoneNumber: linkedInstance.phone_number,
        status: linkedInstance.status
      });
      return { instance: linkedInstance, provider: 'evolution' };
    } else {
      console.warn('[getWhatsAppInstance] ⚠️ Instância Evolution vinculada não encontrada:', conversationWhatsappInstanceId);
    }
  }
  
  // 4. Fallback Evolution: buscar instância conectada APENAS se não houver vinculada
  console.warn('[getWhatsAppInstance] ⚠️ Conversa', conversationId, 'sem instância vinculada - usando fallback Evolution');
  const { data: fallbackInstance } = await supabaseClient
    .from('whatsapp_instances')
    .select('*')
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (fallbackInstance) {
    console.log('[getWhatsAppInstance] 🔄 Usando instância Evolution FALLBACK:', {
      instanceId: fallbackInstance.id,
      instanceName: fallbackInstance.instance_name,
      phoneNumber: fallbackInstance.phone_number
    });
    return { instance: fallbackInstance, provider: 'evolution' };
  }
  
  console.error('[getWhatsAppInstance] ❌ Nenhuma instância WhatsApp disponível');
  return null;
}

// 🔄 WRAPPER MULTI-PROVIDER: Busca dinamicamente o provider da conversa
// Retorna { instance, provider } para suportar tanto Meta quanto Evolution
async function getWhatsAppInstanceForConversation(
  supabaseClient: any,
  conversationId: string,
  conversationWhatsappInstanceId: string | null,
  conversationData?: { 
    whatsapp_provider?: string | null; 
    whatsapp_meta_instance_id?: string | null; 
  }
): Promise<WhatsAppInstanceResult | null> {
  
  let provider = conversationData?.whatsapp_provider;
  let metaInstanceId = conversationData?.whatsapp_meta_instance_id;
  
  // Buscar dados da conversa se não foram passados
  if (!provider && conversationId) {
    const { data } = await supabaseClient
      .from('conversations')
      .select('whatsapp_provider, whatsapp_meta_instance_id')
      .eq('id', conversationId)
      .maybeSingle();
    
    provider = data?.whatsapp_provider;
    metaInstanceId = data?.whatsapp_meta_instance_id;
  }
  
  console.log('[getWhatsAppInstanceForConversation] 🔍 Provider detectado:', {
    provider: provider || 'evolution (default)',
    metaInstanceId: metaInstanceId || 'N/A',
    conversationId
  });
  
  return getWhatsAppInstanceWithProvider(
    supabaseClient,
    conversationId,
    conversationWhatsappInstanceId,
    provider || 'evolution',
    metaInstanceId || null
  );
}

// 📤 HELPER: Enviar mensagem via WhatsApp (Meta ou Evolution)
async function sendWhatsAppMessage(
  supabaseClient: any,
  whatsappResult: WhatsAppInstanceResult,
  phoneNumber: string,
  message: string,
  conversationId: string,
  whatsappId?: string | null,
  useQueue: boolean = false
): Promise<{ success: boolean; error?: any }> {
  try {
    if (whatsappResult.provider === 'meta') {
      console.log('[sendWhatsAppMessage] 📤 Enviando via Meta WhatsApp API:', {
        instanceId: whatsappResult.instance.id,
        phoneNumberId: whatsappResult.instance.phone_number_id,
        phoneNumber: phoneNumber?.replace(/\D/g, '').slice(-4)
      });
      
      const { data, error } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
        body: {
          instance_id: whatsappResult.instance.id,
          phone_number: phoneNumber?.replace(/\D/g, ''),
          message,
          conversation_id: conversationId
        }
      });
      
      if (error) {
        console.error('[sendWhatsAppMessage] ❌ Erro Meta WhatsApp:', error);
        return { success: false, error };
      }
      
      console.log('[sendWhatsAppMessage] ✅ Mensagem enviada via Meta WhatsApp API');
      return { success: true };
      
    } else {
      console.log('[sendWhatsAppMessage] 📤 Enviando via Evolution API:', {
        instanceId: whatsappResult.instance.id,
        instanceName: whatsappResult.instance.instance_name,
        phoneNumber: phoneNumber?.replace(/\D/g, '').slice(-4)
      });
      
      const { data, error } = await supabaseClient.functions.invoke('send-whatsapp-message', {
        body: {
          instance_id: whatsappResult.instance.id,
          phone_number: phoneNumber,
          whatsapp_id: whatsappId,
          message,
          conversation_id: conversationId,
          use_queue: useQueue
        }
      });
      
      if (error) {
        console.error('[sendWhatsAppMessage] ❌ Erro Evolution API:', error);
        return { success: false, error };
      }
      
      console.log('[sendWhatsAppMessage] ✅ Mensagem enviada via Evolution API');
      return { success: true };
    }
  } catch (err) {
    console.error('[sendWhatsAppMessage] ❌ Exceção ao enviar:', err);
    return { success: false, error: err };
  }
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
  'unable to',
  // 🆕 FASE 5: Novas frases anti-alucinação
  'não tenho certeza',
  'preciso verificar',
  'não posso confirmar',
  'não sei informar',
  'deixa eu consultar',
  'melhor falar com',
  'recomendo aguardar',
  'preciso de mais informações',
  'não localizei',
  'não encontrei registro',
  'sistema não mostra',
  'não aparece aqui',
  // Português informal
  'num sei',
  'n sei',
  'nao sei',
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

// Thresholds - FASE 6: Conservador para reduzir alucinações
const SCORE_DIRECT = 0.95;   // Antes: 0.90 - Só responde direto com ALTA certeza
const SCORE_CAUTIOUS = 0.85; // Antes: 0.80 - Margem maior para resposta cautelosa
const SCORE_MINIMUM = 0.70;  // Novo: Abaixo disso, SEMPRE handoff

// 🆕 Thresholds do MODO RAG ESTRITO (Anti-Alucinação)
const STRICT_SCORE_MINIMUM = 0.85;   // Abaixo disso, SEMPRE handoff no modo estrito
const STRICT_SIMILARITY_THRESHOLD = 0.80; // Artigos com menos de 80% são ignorados

// 🆕 Indicadores de incerteza/alucinação para validação pós-resposta
const HALLUCINATION_INDICATORS = [
  'não tenho certeza',
  'acredito que',
  'provavelmente',
  'geralmente',
  'pode ser que',
  'talvez',
  'é possível que',
  'me parece que',
  'suponho que',
  'imagino que'
];

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

// Helper: Determinar departamento por keywords (OTIMIZADO com regex e prioridade)
function pickDepartment(question: string): string {
  // Normalizar: lowercase + remover acentos para matching consistente
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Ordem de prioridade: Financeiro > Tecnico > Comercial > Logistica > Suporte
  const rules: Array<{ dept: string; patterns: RegExp }> = [
    { dept: 'financeiro', patterns: /saque|sacar|pix|reembolso|estorno|comiss[aã]o|dinheiro|pagamento|carteira|transfer[eê]ncia|boleto|fatura|cobran[cç]a|saldo|recarga|devolu[cç][aã]o|devolver|cancelamento|cancelar/ },
    { dept: 'tecnico', patterns: /erro|bug|login|senha|acesso|n[aã]o funciona|travou|caiu|site fora|api|integra[cç][aã]o|token|sistema|nao funciona|num funciona|tela branca|pagina nao carrega/ },
    { dept: 'comercial', patterns: /pre[cç]o|proposta|plano|quanto custa|comprar|assinar|desconto|trial|teste|orcamento|catalogo|tabela|upgrade|downgrade|mudar plano|conhecer|demonstra[cç][aã]o|demo/ },
    { dept: 'logistica', patterns: /envio|entrega|rastreio|transportadora|correios|prazo|encomenda|coleta|endereco|cep|frete/ },
  ];
  
  for (const rule of rules) {
    if (rule.patterns.test(q)) {
      console.log(`[pickDepartment] Departamento detectado: ${rule.dept} (match na query: "${question.slice(0, 50)}...")`);
      return rule.dept;
    }
  }
  
  console.log(`[pickDepartment] Nenhum departamento específico detectado, usando suporte_n1`);
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
  
  // 🆕 FASE 4: Boost para matches semânticos fortes
  const hasSemanticMatch = documents.some(d => d.similarity && d.similarity > 0.8);
  if (hasSemanticMatch) {
    score += 0.1; // Boost de 10% para matches semânticos fortes
  }
  
  // 🆕 FASE 4: Penalidade para documentos muito antigos (> 6 meses)
  const now = Date.now();
  const hasVeryOldDoc = documents.some(d => {
    if (!d.updated_at) return false;
    const ageMs = now - new Date(d.updated_at).getTime();
    return ageMs > 180 * 24 * 60 * 60 * 1000; // 180 dias
  });
  if (hasVeryOldDoc) {
    score -= 0.1; // Penalidade de 10% para docs desatualizados
  }
  
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

  // Template de mensagem de sucesso do ticket (CONTEXTUAL) - ASYNC para buscar templates do banco
async function createTicketSuccessMessage(
  supabaseClient: any,
  ticketId: string, 
  issueType: string = 'financeiro', 
  orderId?: string,
  withdrawalData?: { amount?: number; cpf_last4?: string },
  ticketNumber?: string | null
): Promise<string> {
  // Usa ticket_number se disponível, senão fallback para UUID truncado
  const formattedId = ticketNumber || ticketId.slice(0, 8).toUpperCase();
  
  // FASE 5: Mensagem específica para SAQUE com dados coletados - buscar template
  if (issueType === 'saque' && withdrawalData?.amount) {
    const saqueTemplate = await getMessageTemplate(
      supabaseClient,
      'saque_sucesso',
      {
        ticket_id: formattedId,
        valor: withdrawalData.amount.toFixed(2),
        cpf_last4: withdrawalData.cpf_last4 || ''
      }
    );
    
    if (saqueTemplate) return saqueTemplate;
    
    // Fallback se template não existir
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
    // Handler de warmup rápido (sem processamento de IA)
    const bodyText = await req.text();
    const parsedBody = bodyText ? JSON.parse(bodyText) : {};
    
    if (parsedBody.warmup) {
      console.log('[ai-autopilot-chat] 🔥 Warmup ping received');
      return new Response(
        JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { conversationId, customerMessage, maxHistory = 10, customer_context }: AutopilotChatRequest = parsedBody;
    
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
    
    // 🆕 Chat Flow: variáveis para persona/KB específicas do fluxo
    let flowPersonaId: string | null = null;
    let flowKbCategories: string[] | null = null;
    let flowContextPrompt: string | null = null;
    let flowFallbackMessage: string | null = null;

    // 🚨 FASE 3: Fallback Gracioso - Try-catch interno para capturar falhas da IA
    try {
      // 1. Buscar conversa e informações do contato (ANTES do cache)
      const { data: conversationData, error: convError } = await supabaseClient
        .from('conversations')
        .select(`
          *,
          contacts!inner(
            id, first_name, last_name, email, phone, whatsapp_id, company, status, document, kiwify_validated, kiwify_validated_at
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

      // 🛡️ ANTI-RACE-CONDITION: Verificar se handoff foi executado recentemente
      // Isso previne que múltiplas chamadas reprocessem a mesma conversa
      const handoffExecutedAt = conversation.handoff_executed_at;
      if (handoffExecutedAt) {
        const handoffAgeMs = Date.now() - new Date(handoffExecutedAt).getTime();
        const HANDOFF_PROTECTION_WINDOW_MS = 60000; // 60 segundos de proteção
        
        if (handoffAgeMs < HANDOFF_PROTECTION_WINDOW_MS) {
          console.log('[ai-autopilot-chat] ⏸️ Handoff recente detectado (' + Math.round(handoffAgeMs/1000) + 's atrás) - IGNORANDO para prevenir race condition');
          return new Response(
            JSON.stringify({ 
              skipped: true, 
              reason: 'recent_handoff',
              handoff_age_seconds: Math.round(handoffAgeMs/1000)
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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

    // 🆕 FASE KIWIFY: Validação automática por número Kiwify (antes do cache!)
    // Se contato não tem email, tentar identificar automaticamente via compra Kiwify
    const contactHasEmailForKiwify = contact.email && contact.email.trim() !== '';
    
    if (!contactHasEmailForKiwify && (contact.phone || contact.whatsapp_id)) {
      console.log('[ai-autopilot-chat] 🔍 Tentando validação automática via Kiwify...');
      
      try {
        const { data: kiwifyValidation, error: kiwifyError } = await supabaseClient.functions.invoke(
          'validate-by-kiwify-phone',
          { 
            body: { 
              phone: contact.phone,
              whatsapp_id: contact.whatsapp_id,
              contact_id: contact.id 
            } 
          }
        );

        if (!kiwifyError && kiwifyValidation?.found) {
          console.log(`[ai-autopilot-chat] ✅ Cliente IDENTIFICADO via Kiwify!`, {
            name: kiwifyValidation.customer?.name,
            email: kiwifyValidation.customer?.email,
            products: kiwifyValidation.customer?.products?.length
          });

          // Atualizar contato local com email da Kiwify para continuar o fluxo
          contact.email = kiwifyValidation.customer?.email;
          contact.status = 'customer';

          // 🎉 Enviar mensagem de boas-vindas personalizada
          const welcomeProducts = kiwifyValidation.customer?.products?.slice(0, 3).map((p: string) => `• ${p}`).join('\n') || '';
          const welcomeMessage = `Olá, ${kiwifyValidation.customer?.name?.split(' ')[0] || 'cliente'}! 🎉

Identificamos você automaticamente pelo seu número de WhatsApp.

📦 *Seus produtos:*
${welcomeProducts}

Como posso ajudar você hoje?`;

          // Salvar mensagem de boas-vindas
          const { data: welcomeMsgData } = await supabaseClient
            .from("messages")
            .insert({
              conversation_id: conversationId,
              content: welcomeMessage,
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

          // Se WhatsApp, enviar via API correta (Meta ou Evolution)
          if (responseChannel === 'whatsapp' && welcomeMsgData) {
            const whatsappResult = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id,
              conversation // passar dados da conversa para detectar provider
            );

            if (whatsappResult) {
              const sendResult = await sendWhatsAppMessage(
                supabaseClient,
                whatsappResult,
                contact.phone,
                welcomeMessage,
                conversationId,
                contact.whatsapp_id
              );

              if (sendResult.success) {
                await supabaseClient
                  .from('messages')
                  .update({ status: 'sent' })
                  .eq('id', welcomeMsgData.id);
              }
            }
          }

          // Continuar processamento normal (agora com email identificado)
          console.log('[ai-autopilot-chat] ✅ Continuando com cliente identificado via Kiwify');
        } else {
          console.log('[ai-autopilot-chat] ℹ️ Nenhuma compra Kiwify encontrada para este número');
        }
      } catch (kiwifyErr) {
        console.warn('[ai-autopilot-chat] ⚠️ Erro na validação Kiwify (não crítico):', kiwifyErr);
        // Não falhar o fluxo principal se Kiwify falhar
      }
    }

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
          
          // 🛡️ ANTI-RACE-CONDITION: Marcar handoff com timestamp
          const handoffTimestamp = new Date().toISOString();
          
          // 1. Mudar modo para waiting_human (NÃO copilot!) e marcar timestamp
          await supabaseClient
            .from('conversations')
            .update({ 
              ai_mode: 'waiting_human', // 🆕 waiting_human para ficar na fila
              handoff_executed_at: handoffTimestamp, // 🆕 Anti-race-condition flag
              needs_human_review: true
            })
            .eq('id', conversationId);
          
          console.log('[CACHE] ✅ Handoff executado com timestamp:', handoffTimestamp);
          
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
          
          // Se for WhatsApp, enviar via API correta (Meta ou Evolution)
          if (responseChannel === 'whatsapp' && handoffMessageData) {
            const whatsappResult = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id,
              conversation
            );

            if (whatsappResult) {
              const sendResult = await sendWhatsAppMessage(
                supabaseClient,
                whatsappResult,
                contact.phone,
                handoffMessage,
                conversationId,
                contact.whatsapp_id
              );

              if (sendResult.success) {
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

        // Se for WhatsApp, enviar via API correta (Meta ou Evolution)
        if (responseChannel === 'whatsapp') {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );

          if (whatsappResult && aiMessageData) {
            console.log('[ai-autopilot-chat] 📤 Enviando resposta cached via WhatsApp');

            const sendResult = await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              cachedResponse.answer,
              conversationId,
              contact.whatsapp_id
            );

            if (sendResult.success) {
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
    
    // ============================================================
    // 🆕 PRIORIDADE 1: CHAT FLOW - Verificar ANTES da triagem
    // ============================================================
    let flowProcessedEarly = false;
    let flowPersonaId: string | null = null;
    let flowKbCategories: string[] | null = null;
    let flowContextPrompt: string | null = null;
    let flowFallbackMessage: string | null = null;
    
    try {
      console.log('[ai-autopilot-chat] 🔄 [PRIORIDADE] Verificando Chat Flow ANTES da triagem...');
      
      const { data: flowResult, error: flowError } = await supabaseClient.functions.invoke(
        'process-chat-flow',
        { body: { conversationId, userMessage: customerMessage } }
      );
      
      if (!flowError && flowResult) {
        console.log('[ai-autopilot-chat] 📋 Resultado do Chat Flow (early check):', {
          useAI: flowResult.useAI,
          hasResponse: !!flowResult.response,
          flowStarted: flowResult.flowStarted,
          transfer: flowResult.transfer
        });
        
        // Se o fluxo retornou uma resposta determinística (não precisa de IA)
        if (flowResult.useAI === false && flowResult.response) {
          console.log('[ai-autopilot-chat] ✅ Chat Flow MATCH - Ignorando triagem!');
          flowProcessedEarly = true;
          
          // 🆕 TRANSFER NODE: Se é uma transferência, executar handoff real
          if (flowResult.transfer === true && flowResult.departmentId) {
            console.log('[ai-autopilot-chat] 🔀 TRANSFER NODE - Executando handoff real para departamento:', flowResult.departmentId);
            
            const handoffTimestamp = new Date().toISOString();
            
            const { error: handoffUpdateError } = await supabaseClient
              .from('conversations')
              .update({ 
                ai_mode: 'waiting_human',
                handoff_executed_at: handoffTimestamp,
                needs_human_review: true,
                department: flowResult.departmentId,
              })
              .eq('id', conversationId);
            
            if (handoffUpdateError) {
              console.error('[ai-autopilot-chat] ❌ Erro ao marcar handoff:', handoffUpdateError);
            } else {
              console.log('[ai-autopilot-chat] ✅ Conversa marcada como waiting_human com department:', flowResult.departmentId);
            }
            
            // Chamar route-conversation para distribuir para agentes
            try {
              const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
                body: { 
                  conversationId,
                  targetDepartmentId: flowResult.departmentId
                }
              });
              
              if (routeError) {
                console.error('[ai-autopilot-chat] ❌ Erro ao rotear conversa:', routeError);
              } else {
                console.log('[ai-autopilot-chat] ✅ Conversa roteada com sucesso:', routeResult);
              }
            } catch (routeErr) {
              console.error('[ai-autopilot-chat] ❌ Exceção ao chamar route-conversation:', routeErr);
            }
          }
          
          // Salvar resposta do fluxo
          const { data: flowMsgData } = await supabaseClient
            .from("messages")
            .insert({
              conversation_id: conversationId,
              content: flowResult.response,
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
          
          // Se WhatsApp, enviar via API correta
          if (responseChannel === 'whatsapp' && flowMsgData && contact?.phone) {
            const whatsappResult = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id,
              conversation
            );

            if (whatsappResult) {
              await sendWhatsAppMessage(
                supabaseClient,
                whatsappResult,
                contact.phone,
                flowResult.response,
                conversationId,
                contact.whatsapp_id
              );
            }
          }
          
          // Retornar resposta do fluxo - BYPASS TOTAL DA TRIAGEM
          return new Response(
            JSON.stringify({
              response: flowResult.response,
              messageId: flowMsgData?.id,
              source: 'chat_flow_early',
              flowId: flowResult.flowId,
              options: flowResult.options,
              transfer: flowResult.transfer || false,
              departmentId: flowResult.departmentId || null,
              debug: {
                reason: 'chat_flow_priority_match',
                bypassed_triage: true
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Se o fluxo precisa de IA, popular variáveis para uso posterior
        if (flowResult.useAI === true) {
          flowPersonaId = flowResult.personaId || null;
          flowKbCategories = flowResult.kbCategories || null;
          flowContextPrompt = flowResult.contextPrompt || null;
          flowFallbackMessage = flowResult.fallbackMessage || null;
          
          console.log('[ai-autopilot-chat] 🎯 Chat Flow definiu configurações para IA (early):', {
            personaId: flowPersonaId,
            kbCategories: flowKbCategories,
            hasContextPrompt: !!flowContextPrompt
          });
        }
      }
    } catch (flowError) {
      console.error('[ai-autopilot-chat] ⚠️ Erro ao processar Chat Flow (early check):', flowError);
    }
    
    // ============================================================
    // 🎯 TRIAGEM INTELIGENTE: Só executa se Chat Flow não processou
    // ============================================================
    const conversationMetadataForMenu = conversation.customer_metadata || {};
    const isAwaitingMenuChoice = conversationMetadataForMenu.awaiting_menu_choice === true;
    
    // 🆕 FASE 1: Contador de lembretes para evitar loop infinito
    const menuReminderCount = (conversationMetadataForMenu.menu_reminder_count as number) || 0;
    const MAX_MENU_REMINDERS = 3; // Máximo de lembretes antes de pular triagem
    
    // 🆕 FASE 2: Detectar se mensagem tem intenção clara (pular triagem)
    const hasSpecificIntent = customerMessage.length > 30 || 
      /promo[çc][ãa]o|oferta|desconto|pre[çc]o|quanto custa|comprar|pre.?carnaval|email|indicac|parceria|revenda|orcamento|orçamento|catalogo|catálogo|tabela|atacado|representante/i.test(customerMessage);
    
    // 🆕 FASE 3: Verificar se é referência contextual (veio de campanha/email)
    const isFromCampaign = /vim (pelo|por|do) (email|link|site|campanha|instagram|face|whats)|indicac|parceria|representante/i.test(customerMessage);
    
    // Regex para detectar escolha do menu
    const menuChoiceRegex = /^(1|2|pedido[s]?|sistema|suporte\s*(pedido|sistema)?)[\s!.]*$/i;
    const menuChoice = customerMessage.trim().match(menuChoiceRegex);
    
    // IDs dos departamentos de triagem
    const DEPT_SUPORTE_PEDIDOS = '2dd0ee5c-fd20-44be-94ad-f83f1be1c4e9';
    const DEPT_SUPORTE_SISTEMA = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4';
    const DEPT_COMERCIAL = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
    
    // Se cliente IDENTIFICADO está escolhendo departamento do menu
    if (menuChoice && contact.email && isAwaitingMenuChoice) {
      const choice = menuChoice[1].toLowerCase();
      const isPedidos = choice === '1' || choice.includes('pedido');
      const isSistema = choice === '2' || choice.includes('sistema');
      
      if (isPedidos || isSistema) {
        const targetDeptId = isPedidos ? DEPT_SUPORTE_PEDIDOS : DEPT_SUPORTE_SISTEMA;
        const targetDeptName = isPedidos ? 'Suporte Pedidos' : 'Suporte Sistema';
        
        console.log(`[ai-autopilot-chat] 🎯 TRIAGEM: Cliente escolheu ${targetDeptName}`, {
          choice: choice,
          department_id: targetDeptId,
          contact_email: contact.email
        });
        
        // Atualizar departamento da conversa e limpar flag de menu
        await supabaseClient.from('conversations')
          .update({ 
            department: targetDeptId,
            customer_metadata: {
              ...conversationMetadataForMenu,
              awaiting_menu_choice: false,
              department_selected: targetDeptName,
              department_selected_at: new Date().toISOString()
            }
          })
          .eq('id', conversationId);
        
        // Buscar template de confirmação
        const templateKey = isPedidos ? 'direcionado_suporte_pedidos' : 'direcionado_suporte_sistema';
        let confirmMessage = await getMessageTemplate(supabaseClient, templateKey, {});
        
        if (!confirmMessage) {
          confirmMessage = isPedidos 
            ? 'Entendi! Estou te direcionando para o time de **Suporte de Pedidos**. 📦\n\nComo posso ajudar com seu pedido?'
            : 'Entendi! Estou te direcionando para o time de **Suporte Técnico**. 💻\n\nQual é sua dúvida ou problema?';
        }
        
        // Salvar mensagem de confirmação
        const { data: savedMsg } = await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: confirmMessage,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        }).select().single();
        
        // Atualizar last_message_at
        await supabaseClient.from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);
        
        // Enviar via WhatsApp se necessário (Meta ou Evolution)
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              confirmMessage,
              conversationId,
              contact.whatsapp_id
            );
          }
        }
        
        // Registrar nota interna
        await supabaseClient.from('interactions').insert({
          customer_id: contact.id,
          type: 'internal_note',
          content: `🎯 **Triagem Inteligente** - Cliente escolheu: ${targetDeptName}`,
          channel: responseChannel
        });
        
        // RETURN EARLY - Triagem concluída
        return new Response(JSON.stringify({
          status: 'triage_complete',
          message: confirmMessage,
          department: targetDeptName,
          department_id: targetDeptId,
          messageId: savedMsg?.id,
          debug: {
            reason: 'menu_choice_processed',
            choice: choice,
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Se cliente está aguardando escolha mas enviou outra coisa
    if (isAwaitingMenuChoice && !menuChoice && contact.email) {
      
      // 🆕 ESCAPE 1: Se mensagem tem intenção clara ou veio de campanha, pular triagem
      if (hasSpecificIntent || isFromCampaign) {
        console.log('[ai-autopilot-chat] 🎯 BYPASS TRIAGEM: Detectada intenção específica', {
          hasSpecificIntent,
          isFromCampaign,
          messagePreview: customerMessage.substring(0, 50)
        });
        
        // Limpar flag e continuar processamento normal
        await supabaseClient.from('conversations')
          .update({
            customer_metadata: {
              ...conversationMetadataForMenu,
              awaiting_menu_choice: false,
              menu_reminder_count: 0,
              triage_bypassed: true,
              triage_bypass_reason: hasSpecificIntent ? 'specific_intent' : 'campaign_reference'
            }
          })
          .eq('id', conversationId);
        
        // NÃO fazer return - deixar continuar para processamento da IA
        console.log('[ai-autopilot-chat] 🎯 Continuando para processamento da IA...');
      }
      // 🆕 ESCAPE 2: Se já enviou muitos lembretes, parar e processar com IA
      else if (menuReminderCount >= MAX_MENU_REMINDERS) {
        console.log('[ai-autopilot-chat] 🎯 BYPASS TRIAGEM: Limite de lembretes atingido (' + menuReminderCount + '/' + MAX_MENU_REMINDERS + ')');
        
        // Limpar flag e encaminhar para IA
        await supabaseClient.from('conversations')
          .update({
            customer_metadata: {
              ...conversationMetadataForMenu,
              awaiting_menu_choice: false,
              menu_reminder_count: 0,
              triage_bypassed: true,
              triage_bypass_reason: 'max_reminders_exceeded'
            }
          })
          .eq('id', conversationId);
        
        // NÃO fazer return - deixar continuar para processamento da IA
        console.log('[ai-autopilot-chat] 🎯 Continuando para processamento da IA após limite de lembretes...');
      }
      // COMPORTAMENTO ORIGINAL: Enviar lembrete (com contador)
      else {
        // Incrementar contador de lembretes
        await supabaseClient.from('conversations')
          .update({
            customer_metadata: {
              ...conversationMetadataForMenu,
              menu_reminder_count: menuReminderCount + 1
            }
          })
          .eq('id', conversationId);
        
        const reminderTemplate = await getMessageTemplate(supabaseClient, 'aguardando_escolha_departamento', {});
        const reminderMessage = reminderTemplate || 'Por favor, escolha uma das opções:\n\n**1** - Pedidos (entregas, rastreio, trocas)\n**2** - Sistema (acesso, dúvidas técnicas)';
        
        console.log('[ai-autopilot-chat] 🎯 TRIAGEM: Lembrete ' + (menuReminderCount + 1) + '/' + MAX_MENU_REMINDERS);
        
        // Salvar lembrete
        const { data: savedMsg } = await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: reminderMessage,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        }).select().single();
        
        // Enviar via WhatsApp se necessário (Meta ou Evolution)
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              reminderMessage,
              conversationId,
              contact.whatsapp_id
            );
          }
        }
        
        // RETURN EARLY - Lembrete enviado
        return new Response(JSON.stringify({
          status: 'awaiting_menu_choice',
          message: reminderMessage,
          reminder_count: menuReminderCount + 1,
          max_reminders: MAX_MENU_REMINDERS,
          messageId: savedMsg?.id,
          debug: {
            reason: 'menu_reminder_sent',
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ============================================================
    // 🔍 DETECÇÃO AUTOMÁTICA DE EMAIL NA MENSAGEM
    // Se cliente SEM email envia uma mensagem contendo email válido,
    // processamos automaticamente como identificação
    // ============================================================
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailInMessage = customerMessage.match(emailRegex)?.[0];
    
    if (emailInMessage && !contact.email) {
      console.log('[ai-autopilot-chat] 📧 EMAIL DETECTADO NA MENSAGEM (Lead sem email):', emailInMessage);
      
      try {
        // Chamar verify_customer_email automaticamente
        const { data: verifyResult, error: verifyError } = await supabaseClient.functions.invoke('verify-customer-email', {
          body: { 
            email: emailInMessage.toLowerCase().trim(),
            conversationId: conversationId,
            contactId: contact.id
          }
        });
        
        if (!verifyError && verifyResult) {
          console.log('[ai-autopilot-chat] ✅ Email processado automaticamente:', {
            email: emailInMessage,
            result: verifyResult.found ? 'found_in_db' : 'new_lead',
            otp_sent: verifyResult.otp_sent || false
          });
          
          // Montar resposta baseada no resultado
          const maskedEmailResponse = maskEmail(emailInMessage);
          let autoResponse = '';
          
          if (verifyResult.found) {
            // 🎯 TRIAGEM: Email encontrado = Cliente identificado (SEM OTP) → Menu de departamentos
            console.log('[ai-autopilot-chat] 🎯 TRIAGEM: Email encontrado - mostrando menu de departamentos');
            
            // Buscar template de confirmação com menu
            let foundMessage = await getMessageTemplate(
              supabaseClient,
              'confirmacao_email_encontrado',
              { contact_name: verifyResult.customer_name || contact.first_name || 'cliente' }
            );
            
            if (!foundMessage) {
              foundMessage = `Encontrei seu cadastro, ${verifyResult.customer_name || contact.first_name || 'cliente'}! 🎉\n\nAgora me diz: precisa de ajuda com:\n**1** - Pedidos\n**2** - Sistema`;
            }
            
            // Atualizar contato com email e marcar para escolha do menu
            await supabaseClient.from('contacts')
              .update({ 
                email: emailInMessage.toLowerCase().trim(),
                status: 'customer'
              })
              .eq('id', contact.id);
            
            // Marcar que estamos aguardando escolha do menu
            await supabaseClient.from('conversations')
              .update({
                customer_metadata: {
                  ...(conversation.customer_metadata || {}),
                  awaiting_menu_choice: true,
                  email_verified_at: new Date().toISOString()
                }
              })
              .eq('id', conversationId);
            
            autoResponse = foundMessage;
          } else if (!verifyResult.found) {
            // 🎯 TRIAGEM: Email não encontrado = Lead → Rotear para Comercial
            console.log('[ai-autopilot-chat] 🎯 TRIAGEM: Email não encontrado - roteando para Comercial');
            
            const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
            
            // Buscar template de lead direcionado
            let leadMessage = await getMessageTemplate(supabaseClient, 'lead_direcionado_comercial', {});
            if (!leadMessage) {
              leadMessage = 'Obrigado! Como você ainda não é nosso cliente, vou te direcionar para nosso time Comercial que poderá te ajudar. 🤝\n\nAguarde um momento que logo um de nossos consultores irá te atender!';
            }
            
            // Atualizar conversa: departamento = Comercial, ai_mode = waiting_human
            await supabaseClient.from('conversations')
              .update({ 
                department: DEPT_COMERCIAL_ID,
                ai_mode: 'waiting_human',
                customer_metadata: {
                  ...(conversation.customer_metadata || {}),
                  lead_email_checked: emailInMessage.toLowerCase().trim(),
                  lead_routed_to_comercial_at: new Date().toISOString()
                }
              })
              .eq('id', conversationId);
            
            // Rotear para agente comercial
            await supabaseClient.functions.invoke('route-conversation', {
              body: { conversationId, department_id: DEPT_COMERCIAL_ID }
            });
            
            // Registrar nota interna
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'internal_note',
              content: `🎯 **Lead Novo - Roteado para Comercial**\n\nEmail informado: ${maskedEmailResponse}\nMotivo: Email não encontrado na base de clientes`,
              channel: responseChannel
            });
            
            autoResponse = leadMessage;
          } else {
            // Fallback: email processado mas sem ação clara
            autoResponse = `Obrigado! Estou verificando seu email **${maskedEmailResponse}**...`;
          }
          
          // Salvar resposta
          const { data: savedMsg } = await supabaseClient
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: autoResponse,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            })
            .select()
            .single();
          
          // Enviar via WhatsApp se necessário (Meta ou Evolution)
          if (responseChannel === 'whatsapp' && contact?.phone) {
            const whatsappResult = await getWhatsAppInstanceForConversation(
              supabaseClient, 
              conversationId, 
              conversation.whatsapp_instance_id,
              conversation
            );
            
            if (whatsappResult) {
              await sendWhatsAppMessage(
                supabaseClient,
                whatsappResult,
                contact.phone,
                autoResponse,
                conversationId,
                contact.whatsapp_id
              );
            }
          }
          
          // RETURN EARLY - Email processado, não chamar IA
          return new Response(JSON.stringify({
            response: autoResponse,
            messageId: savedMsg?.id,
            emailDetected: emailInMessage,
            emailProcessed: true,
            debug: {
              reason: 'auto_email_detection_bypass',
              email_found_in_db: verifyResult.found,
              otp_sent: verifyResult.otp_sent || false,
              bypassed_ai: true
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('[ai-autopilot-chat] ❌ Erro ao processar email detectado:', error);
        // Se falhar, continua para IA tentar lidar
      }
    }
    
    console.log(`[ai-autopilot-chat] Processando mensagem para conversa ${conversationId}...`);

    // ============================================================
    // 🆕 Chat Flow já foi verificado ANTES da triagem (linhas ~1203)
    // As variáveis flowPersonaId, flowKbCategories, etc. já estão populadas
    // ============================================================

    // 2. Buscar persona baseado em routing rules (canal + departamento)
    // 🆕 OU usar persona específica do Chat Flow (se flowPersonaId estiver definido)
    let persona: any = null;
    
    if (flowPersonaId) {
      // 🆕 Chat Flow: Buscar persona específica definida no nó ai_response
      console.log('[ai-autopilot-chat] 🎯 Usando persona do Chat Flow:', flowPersonaId);
      
      const { data: flowPersona, error: personaError } = await supabaseClient
        .from('ai_personas')
        .select('id, name, role, system_prompt, temperature, max_tokens, knowledge_base_paths, is_active, use_priority_instructions, data_access')
        .eq('id', flowPersonaId)
        .eq('is_active', true)
        .single();
      
      if (!personaError && flowPersona) {
        persona = flowPersona;
        console.log(`[ai-autopilot-chat] ✅ Persona do fluxo carregada: ${persona.name}`);
      } else {
        console.warn('[ai-autopilot-chat] ⚠️ Persona do fluxo não encontrada, usando routing rules');
      }
    }
    
    // Fallback: usar routing rules se não tem persona do fluxo
    if (!persona) {
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

      persona = selectedRule.ai_personas as any;
    }
    
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
    
    // ============================================================
    // 🎯 MODO RAG ESTRITO - OpenAI GPT-4o Exclusivo (Anti-Alucinação)
    // ============================================================
    // Quando ativo: usa APENAS OpenAI GPT-4o, sem fallback, com thresholds rígidos
    // Cita fontes explicitamente e recusa responder quando não tem informação
    // ============================================================
    interface StrictRAGResult {
      shouldHandoff: boolean;
      reason: string | null;
      response: string | null;
      citedArticles?: string[];
    }
    
    async function callStrictRAG(
      supabaseClient: any,
      customerMessage: string,
      knowledgeArticles: any[],
      contactName: string,
      openaiApiKey: string
    ): Promise<StrictRAGResult> {
      console.log('[callStrictRAG] 🎯 Iniciando RAG Estrito com GPT-4o');
      
      // Filtrar apenas artigos com alta confiança (≥80%)
      const highConfidenceArticles = knowledgeArticles.filter(
        (a: any) => (a.similarity || 0) >= STRICT_SIMILARITY_THRESHOLD
      );
      
      console.log('[callStrictRAG] 📊 Artigos filtrados:', {
        total: knowledgeArticles.length,
        highConfidence: highConfidenceArticles.length,
        threshold: STRICT_SIMILARITY_THRESHOLD
      });
      
      // Se não houver artigos de alta confiança, handoff imediato
      if (highConfidenceArticles.length === 0) {
        return {
          shouldHandoff: true,
          reason: 'Nenhum artigo com confiança >= 80% na base de conhecimento',
          response: null
        };
      }
      
      // Prompt enxuto e focado para RAG estrito
      const strictPrompt = `Você é um assistente de suporte que APENAS responde com base nos documentos fornecidos.

REGRAS ABSOLUTAS:
1. NUNCA invente informações que não estejam nos documentos abaixo
2. Se a resposta não estiver nos documentos, diga EXATAMENTE: "Não encontrei essa informação na base de conhecimento. Posso te conectar com um especialista?"
3. Sempre cite a fonte: "De acordo com [título do artigo]..."
4. Mantenha respostas concisas (máximo 150 palavras)
5. Seja direto e objetivo

DOCUMENTOS DISPONÍVEIS:
${highConfidenceArticles.map((a: any) => `### ${a.title} (${((a.similarity || 0) * 100).toFixed(0)}% relevância)
${a.content}`).join('\n\n---\n\n')}`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o', // Modelo mais preciso (não gpt-4o-mini)
            messages: [
              { role: 'system', content: strictPrompt },
              { role: 'user', content: `${contactName}: ${customerMessage}` }
            ],
            temperature: 0.3, // Baixa criatividade = alta fidelidade à KB
            max_tokens: 400
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[callStrictRAG] ❌ OpenAI GPT-4o falhou:', response.status, errorText);
          throw new Error(`OpenAI strict RAG failed: ${response.status}`);
        }
        
        const data = await response.json();
        const aiMessage = data.choices?.[0]?.message?.content || '';
        
        console.log('[callStrictRAG] 📝 Resposta GPT-4o recebida:', aiMessage.substring(0, 100) + '...');
        
        // Validação pós-geração: detectar indicadores de incerteza/alucinação
        const hasUncertainty = HALLUCINATION_INDICATORS.some(
          indicator => aiMessage.toLowerCase().includes(indicator)
        );
        
        if (hasUncertainty) {
          console.log('[callStrictRAG] ⚠️ Incerteza detectada na resposta - forçando handoff');
          return {
            shouldHandoff: true,
            reason: 'IA expressou incerteza na resposta gerada',
            response: aiMessage
          };
        }
        
        // Verificar se a IA indicou que não encontrou informação
        const notFoundPatterns = [
          'não encontrei essa informação',
          'não encontrei na base',
          'não tenho essa informação',
          'posso te conectar com um especialista'
        ];
        
        const notFoundInKB = notFoundPatterns.some(
          pattern => aiMessage.toLowerCase().includes(pattern)
        );
        
        if (notFoundInKB) {
          console.log('[callStrictRAG] 📭 IA indicou que não encontrou informação - handoff');
          return {
            shouldHandoff: true,
            reason: 'Informação não encontrada na base de conhecimento (IA reconheceu)',
            response: aiMessage
          };
        }
        
        console.log('[callStrictRAG] ✅ Resposta validada com sucesso');
        return {
          shouldHandoff: false,
          reason: null,
          response: aiMessage,
          citedArticles: highConfidenceArticles.map((a: any) => a.title)
        };
        
      } catch (error) {
        console.error('[callStrictRAG] ❌ Erro no RAG estrito:', error);
        // Em modo estrito, erro = handoff (não fallback para outro modelo)
        return {
          shouldHandoff: true,
          reason: `Erro no processamento RAG: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          response: null
        };
      }
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
        // FASE 1: Verificar categorias específicas configuradas
        // 🆕 Chat Flow: priorizar categorias do fluxo sobre as da persona
        let activeKbCategories: string[] = [];
        let categorySource = 'ALL (sem filtro)';
        
        const flowCats = flowKbCategories as string[] | null;
        const personaCats = persona.knowledge_base_paths as string[] | null;
        
        if (flowCats && Array.isArray(flowCats) && flowCats.length > 0) {
          // Categorias definidas no nó ai_response do Chat Flow
          activeKbCategories = flowCats;
          categorySource = `Chat Flow (${flowCats.length} categorias)`;
        } else if (personaCats && Array.isArray(personaCats) && personaCats.length > 0) {
          // Fallback: categorias da persona
          activeKbCategories = personaCats;
          categorySource = `Persona (${personaCats.length} categorias)`;
        }
        
        const hasPersonaCategories = activeKbCategories.length > 0;
      
        console.log('[ai-autopilot-chat] 📂 KB Categories:', {
          persona_id: persona.id,
          persona_name: persona.name,
          flow_categories: flowKbCategories,
          persona_categories: persona.knowledge_base_paths,
          active_categories: hasPersonaCategories ? activeKbCategories : 'ALL',
          category_source: categorySource
        });
        
        // 🆕 Alias para compatibilidade com código existente
        const personaCategories = activeKbCategories;
      
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
                  
                  // Buscar artigos similares - FASE 5: Threshold aumentado para reduzir alucinações
                  const { data: semanticResults, error: semanticError } = await supabaseClient.rpc(
                    'match_knowledge_articles',
                    {
                      query_embedding: queryEmbedding,
                      match_threshold: 0.70, // Antes: 0.50 - Só retorna artigos realmente relevantes
                      match_count: 3,        // Antes: 5 - Menos artigos, mais qualidade
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

    // 5. FASE 1: Identity Wall - Verificar se contato tem email OU é cliente Kiwify validado
    const contactEmail = customer_context?.email || contact.email;
    const contactHasEmail = !!contactEmail;
    const contactName = customer_context?.name || `${contact.first_name} ${contact.last_name}`.trim();
    const contactCompany = contact.company ? ` da empresa ${contact.company}` : '';
    const contactStatus = contact.status || 'lead';
    
    // 🆕 CORREÇÃO: Cliente é "conhecido" se tem email OU se foi validado via Kiwify OU se está na base como customer
    const isKiwifyValidated = contact.kiwify_validated === true;
    const isCustomerInDatabase = contact.status === 'customer';
    // 🆕 Cliente identificado pelo telefone (webhook já verificou que existe no banco)
    const isPhoneVerified = customer_context?.isVerified === true;
    const isValidatedCustomer = contactHasEmail || isKiwifyValidated || isCustomerInDatabase || isPhoneVerified;
    
    // 🔐 LGPD: Dados mascarados para exposição à IA
    const safeEmail = maskEmail(contactEmail);
    const safePhone = maskPhone(contact.phone);
    
    console.log('[ai-autopilot-chat] 🔐 Identity Wall Check:', {
      hasEmail: contactHasEmail,
      isKiwifyValidated: isKiwifyValidated,
      isCustomerInDatabase: isCustomerInDatabase,
      isPhoneVerified: isPhoneVerified,
      isValidatedCustomer: isValidatedCustomer,
      email: safeEmail,
      channel: responseChannel,
      contactStatus: contact.status
    });
    
    // 🆕 CORREÇÃO: Se é cliente validado mas status não é 'customer', atualizar
    if (isValidatedCustomer && contact.status !== 'customer') {
      console.log('[ai-autopilot-chat] 🔄 Atualizando status para customer...');
      await supabaseClient
        .from('contacts')
        .update({ status: 'customer' })
        .eq('id', contact.id);
    }
    
    // 🆕 CORREÇÃO: Cliente validado vai para SUPORTE, não Comercial
    const SUPORTE_DEPT_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
    if (isValidatedCustomer) {
      const { data: currentConv } = await supabaseClient
        .from('conversations')
        .select('department')
        .eq('id', conversationId)
        .single();
      
      if (currentConv && currentConv.department !== SUPORTE_DEPT_ID) {
        console.log('[ai-autopilot-chat] 🏢 Movendo conversa para Suporte (cliente validado)');
        await supabaseClient
          .from('conversations')
          .update({ department: SUPORTE_DEPT_ID })
          .eq('id', conversationId);
      }
    }
    
    // ============================================================
    // 🎯 SISTEMA ANTI-ALUCINAÇÃO - VERIFICAÇÃO DE CONFIANÇA
    // ============================================================
    
    // 🆕 Buscar configuração do modo RAG estrito
    let isStrictRAGMode = false;
    try {
      const { data: strictModeConfig } = await supabaseClient
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_strict_rag_mode')
        .maybeSingle();
      
      isStrictRAGMode = strictModeConfig?.value === 'true';
      console.log('[ai-autopilot-chat] 🎯 Modo RAG Estrito:', isStrictRAGMode ? 'ATIVADO' : 'desativado');
    } catch (configError) {
      console.warn('[ai-autopilot-chat] ⚠️ Erro ao buscar config strict mode:', configError);
    }
    
    // ============================================================
    // 🆕 MODO RAG ESTRITO - Processamento exclusivo com GPT-4o
    // ============================================================
    if (isStrictRAGMode && OPENAI_API_KEY && knowledgeArticles.length > 0) {
      console.log('[ai-autopilot-chat] 🎯 STRICT RAG MODE ATIVO - Usando GPT-4o exclusivo');
      
      const strictResult = await callStrictRAG(
        supabaseClient,
        customerMessage,
        knowledgeArticles,
        contactName,
        OPENAI_API_KEY
      );
      
      if (strictResult.shouldHandoff) {
        console.log('[ai-autopilot-chat] 🚨 STRICT RAG: Handoff necessário -', strictResult.reason);
        
        // Executar handoff
        const handoffTimestamp = new Date().toISOString();
        await supabaseClient
          .from('conversations')
          .update({ 
            ai_mode: 'waiting_human',
            handoff_executed_at: handoffTimestamp,
            needs_human_review: true
          })
          .eq('id', conversationId);
        
        // Rotear para agente humano
        await supabaseClient.functions.invoke('route-conversation', {
          body: { conversationId }
        });
        
        // Mensagem padronizada de handoff para modo estrito
        const strictHandoffMessage = `Olá ${contactName}! Para te ajudar da melhor forma com essa questão específica, vou te conectar com um de nossos especialistas.\n\nUm momento, por favor.`;
        
        // Salvar mensagem
        await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: strictHandoffMessage,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        });
        
        // Enviar via WhatsApp se necessário
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              strictHandoffMessage,
              conversationId,
              contact.whatsapp_id,
              true
            );
          }
        }
        
        // Registrar nota interna
        await supabaseClient.from('interactions').insert({
          customer_id: contact.id,
          type: 'internal_note',
          content: `🎯 **Handoff via Modo RAG Estrito**\n\n**Motivo:** ${strictResult.reason}\n**Pergunta:** "${customerMessage}"\n\nModo anti-alucinação ativo - handoff executado por falta de informação confiável na KB.`,
          channel: responseChannel
        });
        
        // Log de qualidade
        await supabaseClient.from('ai_quality_logs').insert({
          conversation_id: conversationId,
          contact_id: contact.id,
          customer_message: customerMessage,
          ai_response: strictResult.response,
          action_taken: 'handoff',
          handoff_reason: strictResult.reason,
          confidence_score: 0,
          articles_count: knowledgeArticles.length
        });
        
        return new Response(JSON.stringify({
          status: 'strict_rag_handoff',
          message: strictHandoffMessage,
          reason: strictResult.reason,
          strict_mode: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Resposta validada - enviar ao cliente
      console.log('[ai-autopilot-chat] ✅ STRICT RAG: Resposta validada com fontes citadas');
      
      const strictResponse = strictResult.response!;
      
      // Salvar mensagem da IA
      const { data: strictMsgData } = await supabaseClient
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: strictResponse,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        })
        .select('id')
        .single();
      
      // Atualizar last_message_at
      await supabaseClient
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
      
      // Enviar via WhatsApp se necessário
      if (responseChannel === 'whatsapp' && contact?.phone && strictMsgData) {
        const whatsappResult = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation
        );
        
        if (whatsappResult) {
          const sendResult = await sendWhatsAppMessage(
            supabaseClient,
            whatsappResult,
            contact.phone,
            strictResponse,
            conversationId,
            contact.whatsapp_id
          );
          
          if (sendResult.success) {
            await supabaseClient
              .from('messages')
              .update({ status: 'sent' })
              .eq('id', strictMsgData.id);
          }
        }
      }
      
      // Log de qualidade para resposta bem-sucedida
      await supabaseClient.from('ai_quality_logs').insert({
        conversation_id: conversationId,
        contact_id: contact.id,
        customer_message: customerMessage,
        ai_response: strictResponse,
        action_taken: 'direct_response',
        confidence_score: 1, // Alto score por ter passado validação
        articles_count: knowledgeArticles.length,
        articles_used: strictResult.citedArticles
      });
      
      return new Response(JSON.stringify({
        status: 'success',
        message: strictResponse,
        strict_mode: true,
        cited_articles: strictResult.citedArticles
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ============================================================
    // FLUXO PADRÃO (modo estrito desativado ou sem artigos)
    // ============================================================
    const confidenceResult = calculateConfidenceScore(
      customerMessage,
      knowledgeArticles.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        category: a.category,
        similarity: a.similarity || 0.5,
        updated_at: undefined // Articles from query don't have updated_at
      }))
    );

    console.log('[ai-autopilot-chat] 🎯 CONFIDENCE SCORE:', {
      score: (confidenceResult.score * 100).toFixed(0) + '%',
      action: confidenceResult.action,
      reason: confidenceResult.reason,
      department: confidenceResult.department,
      components: confidenceResult.components,
      articlesCount: knowledgeArticles.length
    });

    // 🚨 HANDOFF AUTOMÁTICO POR BAIXA CONFIANÇA
    // FASE 5: Corrigido - Faz handoff baseado no SCORE, não na existência de artigos
    // Antes: só fazia handoff se knowledgeArticles.length === 0 (bug - ignorava artigos irrelevantes)
    const isSimpleGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|tá|ta|sim|não|nao)[\s!?.,]*$/i.test(customerMessage.trim());
    
    // 🆕 Detectar mensagens genéricas de "quero atendimento" (NÃO fazer handoff imediato)
    const isGenericContactRequest = /^(ol[aá]|oi|bom dia|boa tarde|boa noite)?[,!.\s]*(vim|cheguei|estou|preciso|quero|gostaria|queria|buscando|procurando).{0,50}(atendimento|ajuda|suporte|falar|contato|informação|informações|saber|conhecer|entender)/i.test(customerMessage.trim());
    
    // Buscar contagem de mensagens do cliente para determinar se é início de conversa
    const { count: customerMessagesCount } = await supabaseClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'contact');
    
    const isEarlyConversation = (customerMessagesCount || 0) <= 2;
    
    // 🆕 CONDIÇÃO EXPANDIDA: Não fazer handoff se for saudação OU contato genérico no início da conversa
    const shouldSkipHandoff = isSimpleGreeting || (isGenericContactRequest && isEarlyConversation);
    
    console.log('[ai-autopilot-chat] 🔍 Handoff check:', {
      isSimpleGreeting,
      isGenericContactRequest,
      isEarlyConversation,
      customerMessagesCount,
      shouldSkipHandoff,
      confidenceAction: confidenceResult.action
    });
    
    // 🆕 Responder com boas-vindas para mensagens de contato inicial (antes do handoff)
    if (isGenericContactRequest && isEarlyConversation && confidenceResult.action === 'handoff') {
      console.log('[ai-autopilot-chat] 👋 Mensagem de primeiro contato genérico detectada - respondendo com boas-vindas');
      
      // Usar template do banco ou fallback
      let welcomeMessage = await getMessageTemplate(
        supabaseClient,
        'primeiro_contato_boas_vindas',
        { contact_name: contactName || '' }
      );
      
      if (!welcomeMessage) {
        const firstName = contactName ? contactName.split(' ')[0] : '';
        welcomeMessage = `Olá${firstName ? `, ${firstName}` : ''}! 👋\n\nFicamos felizes com seu contato! Em que posso te ajudar hoje?`;
      }
      
      // Salvar mensagem
      await supabaseClient.from('messages').insert({
        conversation_id: conversationId,
        content: welcomeMessage,
        sender_type: 'user',
        is_ai_generated: true,
        channel: responseChannel
      });
      
      // 📤 ENVIAR PARA WHATSAPP (se for canal WhatsApp) - Meta ou Evolution
      if (responseChannel === 'whatsapp' && contact?.phone) {
        const whatsappResult = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation
        );
        
        if (whatsappResult) {
          console.log('[ai-autopilot-chat] 📤 Enviando boas-vindas via WhatsApp');
          await sendWhatsAppMessage(
            supabaseClient,
            whatsappResult,
            contact.phone,
            welcomeMessage,
            conversationId,
            contact.whatsapp_id,
            true
          );
        }
      }
      
      return new Response(JSON.stringify({
        status: 'success',
        message: welcomeMessage,
        type: 'welcome_greeting',
        reason: 'Generic contact request on early conversation - greeting instead of handoff'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (confidenceResult.action === 'handoff' && !shouldSkipHandoff) {
      console.log('[ai-autopilot-chat] 🚨 LOW CONFIDENCE HANDOFF - Score:', confidenceResult.score);
      
      // 🆕 VERIFICAÇÃO DE LEAD: Se não tem email E não é cliente → PEDIR EMAIL PRIMEIRO
      const isLeadWithoutEmail = !contactHasEmail && !isCustomerInDatabase && !isKiwifyValidated && !isPhoneVerified;
      const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
      const DEPT_SUPORTE_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
      
      console.log('[ai-autopilot-chat] 🎯 Handoff department decision:', {
        isLeadWithoutEmail,
        contactHasEmail,
        isCustomerInDatabase,
        isPhoneVerified,
        contactStatus: contact.status
      });
      
      // 🆕 NOVA LÓGICA: Lead sem email → NÃO fazer handoff, pedir email primeiro
      if (isLeadWithoutEmail) {
        console.log('[ai-autopilot-chat] 🔐 LEAD SEM EMAIL - Bloqueando handoff, pedindo email primeiro');
        
        // Usar template do banco ou fallback
        let askEmailMessage = await getMessageTemplate(
          supabaseClient,
          'identity_wall_ask_email',
          { contact_name: contactName || '' }
        );
        
        if (!askEmailMessage) {
          const firstName = contactName ? contactName.split(' ')[0] : '';
          askEmailMessage = `Olá${firstName ? `, ${firstName}` : ''}! 👋\n\nPara garantir um atendimento personalizado e seguro, preciso que você me informe seu email.`;
        }
        
        // Salvar mensagem pedindo email
        await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: askEmailMessage,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        });
        
        // Enviar via WhatsApp se for o canal (Meta ou Evolution)
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            console.log('[ai-autopilot-chat] 📤 Enviando pedido de email via WhatsApp');
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              askEmailMessage,
              conversationId,
              contact.whatsapp_id,
              true
            );
          }
        }
        
        // Atualizar metadata para rastrear que estamos aguardando email
        await supabaseClient.from('conversations')
          .update({
            customer_metadata: {
              ...(conversation.customer_metadata || {}),
              awaiting_email_for_handoff: true,
              handoff_blocked_at: new Date().toISOString(),
              handoff_blocked_reason: 'low_confidence_lead_without_email'
            }
          })
          .eq('id', conversationId);
        
        console.log('[ai-autopilot-chat] ✅ Handoff bloqueado - aguardando email do lead');
        
        // RETORNAR SEM FAZER HANDOFF - Aguardar email
        return new Response(JSON.stringify({
          status: 'awaiting_email',
          message: askEmailMessage,
          reason: 'Lead sem email - solicitando identificacao antes do handoff',
          confidence_score: confidenceResult.score
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // ✅ Cliente identificado → Continuar com handoff normal para Suporte
      const handoffDepartment = confidenceResult.department || DEPT_SUPORTE_ID;
      
      console.log('[ai-autopilot-chat] ✅ Cliente identificado - handoff para Suporte');
      
      // 🛡️ Atualizar ai_mode para waiting_human E marcar timestamp anti-race-condition
      const handoffTimestamp = new Date().toISOString();
      await supabaseClient
        .from('conversations')
        .update({ 
          ai_mode: 'waiting_human',
          last_message_at: handoffTimestamp,
          handoff_executed_at: handoffTimestamp,
          department: handoffDepartment
        })
        .eq('id', conversationId);
      
      console.log('[ai-autopilot-chat] ✅ Handoff marcado com timestamp:', handoffTimestamp);
      
      // Rotear para agente COM DEPARTAMENTO EXPLÍCITO
      const { data: routeResult } = await supabaseClient.functions.invoke('route-conversation', {
        body: { 
          conversationId, 
          department_id: handoffDepartment 
        }
      });
      
      // Mensagem para cliente identificado
      const handoffMessage = `Olá ${contactName}! Para te ajudar melhor com essa questão, vou te conectar com um de nossos especialistas. Um momento, por favor.`;
      
      // Salvar mensagem
      await supabaseClient.from('messages').insert({
        conversation_id: conversationId,
        content: handoffMessage,
        sender_type: 'user',
        is_ai_generated: true,
        channel: responseChannel
      });
      
      // 📤 ENVIAR PARA WHATSAPP (se for canal WhatsApp) - Meta ou Evolution
      if (responseChannel === 'whatsapp' && contact?.phone) {
        const whatsappResult = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation
        );
        
        if (whatsappResult) {
          console.log('[ai-autopilot-chat] 📤 Enviando mensagem de handoff via WhatsApp');
          const sendResult = await sendWhatsAppMessage(
            supabaseClient,
            whatsappResult,
            contact.phone,
            handoffMessage,
            conversationId,
            contact.whatsapp_id,
            true
          );
          
          if (!sendResult.success) {
            console.error('[ai-autopilot-chat] ❌ Erro ao enviar handoff via WhatsApp:', sendResult.error);
          } else {
            console.log('[ai-autopilot-chat] ✅ Handoff enviado via WhatsApp');
          }
        }
      }
      
      // Registrar nota interna
      await supabaseClient.from('interactions').insert({
        customer_id: contact.id,
        type: 'internal_note',
        content: `🎯 **Handoff Automático por Baixa Confiança**

**Score:** ${(confidenceResult.score * 100).toFixed(0)}%
**Motivo:** ${confidenceResult.reason}
**Departamento:** 🎧 Suporte (Cliente identificado)
**Pergunta do Cliente:** "${customerMessage}"

**Ação:** IA não tinha informações suficientes na base de conhecimento para responder com segurança.`,
        channel: responseChannel,
        metadata: {
          source: 'ai_confidence_handoff',
          confidence_score: confidenceResult.score,
          confidence_action: confidenceResult.action,
          confidence_reason: confidenceResult.reason,
          is_lead_without_email: false,
          routed_to_department: 'suporte'
        }
      });
      
      // Retornar resposta de handoff
      return new Response(JSON.stringify({
        status: 'handoff',
        message: handoffMessage,
        reason: confidenceResult.reason,
        score: confidenceResult.score,
        routed_to: routeResult?.assigned_to || null,
        department: 'suporte'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
    
    // ============================================================
    // 🎯 DECISION MATRIX - Log unificado para debugging de fluxo
    // ============================================================
    // 🆕 OTP apenas para contexto FINANCEIRO quando cliente NÃO tem email verificado
    const needsOTPForFinancial = isFinancialRequest && !contactHasEmail && isValidatedCustomer;
    const willAskForEmail = !isValidatedCustomer; // Só pede email se não for cliente conhecido
    const willSendOTP = contactHasEmail && !hasEverVerifiedOTP;
    const willAskFinancialOTP = contactHasEmail && hasEverVerifiedOTP && isFinancialRequest && !hasRecentOTPVerification;
    const willProcessNormally = isValidatedCustomer && !isFinancialRequest;
    
    console.log('[ai-autopilot-chat] 🎯 DECISION MATRIX:', {
      // Inputs
      contactHasEmail,
      isCustomerInDatabase,
      isKiwifyValidated,
      hasEverVerifiedOTP,
      hasRecentOTPVerification,
      isFinancialRequest,
      // Outputs (decisions)
      willAskForEmail,
      willSendOTP,
      willAskFinancialOTP,
      willProcessNormally,
      needsOTPForFinancial,
      // Context
      customer_name: contactName,
      customer_email: safeEmail,
      message_preview: customerMessage.substring(0, 50)
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
    
    // 🎯 BYPASS DA IA: Saudação Direta na PRIMEIRA MENSAGEM da SESSÃO
    // Usar 'messages' (dados originais do DB) em vez de 'messageHistory' (já convertido)
    const rawMessages = messages || [];
    
    // Detectar "primeira mensagem desta sessão" (após fechamento ou início)
    const lastSystemCloseIndex = rawMessages.findIndex(m => 
      m.sender_type === 'system' && 
      (m.content?.includes('encerrada') || m.content?.includes('arquivada') || m.content?.includes('fechada'))
    );
    
    // Mensagens desde o último fechamento (ou todas se não houver fechamento)
    const messagesAfterClose = lastSystemCloseIndex >= 0 
      ? rawMessages.slice(0, lastSystemCloseIndex) 
      : rawMessages;
    
    // É primeira mensagem da sessão se:
    // 1. Só tem 1 mensagem após o fechamento, OU
    // 2. IA ainda não respondeu nesta sessão (só mensagens de contato ou system)
    const aiHasRespondedInSession = messagesAfterClose.some(m => 
      m.sender_type === 'user' // 'user' no DB = humano ou IA (não 'contact')
    );
    const isFirstMessageOfSession = messagesAfterClose.length <= 1 || !aiHasRespondedInSession;
    
    console.log('[ai-autopilot-chat] 🔍 Session detection:', {
      totalMessages: rawMessages.length,
      lastSystemCloseIndex,
      messagesAfterClose: messagesAfterClose.length,
      aiHasRespondedInSession,
      isFirstMessageOfSession
    });
    
    if (intentType === 'skip' && !isFinancialContext && isFirstMessageOfSession) {
      // CASO 1: Cliente conhecido (tem email OU validado Kiwify OU status=customer) = MENU DE TRIAGEM
      if (isValidatedCustomer) {
        console.log('[ai-autopilot-chat] 🎯 TRIAGEM: Enviando menu de departamentos para cliente conhecido', {
          hasEmail: contactHasEmail,
          isKiwifyValidated: isKiwifyValidated,
          isCustomerInDatabase: isCustomerInDatabase
        });
        
        // Buscar template do menu de suporte
        let menuMessage = await getMessageTemplate(
          supabaseClient,
          'menu_suporte_cliente',
          { contact_name: contactName || 'cliente' }
        );
        
        if (!menuMessage) {
          menuMessage = `Olá, ${contactName || 'cliente'}! 👋 Que bom ter você de volta!\n\nComo posso te ajudar hoje?\n\n**1** - Pedidos (entregas, rastreio, trocas)\n**2** - Sistema (acesso, dúvidas técnicas)`;
        }
        
        // Marcar que estamos aguardando escolha do menu
        await supabaseClient.from('conversations')
          .update({
            customer_metadata: {
              ...(conversation.customer_metadata || {}),
              awaiting_menu_choice: true,
              menu_sent_at: new Date().toISOString()
            }
          })
          .eq('id', conversationId);
        
        // Salvar mensagem do menu
        const { data: savedMsg } = await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: menuMessage,
            sender_type: 'user',
            is_ai_generated: true,
            channel: responseChannel
          })
          .select()
          .single();
        
        // Enviar via WhatsApp se necessário (Meta ou Evolution)
        if (responseChannel === 'whatsapp') {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              menuMessage,
              conversationId,
              contact.whatsapp_id
            );
          }
        }
        
        return new Response(JSON.stringify({
          response: menuMessage,
          messageId: savedMsg?.id,
          directGreeting: true,
          awaitingMenuChoice: true,
          debug: { 
            reason: 'triage_menu_sent',
            customer_name: contactName,
            isKiwifyValidated: isKiwifyValidated,
            isCustomerInDatabase: isCustomerInDatabase,
            hasEmail: contactHasEmail,
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // CASO 2: Lead novo (NÃO validado Kiwify e SEM email) = pedir email direto
      if (!isValidatedCustomer && responseChannel === 'whatsapp') {
        console.log('[ai-autopilot-chat] 🎯 BYPASS DA IA - Pedindo email para lead novo (não validado Kiwify)');
        
        // Buscar template do banco ou usar fallback
        const leadGreeting = await getMessageTemplate(
          supabaseClient,
          'saudacao_cliente_novo',
          { contact_name: contactName || '' }
        ) || `Olá${contactName ? ' ' + contactName : ''}! Para garantir um atendimento personalizado e seguro, preciso que você me informe seu email.`;
        
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
        
        // Enviar via WhatsApp (Meta ou Evolution)
        const whatsappResult = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation
        );
        
        if (whatsappResult) {
          await sendWhatsAppMessage(
            supabaseClient,
            whatsappResult,
            contact.phone,
            leadGreeting,
            conversationId,
            contact.whatsapp_id
          );
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
    // 🔐 DETECÇÃO AUTOMÁTICA DE CÓDIGO OTP (6 dígitos) - CONTEXTUAL
    // ============================================================
    // CORREÇÃO: Só valida OTP automaticamente se:
    // 1. É um código de 6 dígitos
    // 2. Cliente tem email cadastrado
    // 3. Existe OTP pendente (awaiting_otp = true) OU OTP foi enviado recentemente
    // 
    // Isso evita tratar códigos de devolução/rastreio como OTP
    // ============================================================
    const isOTPCode = /^\d{6}$/.test(customerMessage.trim());
    const conversationMetadata = conversation.customer_metadata || {};
    
    // Verificar se há OTP pendente (flag explícita)
    const hasAwaitingOTP = conversationMetadata.awaiting_otp === true;
    
    // Verificar se OTP foi enviado recentemente (últimos 15 minutos)
    const otpExpiresAt = conversationMetadata.otp_expires_at;
    const hasRecentOTPPending = otpExpiresAt && new Date(otpExpiresAt) > new Date();
    
    // Verificar se primeiro contato enviou OTP (via IDENTITY WALL)
    const hasFirstContactOTPPending = !hasEverVerifiedOTP && contactHasEmail;
    
    // Só validar OTP se houver contexto de OTP pendente
    const shouldValidateOTP = isOTPCode && contactHasEmail && 
      (hasAwaitingOTP || hasRecentOTPPending || hasFirstContactOTPPending);
    
    console.log('[ai-autopilot-chat] 🔐 OTP Detection Check:', {
      is_6_digit_code: isOTPCode,
      has_awaiting_otp_flag: hasAwaitingOTP,
      has_recent_otp_pending: hasRecentOTPPending,
      has_first_contact_otp: hasFirstContactOTPPending,
      will_validate: shouldValidateOTP,
      code_preview: customerMessage.trim().substring(0, 3) + '***'
    });
    
    if (shouldValidateOTP) {
      console.log('[ai-autopilot-chat] 🔐 DECISION POINT: AUTO_OTP_VALIDATION', {
        detected_otp_code: true,
        contact_has_email: contactHasEmail,
        otp_context: hasAwaitingOTP ? 'awaiting_otp_flag' : hasRecentOTPPending ? 'recent_otp_sent' : 'first_contact',
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
        
        // CORREÇÃO: Usar otpData.error ao invés de otpData.message
        // A função verify-code retorna { success: false, error: "mensagem" }
        const errorMessage = otpData?.error || 'O código não é válido. Verifique e tente novamente.';
        
        const directOTPSuccessResponse = otpData?.success 
          ? `**Código validado com sucesso!**

Olá ${contactName}! Sua identidade foi confirmada. 

Agora posso te ajudar com questões financeiras. Como posso te ajudar?`
          : `**Código inválido**

${errorMessage}

Digite **"reenviar"** se precisar de um novo código.`;
        
        // Se OTP foi validado com sucesso, limpar flags de OTP pendente
        if (otpData?.success) {
          await supabaseClient
            .from('conversations')
            .update({ 
              customer_metadata: {
                ...conversationMetadata,
                awaiting_otp: false,
                otp_expires_at: null,
                last_otp_verified_at: new Date().toISOString()
              }
            })
            .eq('id', conversationId);
          
          console.log('[ai-autopilot-chat] ✅ OTP validado - flags limpas');
        }
        
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
        
        // Enviar via WhatsApp se necessário (Meta ou Evolution)
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              directOTPSuccessResponse,
              conversationId,
              contact.whatsapp_id
            );
          }
        }
        
        console.log('[ai-autopilot-chat] ✅ OTP AUTO-VALIDATION COMPLETE:', {
          otp_success: otpData?.success,
          error_reason: otpData?.success ? null : errorMessage,
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
            error_detail: otpData?.success ? null : errorMessage,
            bypassed_ai: true
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('[ai-autopilot-chat] ❌ Erro ao validar OTP automaticamente:', error);
        // Se falhar, continua para IA tentar lidar
      }
    } else if (isOTPCode && contactHasEmail) {
      // Cliente enviou 6 dígitos mas não há OTP pendente - perguntar se é OTP ou outro código
      console.log('[ai-autopilot-chat] ⚠️ 6-digit code received but NO OTP pending - will let AI handle naturally');
    }
    
    // ============================================================
    // 🔐 GUARD CLAUSE: Cliente VERIFICADO (tem email + já fez OTP) → BYPASS Identity Wall
    // Se cliente já tem email E já verificou OTP alguma vez E NÃO é pedido financeiro:
    // → Atendimento NORMAL direto, SEM pedir OTP novamente
    // ============================================================
    if (contactHasEmail && hasEverVerifiedOTP && !isFinancialRequest) {
      console.log('[ai-autopilot-chat] ✅ GUARD CLAUSE: Cliente verificado - BYPASS Identity Wall', {
        contact_email: maskEmail(contactEmail),
        contact_name: contactName,
        has_ever_verified_otp: true,
        is_financial_request: false,
        action: 'skip_identity_wall_go_to_normal_service'
      });
      
      // NÃO faz nada aqui - deixa o código continuar para atendimento normal pela IA
      // Apenas loga e segue para o próximo bloco
    }
    
    // ============================================================
    // 🔐 OTP APENAS PARA QUESTÕES FINANCEIRAS
    // ============================================================
    // Regra simplificada:
    // - Cliente pede algo FINANCEIRO (saque, reembolso, etc.) → OTP para segurança
    // - Qualquer outra coisa → Conversa normal (sem OTP na entrada)
    // ============================================================
    if (contactHasEmail && isFinancialRequest && !hasRecentOTPVerification) {
      const maskedEmail = maskEmail(contactEmail);
      
      console.log('[ai-autopilot-chat] 🔐 OTP FINANCEIRO - Solicitação financeira detectada:', {
        is_financial_request: isFinancialRequest,
        has_recent_otp: hasRecentOTPVerification,
        contact_email: maskedEmail,
        message_preview: customerMessage.substring(0, 50)
      });
      
      // Enviar OTP para verificação financeira
      try {
        console.log('[ai-autopilot-chat] 🔐 DECISION POINT: FINANCIAL_OTP_BARRIER', {
          is_financial_context: true,
          has_ever_verified: true,
          has_recent_otp: false,
          will_send_otp: true,
          current_channel: responseChannel
        });
        
        // Enviar OTP automaticamente
        await supabaseClient.functions.invoke('send-verification-code', {
          body: { email: contactEmail, type: 'customer' }
        });
        
        // 🔐 MARCAR OTP PENDENTE NA METADATA (para validação contextual)
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos
        await supabaseClient
          .from('conversations')
          .update({ 
            customer_metadata: {
              ...conversationMetadata,
              awaiting_otp: true,
              otp_expires_at: otpExpiresAt,
              claimant_email: contactEmail
            }
          })
          .eq('id', conversationId);
        
        console.log('[ai-autopilot-chat] 🔐 OTP pendente marcado na metadata (financial barrier)');
        
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
        
        // Enviar via WhatsApp se necessário (Meta ou Evolution)
        if (responseChannel === 'whatsapp' && contact?.phone) {
          const whatsappResult = await getWhatsAppInstanceForConversation(
            supabaseClient, 
            conversationId, 
            conversation.whatsapp_instance_id,
            conversation
          );
          
          if (whatsappResult) {
            await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              directOTPResponse,
              conversationId,
              contact.whatsapp_id
            );
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
    
    // Cliente identificado sem solicitação financeira - atendimento normal (não precisa OTP)
    if (contactHasEmail && !isFinancialRequest) {
      console.log('[ai-autopilot-chat] ✅ Cliente identificado - Atendimento normal sem OTP');
    }
    
    // 🆕 CORREÇÃO: Só pedir email se NÃO for cliente conhecido pelo telefone
    if (!contactHasEmail && !isPhoneVerified && !isCustomerInDatabase && !isKiwifyValidated && responseChannel === 'whatsapp') {
      // FASE 4: Lead NOVO (não tem email E não está no banco por telefone) - seguir Identity Wall
      priorityInstruction = `=== INSTRUÇÃO PRIORITÁRIA - IGNORE TUDO ABAIXO ATÉ SEGUIR ISSO ===

Este contato NÃO tem email cadastrado. A PRIMEIRA coisa que você DEVE falar é:
"Olá! Para garantir um atendimento personalizado e seguro, preciso que você me informe seu email."

→ PARE AQUI. AGUARDE o cliente fornecer o email.
→ NÃO responda dúvidas técnicas até ter o email
=== FIM DA INSTRUÇÃO PRIORITÁRIA ===

`;
      
      identityWallNote = `\n\n**LEAD NOVO - Identificação por Email (SEM OTP):**
Este cliente NÃO tem email cadastrado no sistema.

**FLUXO DE IDENTIFICAÇÃO:**
1. PRIMEIRA MENSAGEM: Cumprimente "${contactName}" e solicite o email de forma educada e direta:
   "Olá ${contactName}! Para garantir um atendimento personalizado, preciso que você me informe seu email."
   
2. AGUARDE o cliente fornecer o email

3. QUANDO cliente fornecer email: Use a ferramenta verify_customer_email para buscar na base

4. **SE EMAIL NÃO ENCONTRADO NA BASE:**
   - Sistema vai perguntar: "Não encontrei esse email na nossa base de clientes. Poderia confirmar se esse email está correto?"
   - Se cliente responder "SIM", "correto" → Use confirm_email_not_found com confirmed=true (transfere para comercial)
   - Se cliente informar email DIFERENTE → Use verify_customer_email com o novo email
   - Se cliente responder "não", "errado" → Use confirm_email_not_found com confirmed=false (pede novo email)

5. **SE EMAIL ENCONTRADO NA BASE:**
   - Cumprimente o cliente pelo nome e pergunte como pode ajudar
   - NÃO precisa de OTP para atendimento normal (rastreio, dúvidas, etc.)
   - OTP só será pedido se cliente solicitar operação FINANCEIRA (saque, reembolso)

**IMPORTANTE:** NÃO atenda dúvidas técnicas até o email ser verificado na base.`;
    } else if (isPhoneVerified && !contactHasEmail && !isKiwifyValidated) {
      // 🆕 Cliente identificado pelo telefone (sem email) - atendimento normal, sem pedir email
      console.log('[ai-autopilot-chat] ✅ Cliente identificado por telefone - bypass Identity Wall');
    }
    
    // PORTEIRO FINANCEIRO ATIVADO
    if (financialBarrierActive) {
      // Verificar se cliente já foi identificado por email (novo fluxo)
      const hasEmailVerifiedInDb = conversation.customer_metadata?.email_verified_in_db === true;
      const verifiedEmail = conversation.customer_metadata?.verified_email;
      
      if (contactHasEmail || hasEmailVerifiedInDb) {
        const emailToUse = contactEmail || verifiedEmail;
        const maskedEmailForPrompt = emailToUse ? maskEmail(emailToUse) : 'seu email cadastrado';
        
        // Cenário: Cliente identificado por email → Agora sim precisa OTP para financeiro
        identityWallNote += `\n\n**=== PORTEIRO FINANCEIRO - VERIFICAÇÃO OTP OBRIGATÓRIA ===**
O cliente pediu uma operação FINANCEIRA (${customerMessage}).
Email verificado: ${maskedEmailForPrompt}

**RESPOSTA OBRIGATÓRIA:**
"Para sua segurança, preciso confirmar sua identidade antes de prosseguir com operações financeiras. 
Vou enviar um código de verificação para ${maskedEmailForPrompt}."

→ Use a ferramenta send_financial_otp para disparar o OTP
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
    
    // 🎯 INSTRUÇÃO ANTI-ALUCINAÇÃO - Obrigar IA a admitir quando não sabe
    const antiHallucinationInstruction = confidenceResult.action === 'cautious' 
      ? `\n\n**⚠️ ATENÇÃO - CONFIANÇA MÉDIA (${(confidenceResult.score * 100).toFixed(0)}%):**
Você encontrou POUCA informação na base de conhecimento sobre o assunto.
- Responda com cautela e prefixe sua resposta indicando incerteza
- Se não tiver certeza, ADMITA: "Não tenho informação completa sobre isso"
- OFEREÇA transferir para um especialista se o cliente precisar de mais detalhes\n`
      : '';

    const contextualizedSystemPrompt = `${priorityInstruction}${antiHallucinationInstruction}

**🚫 REGRA CRÍTICA DE HANDOFF (OBRIGATÓRIO):**
VOCÊ NÃO PODE transferir para atendente humano (request_human_agent) até que o cliente esteja IDENTIFICADO:
- Cliente DEVE ter fornecido email E email foi verificado na base (email_verified_in_db=true)
- OU cliente já tem email cadastrado no contato

SE cliente pedir atendente humano mas NÃO está identificado:
→ Responda: "Claro! Para conectar você com um atendente, preciso primeiro confirmar sua identidade. Qual é o seu email de cadastro?"
→ AGUARDE o email
→ Use verify_customer_email para validar
→ SÓ ENTÃO pode usar request_human_agent

**⚠️ REGRA CRÍTICA ANTI-ALUCINAÇÃO:**
Se você NÃO encontrar informação na BASE DE CONHECIMENTO para responder a pergunta do cliente:
1. NÃO INVENTE informações
2. NÃO use conhecimento externo não validado pela empresa
3. Se cliente JÁ IDENTIFICADO (tem email verificado): "Não encontrei essa informação. Posso te conectar com um especialista?"
4. Se cliente NÃO IDENTIFICADO: "Não encontrei essa informação. Para te ajudar melhor, qual é o seu email de cadastro?"
5. AGUARDE email → verifique → depois pode oferecer handoff

É MELHOR admitir que não sabe do que fornecer informação ERRADA.

---

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

**CENÁRIO C: REEMBOLSO/DEVOLUÇÃO (Produto Errado, Defeito, Troca)**

Quando cliente mencionar "envio errado", "produto errado", "veio diferente", "veio outra cor", "veio errado", "defeito", "quebrado", "danificado", "trocar", "quero trocar", "quero devolver":

**PASSO 1: PERGUNTAR TIPO DE RESOLUÇÃO PRIMEIRO**
"Entendi que houve um problema com seu pedido. Você prefere:

**A)** Reembolso do valor pago?
**B)** Reenvio do produto correto?
**C)** Troca por outro item?"

→ AGUARDE resposta antes de prosseguir

**PASSO 2: COLETAR DADOS DO PROBLEMA**
Após cliente escolher A, B ou C:

"Para resolver, preciso de algumas informações:

1️⃣ **Número do pedido:** (ex: #12345 ou código de rastreio)
2️⃣ **Qual produto veio errado/com defeito?** (nome ou descrição)
3️⃣ **O que você esperava receber?** (ou qual era o correto)"

→ AGUARDE respostas antes de prosseguir

**PASSO 3: SOLICITAR EVIDÊNCIAS**
"Para agilizar a análise da equipe, você consegue enviar uma foto do produto que recebeu? 📷

Isso ajuda muito a resolver mais rápido!"

→ AGUARDE cliente enviar foto OU dizer que não consegue

**PASSO 4: CRIAR TICKET COM DADOS COMPLETOS**
SOMENTE após coletar TODOS os dados acima (tipo de resolução, número pedido, problema, produto esperado), execute create_ticket com:
- issue_type: "reembolso" ou "troca" ou "devolucao" (conforme opção escolhida)
- subject: "[Tipo] Pedido #[NÚMERO] - [Resumo do problema]"
- description: Incluir TODOS os dados coletados:
  • Número do pedido
  • Produto recebido (errado/com defeito)
  • Produto esperado (correto)
  • Resolução desejada (reembolso/troca/reenvio)
  • Se foto foi enviada (sim/não)
- order_id: [NÚMERO DO PEDIDO se fornecido]

**EXEMPLO DE TICKET BEM PREENCHIDO:**
subject: "Reembolso Pedido #12345 - Cor Errada"
description: "Cliente Maria recebeu camiseta preta quando pediu branca.
Pedido: #12345
Produto recebido: Camiseta preta M
Produto esperado: Camiseta branca M  
Foto enviada: Sim
Resolução desejada: Reembolso integral"

**REGRAS DO CENÁRIO C:**
- NUNCA crie ticket sem saber tipo de resolução (A, B ou C)
- NUNCA crie ticket sem número do pedido (se cliente não souber, pergunte: "Qual email usou na compra? Vou buscar para você.")
- NUNCA crie ticket sem saber o que veio errado vs o que era esperado
- SEMPRE peça foto para evidência (mas prossiga se cliente não puder enviar)
- Se cliente mencionar "envio errado" mas já escolheu resolução, pule direto para PASSO 2

---

**REGRAS CRÍTICAS GERAIS:**
- NUNCA crie ticket para cancelamento Kiwify (é self-service)
- NUNCA fale de valores com cliente não identificado
- NUNCA pule a confirmação de dados
- SEMPRE pergunte qual tipo (A, B ou C) antes de prosseguir em saques e reembolsos
- SEMPRE mostre os dados e peça confirmação para saque
- SEMPRE envie o link da Kiwify para cancelamentos
- SEMPRE colete dados completos antes de criar ticket de reembolso/devolução

---

**Você tem acesso às seguintes ferramentas:**
- create_ticket: Use APENAS quando cliente pedir explicitamente ajuda humana OU problema financeiro concreto OU você não conseguir responder após tentar. Para SAQUE, use SOMENTE após OTP validado e dados confirmados.
- verify_customer_email: Use quando cliente FORNECER email para identificação. Verifica se existe na base. Se existir, cliente é identificado SEM OTP. OTP só é necessário para operações financeiras.
- send_financial_otp: Use quando cliente JÁ IDENTIFICADO por email solicitar operação FINANCEIRA (saque, reembolso). Envia OTP para confirmar identidade antes de prosseguir.
- resend_otp: Use quando cliente disser "não recebi email" ou pedir reenvio. Reenvia código para email JÁ cadastrado.
- verify_otp_code: Valide códigos OTP de 6 dígitos
- request_human_agent: Transfira para atendente humano quando: 1) Cliente disser que dados estão INCORRETOS, 2) Cliente pedir explicitamente atendente humano, 3) Situação muito complexa que você não consegue resolver.
- check_tracking: Consulta rastreio de pedidos. Use quando cliente perguntar sobre entrega ou status de envio.

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
      // 🆕 TOOL: Enviar OTP para operações financeiras (quando cliente já está identificado)
      {
        type: 'function',
        function: {
          name: 'send_financial_otp',
          description: 'Envia código OTP para email JÁ VERIFICADO quando cliente solicita operação FINANCEIRA (saque, reembolso, etc). Use apenas após cliente já ter sido identificado por email na base. NÃO use para identificação inicial - para isso use verify_customer_email.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      // TOOL: Confirmar email não encontrado na base
      {
        type: 'function',
        function: {
          name: 'confirm_email_not_found',
          description: 'Usar quando o email não foi encontrado na base e o cliente CONFIRMA que o email está correto (responde "sim", "correto", "está certo"). Se cliente disser que email está ERRADO ou enviar outro email, NÃO use esta tool - use verify_customer_email com o novo email.',
          parameters: {
            type: 'object',
            properties: {
              confirmed: { 
                type: 'boolean', 
                description: 'true se cliente confirmou que o email está correto, false se cliente disse que digitou errado' 
              }
            },
            required: ['confirmed']
          }
        }
      },
      // TOOL: Handoff manual para atendente humano
      {
        type: 'function',
        function: {
          name: 'request_human_agent',
          description: 'Transfere a conversa para um atendente humano. ⚠️ PRÉ-REQUISITO OBRIGATÓRIO: Cliente DEVE estar identificado por email (email_verified_in_db=true) OU ter email cadastrado no contato. NÃO use esta ferramenta se cliente ainda não forneceu email - nesse caso, PEÇA O EMAIL PRIMEIRO usando verify_customer_email. Use apenas quando: 1) Cliente JÁ IDENTIFICADO pedir explicitamente atendimento humano, 2) Dados estiverem incorretos APÓS identificação por email, 3) Caso complexo APÓS identificação.',
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

    // 🎯 PREFIXO DE RESPOSTA CAUTELOSA (confiança média)
    if (confidenceResult.action === 'cautious' && !toolCalls.length) {
      const cautiousPrefix = generateResponsePrefix('cautious');
      if (cautiousPrefix && !assistantMessage.startsWith('**Baseado')) {
        assistantMessage = cautiousPrefix + assistantMessage;
        console.log('[ai-autopilot-chat] ⚠️ Prefixo cauteloso adicionado à resposta');
      }
    }

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

            // CENÁRIO A: EMAIL NÃO ENCONTRADO - PERGUNTAR SE ESTÁ CORRETO ANTES DE TRANSFERIR
            if (searchError || !existingCustomer) {
              console.log('[ai-autopilot-chat] ❌ FASE 2: Email não encontrado - Perguntando confirmação');
              
              // Salvar email pendente para confirmação na metadata da conversa
              const currentMetadata = conversation.customer_metadata || {};
              await supabaseClient
                .from('conversations')
                .update({ 
                  customer_metadata: { 
                    ...currentMetadata,
                    pending_email_confirmation: emailInformado,
                    pending_email_timestamp: new Date().toISOString()
                  }
                })
                .eq('id', conversationId);
              
              console.log('[ai-autopilot-chat] 📧 Email salvo para confirmação:', emailInformado);
              
              assistantMessage = `Não encontrei o email **${emailInformado}** na nossa base de clientes.

Poderia confirmar se esse email está correto?

Se estiver correto, vou te transferir para nosso time comercial. Se digitou errado, me informe o email correto.`;
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

            // 🆕 NOVO FLUXO: Email encontrado = Cliente identificado SEM OTP
            // OTP será pedido APENAS quando cliente solicitar operação financeira
            console.log('[ai-autopilot-chat] ✅ Cliente identificado por email - SEM OTP (novo fluxo)');
            
            // Marcar como cliente verificado por email na base (sem awaiting_otp)
            const currentMetadata = conversation.customer_metadata || {};
            await supabaseClient
              .from('conversations')
              .update({ 
                customer_metadata: {
                  ...currentMetadata,
                  email_verified_in_db: true,        // Email conferido na base
                  verified_email: emailInformado,     // Email do cliente
                  verified_customer_id: existingCustomer.id,
                  verified_customer_name: existingCustomer.first_name,
                  verified_at: new Date().toISOString()
                  // NÃO definimos awaiting_otp aqui - só quando for financeiro
                }
              })
              .eq('id', conversationId);
            
            console.log('[ai-autopilot-chat] ✅ Cliente marcado como verificado (email_verified_in_db)');
            
            // Resposta direta SEM pedir OTP
            assistantMessage = `Perfeito, ${existingCustomer.first_name}! Encontrei seu cadastro.

Como posso te ajudar hoje?`;
            
            await supabaseClient.from('interactions').insert({
              customer_id: existingCustomer.id,
              type: 'note',
              content: `Cliente identificado por email: ${emailInformado}`,
              channel: responseChannel,
              metadata: { source: 'email_verification', verified_in_db: true }
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

            // 🔐 ATUALIZAR OTP PENDENTE NA METADATA (novo código, novo timer)
            const currentMetadata = conversation.customer_metadata || {};
            const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos
            await supabaseClient
              .from('conversations')
              .update({ 
                customer_metadata: {
                  ...currentMetadata,
                  awaiting_otp: true,
                  otp_expires_at: otpExpiresAt,
                  claimant_email: contactEmail
                }
              })
              .eq('id', conversationId);
            
            console.log('[ai-autopilot-chat] 🔐 OTP pendente atualizado na metadata (resend_otp tool)');

            // Build response message usando template do banco (NEVER show code to client)
            const safeEmail = maskEmail(contactEmail);
            assistantMessage = await getMessageTemplate(
              supabaseClient,
              'otp_reenvio',
              { masked_email: safeEmail }
            ) || `Código reenviado com sucesso!

Enviei um novo código de 6 dígitos para **${safeEmail}**.

Por favor, verifique sua caixa de entrada (e spam) e digite o código que você recebido.`;

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
        // 🆕 TOOL HANDLER: Enviar OTP para operações financeiras
        else if (toolCall.function.name === 'send_financial_otp') {
          try {
            console.log('[ai-autopilot-chat] 🔐 Enviando OTP financeiro...');
            
            // Buscar email do cliente (do contato ou da metadata da conversa)
            const hasEmailVerifiedInDb = conversation.customer_metadata?.email_verified_in_db === true;
            const verifiedEmail = conversation.customer_metadata?.verified_email;
            const emailToUse = contact.email || verifiedEmail;
            
            if (!emailToUse) {
              assistantMessage = 'Não encontrei seu email cadastrado. Por favor, informe seu email para que eu possa enviar o código de verificação.';
              continue;
            }

            // Enviar OTP
            const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('send-verification-code', {
              body: { email: emailToUse, type: 'customer' }
            });

            if (otpError || !otpData?.success) {
              console.error('[ai-autopilot-chat] ❌ Erro ao enviar OTP financeiro:', otpError);
              assistantMessage = 'Não consegui enviar o código de verificação. Por favor, tente novamente em alguns instantes.';
              continue;
            }

            // Marcar OTP pendente na metadata
            const currentMetadata = conversation.customer_metadata || {};
            const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos
            await supabaseClient
              .from('conversations')
              .update({ 
                customer_metadata: {
                  ...currentMetadata,
                  awaiting_otp: true,
                  otp_expires_at: otpExpiresAt,
                  claimant_email: emailToUse,
                  financial_otp_requested: true // Marca que é OTP financeiro
                }
              })
              .eq('id', conversationId);
            
            console.log('[ai-autopilot-chat] 🔐 OTP financeiro enviado e marcado na metadata');

            // Resposta
            const safeEmail = maskEmail(emailToUse);
            assistantMessage = `Para sua seguranca, enviei um codigo de 6 digitos para **${safeEmail}**.

Por favor, digite o codigo que voce recebeu para confirmar sua identidade.`;

            // Log dev mode internally
            if (otpData.dev_mode) {
              console.log('[ai-autopilot-chat] ⚠️ DEV MODE: Código OTP financeiro não enviado - verifique configuração do Resend');
            }
            
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'note',
              content: `Verificacao financeira iniciada - OTP enviado para ${safeEmail}`,
              channel: responseChannel,
              metadata: { source: 'financial_otp', email_masked: safeEmail }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao enviar OTP financeiro:', error);
            assistantMessage = 'Ocorreu um erro ao enviar o código. Por favor, tente novamente.';
          }
        }
        // TOOL: Confirmar email não encontrado - transferir para comercial ou pedir novo email
        else if (toolCall.function.name === 'confirm_email_not_found') {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const confirmed = args.confirmed;
            const currentMetadata = conversation.customer_metadata || {};
            const pendingEmail = currentMetadata.pending_email_confirmation;
            
            console.log('[ai-autopilot-chat] 📧 Confirmação de email não encontrado:', { confirmed, pendingEmail });
            
            if (!confirmed) {
              // Cliente quer corrigir - limpar email pendente e pedir novo
              await supabaseClient
                .from('conversations')
                .update({ 
                  customer_metadata: { 
                    ...currentMetadata,
                    pending_email_confirmation: null,
                    pending_email_timestamp: null
                  }
                })
                .eq('id', conversationId);
              
              assistantMessage = 'Ok! Por favor, me informe o email correto para que eu possa verificar.';
              continue;
            }
            
            // Cliente CONFIRMOU que email está correto - TRANSFERIR PARA COMERCIAL
            console.log('[ai-autopilot-chat] ✅ Email confirmado pelo cliente, transferindo para comercial');
            
            const emailInformado = pendingEmail || 'não informado';
            
            // ✅ CRIAR DEAL COM DADOS DO LEAD (contact_id = NULL)
            let dealId: string | null = null;
            const PIPELINE_VENDAS_ID = '00000000-0000-0000-0000-000000000001';
            const STAGE_LEAD_ID = '11111111-1111-1111-1111-111111111111';
            
            const { data: deal, error: dealError } = await supabaseClient
              .from('deals')
              .insert({
                title: `Lead via Chat - ${emailInformado}`,
                contact_id: null,
                lead_email: emailInformado,
                lead_phone: contact.phone,
                lead_whatsapp_id: contact.whatsapp_id,
                lead_source: responseChannel,
                stage_id: STAGE_LEAD_ID,
                pipeline_id: PIPELINE_VENDAS_ID,
                status: 'open',
                value: 0,
                currency: 'BRL'
              })
              .select()
              .single();
            
            if (!dealError && deal) {
              dealId = deal.id;
              console.log('[ai-autopilot-chat] 💰 Deal (Lead) criado:', dealId);
            } else {
              console.error('[ai-autopilot-chat] ❌ Erro ao criar deal:', dealError);
            }

            // Limpar email pendente da metadata
            await supabaseClient
              .from('conversations')
              .update({ 
                customer_metadata: { 
                  ...currentMetadata,
                  pending_email_confirmation: null,
                  pending_email_timestamp: null
                }
              })
              .eq('id', conversationId);

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

            // ATRIBUIR DEAL AO VENDEDOR E NOTIFICAR
            if (routeResult?.assigned_to) {
              if (dealId) {
                await supabaseClient
                  .from('deals')
                  .update({ assigned_to: routeResult.assigned_to })
                  .eq('id', dealId);
                
                console.log('[ai-autopilot-chat] 💼 Deal atribuído ao vendedor:', routeResult.assigned_to);
              }
              
              // NOTIFICAR VENDEDOR VIA REALTIME
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
              
              assistantMessage = `Entendi! Como não localizei uma assinatura ativa com seu e-mail, vou te transferir para um **especialista comercial** que poderá te ajudar. Aguarde um momento!`;
            } else {
              // Nenhum vendedor online
              const { data: onlineSalesReps } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('availability_status', 'online');
              
              const { data: comercialUsers } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('department', comercialDept?.id)
                .in('id', (onlineSalesReps || []).map(u => u.id));
              
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
              
              assistantMessage = `Entendi! Como não localizei uma assinatura ativa com seu e-mail, vou te transferir para nosso time comercial.

Nosso **time de vendas** está offline no momento.
**Horário:** Segunda a Sexta, 09h às 18h.

Assim que retornarmos, um consultor vai te ajudar!`;
            }
          } catch (error) {
            console.error('[ai-autopilot-chat] ❌ Erro ao processar confirmação de email:', error);
            assistantMessage = 'Ocorreu um erro. Poderia me informar seu email novamente?';
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
              assistantMessage = await createTicketSuccessMessage(
                supabaseClient,
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
                        packed_at: trackingInfo.packed_at,
                        packed_at_formatted: trackingInfo.packed_at_formatted,
                        is_packed: trackingInfo.is_packed,
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
                // Usar packed_at_formatted (horário de embalagem) que vem do fetch-tracking
                const packedAt = t.packed_at_formatted 
                  || (t.packed_at 
                      ? new Date(t.packed_at).toLocaleDateString('pt-BR', { 
                          day: '2-digit', month: '2-digit', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit' 
                        })
                      : 'Recentemente');

                return `**${t.tracking_code}**
📦 Embalado em: ${packedAt}
🚚 Transportadora: ${platform}
✅ Status: Pedido pronto e em transporte!`;
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

            // 🆕 VALIDAÇÃO: Bloquear handoff se cliente não está identificado por email
            const hasEmailInContact = contact.email && contact.email.length > 0;
            const hasEmailVerifiedInDb = conversation.customer_metadata?.email_verified_in_db === true;
            const isIdentified = hasEmailInContact || hasEmailVerifiedInDb;

            if (!isIdentified) {
              console.log('[ai-autopilot-chat] ⛔ Handoff BLOQUEADO - Cliente não identificado por email');
              console.log('[ai-autopilot-chat] 📧 contact.email:', contact.email);
              console.log('[ai-autopilot-chat] 📧 email_verified_in_db:', conversation.customer_metadata?.email_verified_in_db);
              
              // Retornar mensagem instruindo a pedir email primeiro
              assistantMessage = 'Para poder te conectar com um atendente, preciso primeiro confirmar sua identidade. Qual é o seu email de cadastro?';
              
              // Não executa o handoff - força a IA a pedir email
              continue;
            }

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
    let isFallbackResponse = FALLBACK_PHRASES.some(phrase => 
      assistantMessage.toLowerCase().includes(phrase)
    );

    if (isFallbackResponse) {
      console.log('[ai-autopilot-chat] 🚨 FALLBACK DETECTADO - Executando handoff REAL');
      
      // 🛡️ ANTI-RACE-CONDITION: Marcar handoff executado PRIMEIRO
      const handoffTimestamp = new Date().toISOString();
      
      // 🆕 VERIFICAÇÃO DE LEAD: Se não tem email E não é cliente → Comercial
      const isLeadWithoutEmail = !contactHasEmail && !isCustomerInDatabase && !isKiwifyValidated;
      const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
      const DEPT_SUPORTE_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
      
      // Determinar departamento de destino
      const handoffDepartment = isLeadWithoutEmail ? DEPT_COMERCIAL_ID : DEPT_SUPORTE_ID;
      
      console.log('[ai-autopilot-chat] 🎯 Fallback department decision:', {
        isLeadWithoutEmail,
        contactHasEmail,
        isCustomerInDatabase,
        contactStatus: contact.status,
        handoffDepartment: isLeadWithoutEmail ? 'COMERCIAL' : 'SUPORTE',
        departmentId: handoffDepartment
      });
      
      // 1. MUDAR O MODO para waiting_human (NÃO copilot!) e marcar timestamp + departamento
      await supabaseClient
        .from('conversations')
        .update({ 
          ai_mode: 'waiting_human', // 🆕 waiting_human para ficar na fila até agente responder
          handoff_executed_at: handoffTimestamp, // 🆕 Anti-race-condition flag
          needs_human_review: true,
          department: handoffDepartment, // 🆕 Definir departamento correto (Comercial para leads)
          customer_metadata: {
            ...(conversation.customer_metadata || {}),
            ...(isLeadWithoutEmail && {
              lead_routed_to_comercial_reason: 'fallback_handoff',
              lead_routed_at: handoffTimestamp
            })
          }
        })
        .eq('id', conversationId);
      
      console.log('[ai-autopilot-chat] ✅ ai_mode mudado para waiting_human, handoff_executed_at:', handoffTimestamp);
      
      // 2. CHAMAR O ROTEADOR COM DEPARTAMENTO EXPLÍCITO
      const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
        body: { 
          conversationId,
          department_id: handoffDepartment // 🆕 Passar departamento explícito
        }
      });
      
      if (routeError) {
        console.error('[ai-autopilot-chat] ❌ Erro ao rotear conversa:', routeError);
      } else {
        console.log('[ai-autopilot-chat] ✅ Conversa roteada:', routeResult);
        
        // 🆕 Mensagem diferenciada para leads
        if (isLeadWithoutEmail && routeResult?.assigned) {
          assistantMessage = 'Obrigado pelo seu interesse! Vou te direcionar para nosso time Comercial que poderá te apresentar nossas soluções. 🤝\n\nAguarde um momento que logo um de nossos consultores irá te atender!';
        }
        
        // 🆕 Se ninguém online, MANTER waiting_human - cliente fica na fila aguardando
        if (routeResult?.no_agents_available) {
          console.log('[ai-autopilot-chat] ⚠️ Sem agentes online - Cliente ficará na FILA aguardando');
          
          // 🛡️ NÃO REVERTER para autopilot! Manter em waiting_human na fila
          await supabaseClient
            .from('conversations')
            .update({ 
              needs_human_review: true,  // Flag para quando agente ficar online
              // NÃO mudar ai_mode - MANTÉM waiting_human
            })
            .eq('id', conversationId);
          
          // Mensagem diferenciada para leads vs clientes
          if (isLeadWithoutEmail) {
            assistantMessage = `Obrigado pelo contato! Nosso time Comercial está ocupado no momento, mas você está na fila e será atendido em breve. 🤝

⏰ Horário de atendimento: Segunda a Sexta, das 09h às 18h.`;
          } else {
            assistantMessage = `Vou te conectar com um de nossos especialistas! 

Nossa equipe está ocupada no momento, mas você está na fila e será atendido assim que um atendente ficar disponível. 

⏰ Horário de atendimento: Segunda a Sexta, das 09h às 18h.`;
          }
          
          console.log('[ai-autopilot-chat] ✅ Cliente mantido em waiting_human - na fila para atendimento');
        }
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
          assistantMessage = await createTicketSuccessMessage(
            supabaseClient,
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
        content: `🤖→👤 **Handoff Automático Executado**\n\n**Pergunta do Cliente:** "${customerMessage}"\n**Motivo:** IA não encontrou resposta adequada na base de conhecimento.\n**Departamento:** ${isLeadWithoutEmail ? '🛒 Comercial (Lead sem identificação)' : '🎧 Suporte'}\n**Ação:** ${isLeadWithoutEmail ? 'Lead novo roteado para equipe Comercial.' : 'Conversa transferida para atendimento humano.'}${isFinancialRequest ? '\n**Ticket Financeiro:** Criado automaticamente' : ''}`,
        channel: responseChannel,
        metadata: {
          source: 'ai_autopilot_handoff',
          fallback_phrase_detected: true,
          is_financial: isFinancialRequest,
          is_lead_without_email: isLeadWithoutEmail,
          routed_to_department: isLeadWithoutEmail ? 'comercial' : 'suporte',
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
    
    // 8. Se WhatsApp, enviar via Meta ou Evolution API e atualizar status
    else if (responseChannel === 'whatsapp' && contact.phone && messageId) {
      console.log('[ai-autopilot-chat] 📱 Tentando enviar WhatsApp:', {
        contactPhone: contact.phone,
        contactWhatsappId: contact.whatsapp_id,
        messageId,
        whatsappProvider: conversation.whatsapp_provider,
        whatsappMetaInstanceId: conversation.whatsapp_meta_instance_id,
        whatsappEvolutionInstanceId: conversation.whatsapp_instance_id
      });

      try {
        // 🔒 USAR HELPER MULTI-PROVIDER
        const whatsappResult = await getWhatsAppInstanceWithProvider(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation.whatsapp_provider,
          conversation.whatsapp_meta_instance_id
        );
        
        // Validar se instância foi encontrada
        if (!whatsappResult) {
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
        
        const { instance: whatsappInstance, provider } = whatsappResult;
        
        // ========== META WHATSAPP CLOUD API ==========
        if (provider === 'meta') {
          console.log('[ai-autopilot-chat] 📤 Invocando send-meta-whatsapp:', {
            instanceId: whatsappInstance.id,
            phoneNumberId: whatsappInstance.phone_number_id,
            phoneNumber: contact.phone
          });

          const { data: metaResponse, error: metaError } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
            body: {
              instance_id: whatsappInstance.id,
              phone_number: contact.phone?.replace(/\D/g, ''),
              message: assistantMessage,
              conversation_id: conversationId
            },
          });

          if (metaError) {
            throw metaError;
          }

          // SUCCESS: Update message status to 'sent'
          await supabaseClient
            .from('messages')
            .update({ status: 'sent' })
            .eq('id', messageId);

          console.log('[ai-autopilot-chat] ✅ Resposta enviada via Meta WhatsApp API');
        }
        // ========== EVOLUTION API (Legacy) ==========
        else {
          // Log de aviso se instância não está conectada
          if (whatsappInstance.status !== 'connected') {
            console.warn('[ai-autopilot-chat] ⚠️ Tentando enviar com instância Evolution não-conectada:', whatsappInstance.status);
          }

          console.log('[ai-autopilot-chat] 📤 Invocando send-whatsapp-message (Evolution):', {
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

          console.log('[ai-autopilot-chat] ✅ Resposta enviada via Evolution API');
        }
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
            sender_type: 'user',
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
