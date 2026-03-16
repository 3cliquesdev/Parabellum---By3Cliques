import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBusinessHoursInfo, type BusinessHoursResult } from "../_shared/business-hours.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

// ============================================================
// ðŸ†• INTERFACE DE CONFIGURAÃ‡ÃƒO RAG DINÃ‚MICA
// Lido do banco system_configurations
// ============================================================
interface RAGConfig {
  model: string;
  minThreshold: number;
  directThreshold: number;
  sources: {
    kb: boolean;
    crm: boolean;
    tracking: boolean;
    sandbox: boolean;
  };
  strictMode: boolean;
  blockFinancial: boolean;
  confidenceDirect: number;
  confidenceHandoff: number;
  ragMinThreshold: number;
  maxFallback: number;
}

const DEFAULT_RAG_CONFIG: RAGConfig = {
  model: 'gpt-5-mini',
  minThreshold: 0.10,
  directThreshold: 0.75,
  sources: { kb: true, crm: true, tracking: true, sandbox: true },
  strictMode: false,
  blockFinancial: true,
  confidenceDirect: 0.75,
  confidenceHandoff: 0.45,
  ragMinThreshold: 0.70,
  maxFallback: 3,
};

// Helper: Buscar TODAS as configuraÃ§Ãµes RAG do banco
async function getRAGConfig(supabaseClient: any): Promise<RAGConfig> {
  try {
    const { data, error } = await supabaseClient
      .from('system_configurations')
      .select('key, value')
      .in('key', [
        'ai_default_model',
        'ai_rag_min_threshold',
        'ai_rag_direct_threshold',
        'ai_rag_sources_enabled',
        'ai_strict_rag_mode',
        'ai_block_financial',
        'ai_strict_mode',
        'ai_confidence_direct',
        'ai_confidence_handoff',
        'ai_max_fallback_phrases',
      ]);
    
    if (error) {
      console.error('[getRAGConfig] Error fetching:', error);
      return DEFAULT_RAG_CONFIG;
    }
    
    const configMap = new Map<string, string>();
    if (data) {
      for (const item of data) {
        configMap.set(item.key, item.value);
      }
    }
    
    let sources = DEFAULT_RAG_CONFIG.sources;
    try {
      const sourcesStr = configMap.get('ai_rag_sources_enabled');
      if (sourcesStr) sources = JSON.parse(sourcesStr);
    } catch {}
    
    // Sanitize gateway model names to real OpenAI models
    const rawModel = configMap.get('ai_default_model') || DEFAULT_RAG_CONFIG.model;
    const sanitizedModel = sanitizeModelName(rawModel);
    
    const config: RAGConfig = {
      model: sanitizedModel,
      minThreshold: parseFloat(configMap.get('ai_rag_min_threshold') || String(DEFAULT_RAG_CONFIG.minThreshold)),
      directThreshold: parseFloat(configMap.get('ai_rag_direct_threshold') || String(DEFAULT_RAG_CONFIG.directThreshold)),
      sources,
      strictMode: configMap.get('ai_strict_rag_mode') === 'true' || configMap.get('ai_strict_mode') === 'true',
      blockFinancial: (configMap.get('ai_block_financial') ?? 'true') === 'true',
      confidenceDirect: parseFloat(configMap.get('ai_confidence_direct') ?? '0.75'),
      confidenceHandoff: parseFloat(configMap.get('ai_confidence_handoff') ?? '0.45'),
      ragMinThreshold: parseFloat(configMap.get('ai_rag_min_threshold') ?? '0.70'),
      maxFallback: parseInt(configMap.get('ai_max_fallback_phrases') ?? '3'),
    };
    
    console.log('[getRAGConfig] âœ… ConfiguraÃ§Ã£o RAG carregada:', {
      model: config.model,
      minThreshold: config.minThreshold,
      directThreshold: config.directThreshold,
      sources: config.sources,
      strictMode: config.strictMode,
      blockFinancial: config.blockFinancial,
      confidenceDirect: config.confidenceDirect,
      confidenceHandoff: config.confidenceHandoff,
      ragMinThreshold: config.ragMinThreshold,
      maxFallback: config.maxFallback,
    });
    
    return config;
  } catch (error) {
    console.error('[getRAGConfig] Exception:', error);
    return DEFAULT_RAG_CONFIG;
  }
}

// Sanitize legacy gateway model names to real OpenAI model names
// Valid OpenAI models pass through unchanged
const VALID_OPENAI_MODELS = new Set([
  'gpt-4o', 'gpt-4o-mini',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.2',
  'o3', 'o3-mini', 'o4-mini', 'o4',
]);

// Models that require max_completion_tokens instead of max_tokens
const MAX_COMPLETION_TOKEN_MODELS = new Set([
  'o3', 'o3-mini', 'o4-mini', 'o4',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.2',
]);

function sanitizeModelName(model: string): string {
  // If it's already a valid OpenAI model, pass through
  if (VALID_OPENAI_MODELS.has(model)) return model;
  
  // Gateway names â†’ correct OpenAI equivalents
  const MODEL_MAP: Record<string, string> = {
    'openai/gpt-5-mini': 'gpt-5-mini',
    'openai/gpt-5': 'gpt-5',
    'openai/gpt-5-nano': 'gpt-5-nano',
    'openai/gpt-5.2': 'gpt-5.2',
    'google/gemini-2.5-flash': 'gpt-5-mini',
    'google/gemini-2.5-flash-lite': 'gpt-5-nano',
    'google/gemini-2.5-pro': 'gpt-5',
    'google/gemini-3-pro-preview': 'gpt-5',
    'google/gemini-3-pro-image-preview': 'gpt-5',
    'google/gemini-3-flash-preview': 'gpt-5-mini',
    'google/gemini-3.1-pro-preview': 'gpt-5',
    'google/gemini-3.1-flash-image-preview': 'gpt-5-mini',
  };
  return MODEL_MAP[model] || 'gpt-5-nano';
}

// Helper: Buscar modelo AI configurado no banco (mantido para compatibilidade)
async function getConfiguredAIModel(supabaseClient: any): Promise<string> {
  const config = await getRAGConfig(supabaseClient);
  return config.model;
}

// ============================================================
// ðŸ”§ HELPER: Extrair nÃºmero limpo do whatsapp_id
// Prioriza whatsapp_id sobre phone para envio Meta API
// Formatos suportados:
//   - 5511999999999@s.whatsapp.net
//   - 5511999999999@c.us
//   - 5511999999999
// ============================================================
function extractWhatsAppNumber(whatsappId: string | null | undefined): string | null {
  if (!whatsappId) return null;
  
  // Se for nÃºmero @lid (lead ID do Meta), retornar null - nÃ£o Ã© um nÃºmero vÃ¡lido
  if (whatsappId.includes('@lid')) {
    console.log('[extractWhatsAppNumber] âš ï¸ Lead ID detectado, ignorando:', whatsappId);
    return null;
  }
  
  // Remove sufixos do WhatsApp e caracteres nÃ£o numÃ©ricos
  const cleaned = whatsappId
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace(/\D/g, '');
  
  // Validar se tem pelo menos 10 dÃ­gitos (nÃºmero vÃ¡lido)
  if (cleaned.length >= 10) {
    return cleaned;
  }
  
  console.log('[extractWhatsAppNumber] âš ï¸ NÃºmero invÃ¡lido apÃ³s limpeza:', { original: whatsappId, cleaned });
  return null;
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
      console.log(`[getMessageTemplate] Template "${key}" nÃ£o encontrado ou inativo`);
      return null;
    }

    // Substituir variÃ¡veis {{var}} pelos valores
    let content = data.content;
    Object.entries(variables).forEach(([varKey, value]) => {
      content = content.replace(new RegExp(`\\{\\{${varKey}\\}\\}`, 'g'), value || '');
    });

    console.log(`[getMessageTemplate] âœ… Template "${key}" carregado com sucesso`);
    return content;
  } catch (error) {
    console.error(`[getMessageTemplate] Erro ao buscar template "${key}":`, error);
    return null;
  }
}

// FASE 2: FunÃ§Ã£o para gerar hash SHA-256 da pergunta normalizada
async function generateQuestionHash(message: string): Promise<string> {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/g, "") // Remove pontuaÃ§Ã£o
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
// ðŸ†• FASE 1: Truncar resposta ao mÃ¡ximo de frases permitido
// Enforce pÃ³s-processamento para garantir verbosidade controlada
// ============================================================
function limitSentences(text: string, maxSentences: number): string {
  // Separar por pontuaÃ§Ã£o final (. ! ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length <= maxSentences) {
    return text;
  }
  
  // Truncar ao mÃ¡ximo permitido
  const truncated = sentences.slice(0, maxSentences).join(' ').trim();
  console.log(`[ai-autopilot-chat] âœ‚ï¸ Resposta truncada de ${sentences.length} para ${maxSentences} frases`);
  
  return truncated;
}

// ============================================================
// ðŸ†• FASE 1: Log de violaÃ§Ã£o de allowed_sources (nÃ£o bloqueante)
// Registra quando a IA usa fontes nÃ£o autorizadas para auditoria
// ============================================================
function logSourceViolationIfAny(
  response: string, 
  allowedSources: string[],
  kbUsed: boolean,
  crmUsed: boolean,
  trackingUsed: boolean,
  kiwifyUsed: boolean = false,
  sandboxUsed: boolean = false
): void {
  const violations: string[] = [];
  
  if (!allowedSources.includes('kb') && kbUsed) violations.push('kb_not_allowed');
  if (!allowedSources.includes('crm') && crmUsed) violations.push('crm_not_allowed');
  if (!allowedSources.includes('tracking') && trackingUsed) violations.push('tracking_not_allowed');
  if (!allowedSources.includes('kiwify') && kiwifyUsed) violations.push('kiwify_not_allowed');
  if (!allowedSources.includes('sandbox') && sandboxUsed) violations.push('sandbox_not_allowed');
  
  if (violations.length > 0) {
    console.warn('[ai-autopilot-chat] âš ï¸ SOURCE VIOLATION (nÃ£o bloqueante):', {
      violations,
      allowedSources,
      responsePreview: response.substring(0, 100)
    });
  }
}

// ============================================================
// ðŸ›¡ï¸ HELPER: Safe JSON parse para argumentos de tool calls do LLM
// Limpa markdown fences, trailing commas, control chars
// ============================================================
function safeParseToolArgs(rawArgs: string): any {
  let cleaned = rawArgs;
  
  // 1. Remover markdown code fences (```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  
  // 2. Remover BOM e control characters (exceto \n, \r, \t)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  
  // 3. Tentar parse direto
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continuar para correÃ§Ãµes
  }
  
  // 4. Corrigir trailing commas antes de } ou ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  
  // 5. Tentar novamente
  try {
    return JSON.parse(cleaned);
  } catch (finalErr) {
    console.error('[safeParseToolArgs] âŒ Parse falhou mesmo apÃ³s limpeza:', {
      original: rawArgs.substring(0, 200),
      cleaned: cleaned.substring(0, 200),
      error: finalErr instanceof Error ? finalErr.message : String(finalErr)
    });
    throw new Error(`Failed to parse tool arguments: ${finalErr instanceof Error ? finalErr.message : 'unknown'}`);
  }
}

// ============================================================
// ðŸ”¢ HELPER: Formatar opÃ§Ãµes de mÃºltipla escolha como texto
// Transforma array de opÃ§Ãµes em lista numerada com emojis
// ============================================================
function formatOptionsAsText(options: Array<{label: string; value: string}> | null | undefined): string {
  if (!options || options.length === 0) return '';
  
  const numberEmojis = ['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3', '4\uFE0F\u20E3', '5\uFE0F\u20E3', '6\uFE0F\u20E3', '7\uFE0F\u20E3', '8\uFE0F\u20E3', '9\uFE0F\u20E3', '\uD83D\uDD1F'];
  
  const formatted = options.map((opt, idx) => {
    const emoji = numberEmojis[idx] || `${idx + 1}.`;
    return `${emoji} ${opt.label}`;
  }).join('\n');
  
  return `\n\n${formatted}`;
}

// ============================================================
// ðŸ†• DETECTOR DE INTENÃ‡ÃƒO PARA PRESERVAÃ‡ÃƒO DE CONTEXTO
// Identifica a categoria da intenÃ§Ã£o original do cliente
// para recuperar contexto apÃ³s verificaÃ§Ã£o de email
// ============================================================
function detectIntentCategory(message: string): string | null {
  const msgLower = message.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Cancelamento
  if (/cancel|assinatura|desinscrever|cancela|desinscricao/.test(msgLower)) return 'cancellation';
  
  // Reembolso
  if (/reembolso|devol|devolucao|trocar|estorno/.test(msgLower)) return 'refund';
  
  // Saque
  if (/saque|sacar|carteira|retirar.*saldo|transferir.*saldo/.test(msgLower)) return 'withdrawal';
  
  // Rastreio/Pedidos
  if (/rastreio|entrega|pedido|envio|rastrear|correio|chegou/.test(msgLower)) return 'tracking';
  
  // Problema tÃ©cnico
  if (/erro|bug|nao funciona|problema|travou|nao consigo|travar/.test(msgLower)) return 'technical';
  
  // Acesso/Login
  if (/senha|login|acesso|entrar|area.*membro|acessar/.test(msgLower)) return 'access';
  
  // CobranÃ§a/Pagamento
  if (/cobranca|cobraram|pagamento|pagar|boleto|fatura/.test(msgLower)) return 'billing';
  
  return null; // IntenÃ§Ã£o genÃ©rica
}

// Helper: Traduzir categoria de intenÃ§Ã£o para texto amigÃ¡vel
function getIntentCategoryLabel(category: string | null): string {
  const labels: Record<string, string> = {
    'cancellation': 'cancelamento',
    'refund': 'reembolso',
    'withdrawal': 'saque',
    'tracking': 'seu pedido/entrega',
    'technical': 'problema técnico',
    'access': 'acesso à plataforma',
    'billing': 'cobrança'
  };
  return category ? labels[category] || 'sua dúvida' : 'sua dúvida';
}

// ============================================================
// ðŸ†• EXTRATOR DE EMAIL TOLERANTE (WhatsApp-safe)
// Reconhece emails mesmo quando quebrados por newline/espaÃ§os
// ============================================================
interface EmailExtractionResult {
  found: boolean;
  email: string | null;
  source: 'original' | 'compact' | null;
  debugInfo: {
    originalText: string;
    compactText: string;
    originalMatch: string | null;
    compactMatch: string | null;
  };
}

function extractEmailTolerant(text: string): EmailExtractionResult {
  // Regex robusto para email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  
  // 1. Tentar extrair do texto original
  const originalMatch = text.match(emailRegex);
  if (originalMatch && originalMatch[0]) {
    console.log('[extractEmailTolerant] âœ… Email encontrado no texto ORIGINAL:', originalMatch[0]);
    return {
      found: true,
      email: originalMatch[0].toLowerCase(),
      source: 'original',
      debugInfo: {
        originalText: text.substring(0, 100),
        compactText: '',
        originalMatch: originalMatch[0],
        compactMatch: null
      }
    };
  }
  
  // 2. Se nÃ£o encontrou, tentar com texto COMPACTADO (remove espaÃ§os, newlines, tabs)
  const compactText = text.replace(/[\s\n\r\t]+/g, '');
  const compactMatch = compactText.match(emailRegex);
  
  if (compactMatch && compactMatch[0]) {
    console.log('[extractEmailTolerant] âœ… Email encontrado no texto COMPACTADO:', compactMatch[0]);
    console.log('[extractEmailTolerant] ðŸ“ Texto original tinha quebras:', text.substring(0, 100));
    return {
      found: true,
      email: compactMatch[0].toLowerCase(),
      source: 'compact',
      debugInfo: {
        originalText: text.substring(0, 100),
        compactText: compactText.substring(0, 100),
        originalMatch: null,
        compactMatch: compactMatch[0]
      }
    };
  }
  
  // 3. Nenhum email encontrado
  console.log('[extractEmailTolerant] âŒ Nenhum email encontrado no texto:', text.substring(0, 100));
  return {
    found: false,
    email: null,
    source: null,
    debugInfo: {
      originalText: text.substring(0, 100),
      compactText: compactText.substring(0, 100),
      originalMatch: null,
      compactMatch: null
    }
  };
}

// ============================================================
// ðŸ”’ HELPER: SeleÃ§Ã£o de InstÃ¢ncia WhatsApp (Multi-Provider)
// Suporta tanto Meta WhatsApp Cloud API quanto Evolution API
// SEMPRE prioriza a instÃ¢ncia vinculada Ã  conversa
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
  // 1. Se Ã© Meta provider, buscar na tabela whatsapp_meta_instances
  if (whatsappProvider === 'meta' && whatsappMetaInstanceId) {
    const { data: metaInstance } = await supabaseClient
      .from('whatsapp_meta_instances')
      .select('*')
      .eq('id', whatsappMetaInstanceId)
      .maybeSingle();
    
    if (metaInstance && metaInstance.status === 'active') {
      console.log('[getWhatsAppInstance] âœ… Usando instÃ¢ncia META:', {
        instanceId: metaInstance.id,
        phoneNumberId: metaInstance.phone_number_id,
        name: metaInstance.name,
        status: metaInstance.status
      });
      return { instance: metaInstance, provider: 'meta' };
    } else {
      console.warn('[getWhatsAppInstance] âš ï¸ InstÃ¢ncia META vinculada nÃ£o encontrada ou inativa:', whatsappMetaInstanceId);
    }
  }
  
  // 2. Fallback para Meta se provider Ã© meta mas instÃ¢ncia vinculada nÃ£o existe
  if (whatsappProvider === 'meta') {
    const { data: fallbackMeta } = await supabaseClient
      .from('whatsapp_meta_instances')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    
    if (fallbackMeta) {
      console.log('[getWhatsAppInstance] ðŸ”„ Usando instÃ¢ncia META FALLBACK:', {
        instanceId: fallbackMeta.id,
        phoneNumberId: fallbackMeta.phone_number_id,
        name: fallbackMeta.name
      });
      return { instance: fallbackMeta, provider: 'meta' };
    }
    
    console.error('[getWhatsAppInstance] âŒ Nenhuma instÃ¢ncia Meta WhatsApp disponÃ­vel');
    return null;
  }
  
  // ========== EVOLUTION API (Legacy) ==========
  // 3. Se a conversa tem instÃ¢ncia Evolution vinculada, usar ela
  if (conversationWhatsappInstanceId) {
    const { data: linkedInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('*')
      .eq('id', conversationWhatsappInstanceId)
      .maybeSingle();
    
    if (linkedInstance) {
      console.log('[getWhatsAppInstance] âœ… Usando instÃ¢ncia Evolution VINCULADA:', {
        instanceId: linkedInstance.id,
        instanceName: linkedInstance.instance_name,
        phoneNumber: linkedInstance.phone_number,
        status: linkedInstance.status
      });
      return { instance: linkedInstance, provider: 'evolution' };
    } else {
      console.warn('[getWhatsAppInstance] âš ï¸ InstÃ¢ncia Evolution vinculada nÃ£o encontrada:', conversationWhatsappInstanceId);
    }
  }
  
  // 4. Fallback Evolution: buscar instÃ¢ncia conectada APENAS se nÃ£o houver vinculada
  console.warn('[getWhatsAppInstance] âš ï¸ Conversa', conversationId, 'sem instÃ¢ncia vinculada - usando fallback Evolution');
  const { data: fallbackInstance } = await supabaseClient
    .from('whatsapp_instances')
    .select('*')
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (fallbackInstance) {
    console.log('[getWhatsAppInstance] ðŸ”„ Usando instÃ¢ncia Evolution FALLBACK:', {
      instanceId: fallbackInstance.id,
      instanceName: fallbackInstance.instance_name,
      phoneNumber: fallbackInstance.phone_number
    });
    return { instance: fallbackInstance, provider: 'evolution' };
  }
  
  console.error('[getWhatsAppInstance] âŒ Nenhuma instÃ¢ncia WhatsApp disponÃ­vel');
  return null;
}

// ðŸ”„ WRAPPER MULTI-PROVIDER: Busca dinamicamente o provider da conversa
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
  
  // Buscar dados da conversa se nÃ£o foram passados
  if (!provider && conversationId) {
    const { data } = await supabaseClient
      .from('conversations')
      .select('whatsapp_provider, whatsapp_meta_instance_id')
      .eq('id', conversationId)
      .maybeSingle();
    
    provider = data?.whatsapp_provider;
    metaInstanceId = data?.whatsapp_meta_instance_id;
  }
  
  console.log('[getWhatsAppInstanceForConversation] ðŸ” Provider detectado:', {
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

// ðŸ“¤ HELPER: Enviar mensagem via WhatsApp (Meta ou Evolution)
async function sendWhatsAppMessage(
  supabaseClient: any,
  whatsappResult: WhatsAppInstanceResult,
  phoneNumber: string,
  message: string,
  conversationId: string,
  whatsappId?: string | null,
  useQueue: boolean = false,
  senderName?: string | null // ðŸ†• Nome do remetente para prefixar mensagem
): Promise<{ success: boolean; error?: any }> {
  try {
    if (whatsappResult.provider === 'meta') {
      // ðŸ†• CORREÃ‡ÃƒO: Priorizar whatsapp_id sobre phone
      const targetNumber = extractWhatsAppNumber(whatsappId) || phoneNumber?.replace(/\D/g, '');
      
      console.log('[sendWhatsAppMessage] ðŸ“¤ Enviando via Meta WhatsApp API:', {
        instanceId: whatsappResult.instance.id,
        phoneNumberId: whatsappResult.instance.phone_number_id,
        targetNumber: targetNumber?.slice(-4),
        usedWhatsappId: !!extractWhatsAppNumber(whatsappId),
        source: extractWhatsAppNumber(whatsappId) ? 'whatsapp_id' : 'phone',
        senderName: senderName || 'N/A'
      });
      
      const { data, error } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
        body: {
          instance_id: whatsappResult.instance.id,
          phone_number: targetNumber, // ðŸ†• Usa whatsapp_id se disponÃ­vel
          message,
          conversation_id: conversationId,
          skip_db_save: true, // ðŸ†• CRÃTICO: Quem chama jÃ¡ salvou a mensagem
          sender_name: senderName || undefined, // ðŸ†• Nome da persona/agente
          is_bot_message: true // ðŸ†• Mensagem de IA = bot message (nÃ£o muda ai_mode)
        }
      });
      
      if (error) {
        console.error('[sendWhatsAppMessage] âŒ Erro Meta WhatsApp:', error);
        return { success: false, error };
      }
      
      console.log('[sendWhatsAppMessage] âœ… Mensagem enviada via Meta WhatsApp API');
      return { success: true };
      
    } else {
      console.log('[sendWhatsAppMessage] ðŸ“¤ Enviando via Evolution API:', {
        instanceId: whatsappResult.instance.id,
        instanceName: whatsappResult.instance.instance_name,
        phoneNumber: phoneNumber?.replace(/\D/g, '').slice(-4)
      });
      
      // ðŸ†• Para Evolution, prefixar manualmente a mensagem com nome em negrito
      const formattedMessage = senderName ? `*${senderName}*\n${message}` : message;
      
      const { data, error } = await supabaseClient.functions.invoke('send-whatsapp-message', {
        body: {
          instance_id: whatsappResult.instance.id,
          phone_number: phoneNumber,
          whatsapp_id: whatsappId,
          message: formattedMessage,
          conversation_id: conversationId,
          use_queue: useQueue
        }
      });
      
      if (error) {
        console.error('[sendWhatsAppMessage] âŒ Erro Evolution API:', error);
        return { success: false, error };
      }
      
      console.log('[sendWhatsAppMessage] âœ… Mensagem enviada via Evolution API');
      return { success: true };
    }
  } catch (err) {
    console.error('[sendWhatsAppMessage] âŒ ExceÃ§Ã£o ao enviar:', err);
    return { success: false, error: err };
  }
}

// ============================================================
// ðŸ”’ CONSTANTES GLOBAIS - Unificadas para prevenir inconsistÃªncias
// ============================================================
// âœ… FIX 1: FALLBACK_PHRASES reconstruÃ­da para NÃƒO conflitar com system prompt da persona.
// Removidas frases legÃ­timas que a IA Ã© instruÃ­da a dizer (ex: 'preciso verificar', 'nÃ£o tenho certeza').
// Mantidas APENAS frases que indicam transferÃªncia real ou incapacidade total de ajudar.
const FALLBACK_PHRASES = [
  'vou chamar um especialista',
  'vou transferir para um atendente',
  'transferir para um atendente',
  'encaminhar para um humano',
  'chamar um atendente',
  'nÃ£o consigo',
  'nÃ£o posso ajudar',
  'sorry',
  'i cannot',
  'unable to',
  'melhor falar com',
  'direcionar para',
  'encontrar o especialista',
  'menu de atendimento',
  'vou te direcionar',
  'vou te encaminhar',
  'encaminhar para o setor',
  'transferir para o setor',
  'vou transferir vocÃª para um especialista',
  // Redirecionamentos explÃ­citos
  'redirecionar para',
  'encaminhar vocÃª',
  'direcionar vocÃª',
];

// ðŸ” BARREIRA FINANCEIRA - Palavras que identificam contexto FINANCEIRO (sem OTP obrigatÃ³rio)
// Estas palavras detectam intenÃ§Ã£o financeira mas NÃƒO exigem OTP
const FINANCIAL_BARRIER_KEYWORDS = [
  'saque',
  'sacar',
  'saldo',
  'pix',
  'dinheiro',
  'pagamento',
  'reembolso',
  'comissÃ£o',
  'carteira',
  'transferÃªncia',
  'estorno',
  'cancelar',
  'cancelamento',
  'devoluÃ§Ã£o',
  'devolver',
  'meu dinheiro'
];

// ðŸ” OPERAÃ‡Ã•ES QUE EXIGEM OTP OBRIGATÃ“RIO (APENAS SAQUE DE SALDO/CARTEIRA)
// OTP Ã© necessÃ¡rio APENAS quando cliente quer SACAR dinheiro da carteira
// Cancelamentos, reembolsos de pedidos Kiwify NÃƒO precisam de OTP
const OTP_REQUIRED_KEYWORDS = [
  // ðŸ†• Removidos 'saque' e 'sacar' isolados â€” termos ambÃ­guos devem ser desambiguados pela IA
  // A detecÃ§Ã£o de saque composto jÃ¡ Ã© coberta por WITHDRAWAL_ACTION_PATTERNS
  'retirar saldo',
  'retirar dinheiro',
  'transferir saldo',
  'transferir meu saldo',
  'saque pix',
  'saque via pix',
  'saque carteira',
  'sacar da carteira',
  'sacar meu saldo',
  'quero sacar',
  'fazer saque',
  'solicitar saque'
];

// ============================================================
// ðŸŽ¯ SISTEMA ANTI-ALUCINAÃ‡ÃƒO - SCORE DE CONFIANÃ‡A (Sprint 2)
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

// Thresholds - AGORA DINÃ‚MICOS via getRAGConfig()
// Valores abaixo sÃ£o FALLBACK apenas - a funÃ§Ã£o calculateConfidenceScore usa config dinÃ¢mica
const SCORE_DIRECT = 0.75;   // Fallback: Alta confianÃ§a - responde direto
const SCORE_CAUTIOUS = 0.40; // Fallback: MÃ©dia confianÃ§a - responde com cautela 
const SCORE_MINIMUM = 0.25;  // Fallback: MÃ­nimo raised - evita respostas com < 25% de confianÃ§a

// ðŸ†• Thresholds do MODO RAG ESTRITO (Anti-AlucinaÃ§Ã£o) - mais conservador
const STRICT_SCORE_MINIMUM = 0.50;   // Modo estrito mais tolerante
const STRICT_SIMILARITY_THRESHOLD = 0.45; // Artigos com menos de 45% sÃ£o ignorados

// ðŸ†• PADRÃ•ES DE PEDIDO EXPLÃCITO DE ATENDENTE HUMANO
// SÃ“ fazer handoff automÃ¡tico se cliente usar essas frases
const EXPLICIT_HUMAN_REQUEST_PATTERNS = [
  /quero\s*(falar\s*(com)?)?\s*(um\s*)?(atendente|humano|pessoa|agente|suporte)/i,
  /preciso\s*(de\s*)?(um\s*)?(atendente|humano|pessoa|agente)/i,
  /fala(r)?\s+com\s+(um\s+)?(atendente|humano|pessoa|alguém|alguem)/i,
  /me\s+(transfere|transfira|passa)\s+(para|a)\s+(um\s+)?(atendente|humano|pessoa)/i,
  /transferir\s+(para)?\s*(um\s*)?(atendente|humano)/i,
  /chamar?\s*(um\s*)?(atendente|humano|pessoa)/i,
  /não\s*consigo\s*resolver\s*(sozinho)?/i,
  /atendimento\s*humano/i,
  /pessoa\s*real/i,
  /suporte\s*humano/i,
];

// ðŸ†• Indicadores de incerteza/alucinaÃ§Ã£o para validaÃ§Ã£o pÃ³s-resposta
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

// ðŸ†• GATILHOS REMOVIDOS: IA nÃ£o faz mais handoff automÃ¡tico por keywords
// A IA agora SEMPRE tenta responder e sÃ³ transfere se cliente PEDIR EXPLICITAMENTE
// const IMMEDIATE_HANDOFF_TRIGGERS foi REMOVIDO

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
  
  // Verificar diferenÃ§a de idade entre documentos (mais de 90 dias)
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

// ðŸ†• Helper: Verificar handoff imediato - DESABILITADO
// IA NÃƒO faz mais handoff automÃ¡tico por keywords
function checkImmediateHandoff(query: string): { triggered: boolean; dept?: string; reason?: string } {
  // REMOVIDO: Handoff automÃ¡tico por keywords
  // Agora retorna sempre false - handoff sÃ³ acontece se cliente PEDIR EXPLICITAMENTE
  return { triggered: false };
}

// Helper: Determinar departamento por keywords (OTIMIZADO com regex e prioridade)
// ðŸ†• ATUALIZADO: Retorna slugs que mapeiam para sub-departamentos especÃ­ficos
function pickDepartment(question: string): string {
  // Normalizar: lowercase + remover acentos para matching consistente
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Ordem de prioridade: Financeiro > TÃ©cnico/Sistema > Pedidos/LogÃ­stica > Comercial > Suporte Geral
  const rules: Array<{ dept: string; patterns: RegExp }> = [
    // Financeiro - maior prioridade
    { dept: 'financeiro', patterns: /saque|sacar|pix|reembolso|estorno|comiss[aÃ£]o|pagamento|carteira|boleto|fatura|cobran[cÃ§]a|saldo|recarga|transfer[eÃª]ncia.*banc|transf.*banc|valor de volta|dinheiro devolvido|reembolsado/ },
    // Suporte Sistema (tÃ©cnico) - segunda maior prioridade
    { dept: 'suporte_sistema', patterns: /erro|bug|login|senha|acesso|n[aÃ£]o funciona|travou|caiu|site fora|api|integra[cÃ§][aÃ£]o|token|sistema|nao funciona|num funciona|tela branca|pagina nao carrega|problema tecnico|suporte tecnico/ },
    // Suporte Pedidos (logÃ­stica/rastreio) - terceira prioridade
    { dept: 'suporte_pedidos', patterns: /envio|entrega|rastreio|transportadora|correios|prazo|encomenda|coleta|endereco|cep|frete|pedido|onde.*pedido|status.*pedido|rastrear|devolu[cÃ§][aÃ£]o|devolver.*pedido|devolvido|devolvi|problema.*envio|envio incorreto|produto errado|cancelar.*pedido|transfer[eÃª]ncia.*endereco|transfer.*pedido/ },
    // Comercial - quarta prioridade
    { dept: 'comercial', patterns: /pre[cÃ§]o|proposta|plano|quanto custa|comprar|assinar|desconto|trial|teste|orcamento|catalogo|tabela|upgrade|downgrade|mudar plano|conhecer|demonstra[cÃ§][aÃ£]o|demo/ },
  ];
  
  for (const rule of rules) {
    if (rule.patterns.test(q)) {
      console.log(`[pickDepartment] Departamento detectado: ${rule.dept} (match na query: "${question.slice(0, 50)}...")`);
      return rule.dept;
    }
  }
  
  console.log(`[pickDepartment] Nenhum departamento especÃ­fico detectado, usando suporte_n1`);
  return 'suporte_n1';
}

// ðŸŽ¯ FUNÃ‡ÃƒO PRINCIPAL: Calcular Score de ConfianÃ§a (ATUALIZADA para thresholds dinÃ¢micos)
function calculateConfidenceScore(
  query: string, 
  documents: RetrievedDocument[],
  ragConfig?: RAGConfig
): ConfidenceResult {
  // Usar thresholds dinÃ¢micos do RAGConfig ou fallback para constantes
  const scoreDirectThreshold = ragConfig?.directThreshold ?? SCORE_DIRECT;
  const scoreMinThreshold = ragConfig?.minThreshold ?? SCORE_MINIMUM;
  const scoreCautious = (scoreDirectThreshold + scoreMinThreshold) / 2; // Ponto mÃ©dio dinÃ¢mico
  
  console.log('[calculateConfidenceScore] Usando thresholds:', {
    direct: scoreDirectThreshold,
    cautious: scoreCautious,
    minimum: scoreMinThreshold,
    strictMode: ragConfig?.strictMode ?? false
  });
  
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
  
  // 4. FÃ“RMULA: SCORE = 0.6*retrieval + 0.4*coverage - 0.25*conflicts
  let score = (0.6 * confRetrieval) + (0.4 * coverage);
  if (conflicts) score -= 0.25;
  
  // ðŸ†• FASE 4: Boost para matches semÃ¢nticos fortes
  const hasSemanticMatch = documents.some(d => d.similarity && d.similarity > 0.8);
  if (hasSemanticMatch) {
    score += 0.1; // Boost de 10% para matches semÃ¢nticos fortes
  }
  
  // ðŸ†• FASE 4: Penalidade para documentos muito antigos (> 6 meses)
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
  
  // ðŸ†• Modo Estrito: usar thresholds mais conservadores
  const effectiveMinThreshold = ragConfig?.strictMode ? STRICT_SCORE_MINIMUM : scoreMinThreshold;
  
  // 5. Determinar aÃ§Ã£o - NOVA LÃ“GICA: IA SEMPRE tenta responder
  // Handoff SÃ“ acontece se cliente pedir explicitamente (verificado separadamente)
  let action: 'direct' | 'cautious' | 'handoff';
  let reason: string;
  
  if (score >= scoreDirectThreshold) {
    action = 'direct';
    reason = `Alta confianÃ§a (${(score * 100).toFixed(0)}%) - Resposta direta`;
  } else if (score >= scoreCautious) {
    action = 'cautious';
    reason = `ConfianÃ§a mÃ©dia (${(score * 100).toFixed(0)}%) - Resposta com base na KB`;
  } else if (documents.length > 0 && score >= effectiveMinThreshold) {
    // Se tem artigos e estÃ¡ acima do mÃ­nimo, tenta responder com cautela
    action = 'cautious';
    reason = `Baixa confianÃ§a (${(score * 100).toFixed(0)}%) mas encontrou ${documents.length} artigo(s) - tentando responder`;
  } else if (ragConfig?.strictMode && score < effectiveMinThreshold) {
    // ðŸ†• Modo Estrito: handoff se abaixo do threshold mÃ­nimo
    action = 'handoff';
    reason = `Modo Estrito: confianÃ§a (${(score * 100).toFixed(0)}%) abaixo do mÃ­nimo (${(effectiveMinThreshold * 100).toFixed(0)}%)`;
  } else {
    // Modo normal: tenta ajudar sempre
    action = 'cautious';
    reason = `ConfianÃ§a baixa (${(score * 100).toFixed(0)}%) - Resposta genÃ©rica, oferecendo ajuda`;
  }
  
  return {
    score,
    components: { retrieval: confRetrieval, coverage, conflicts },
    action,
    reason,
    department: undefined
  };
}

// Helper: Gerar prefixo de resposta baseado na confianÃ§a
function generateResponsePrefix(action: 'direct' | 'cautious' | 'handoff'): string {
  switch (action) {
    case 'direct':
      return ''; // Sem prefixo para respostas diretas
    case 'cautious':
      return ''; // Removido: prefixo cauteloso vazava metadados internos
    case 'handoff':
      return ''; // Handoff usa mensagem prÃ³pria
  }
}

// Estrutura de log para mÃ©tricas
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

// 🆕 Padrões de INTENÇÃO financeira (contexto geral) - NÃO exige OTP
const FINANCIAL_ACTION_PATTERNS = [
  // Padrões de consulta (SEM OTP)
  /ver\s+(meu\s+)?saldo/i,                            // "quero ver meu saldo"
  /consultar\s+(meu\s+)?saldo/i,                      // "consultar saldo"
  /quanto\s+tenho\s+(de\s+)?saldo/i,                  // "quanto tenho de saldo"
  
  // Padrões de problemas gerais (SEM OTP)
  /cadê\s+(meu\s+saldo|meu\s+dinheiro|meu\s+pix)/i,
  /não\s+(recebi|caiu|chegou)\s+(o\s+)?(pix|pagamento|saldo|dinheiro)/i,
  /erro\s+(no|de)\s+pagamento/i,
  /cobrar|cobraram\s+errado/i,
];

// 🔐 Padrões de SAQUE DE SALDO (EXIGE OTP) - Apenas movimentação de dinheiro da carteira
const WITHDRAWAL_ACTION_PATTERNS = [
  /quero\s+(fazer\s+)?(um\s+)?saque/i,                // "quero fazer um saque", "quero saque"
  /preciso\s+(fazer\s+)?(um\s+)?saque/i,              // "preciso fazer um saque"
  /saque\s+(da\s+)?(minha\s+)?carteira/i,             // "saque da minha carteira"
  /fazer\s+(um\s+)?saque/i,                           // "fazer saque"
  /quero\s+sacar/i,                                   // "quero sacar"
  /preciso\s+sacar/i,                                 // "preciso sacar"
  /transferir\s+(meu\s+)?saldo/i,                     // "transferir meu saldo"
  /retirar\s+(meu\s+)?dinheiro/i,                     // "retirar meu dinheiro"
  /retirar\s+(meu\s+)?saldo/i,                        // "retirar meu saldo"
  /sacar\s+(meu\s+)?saldo/i,                          // "sacar meu saldo"
  /sacar\s+(meu\s+)?dinheiro/i,                       // "sacar meu dinheiro"
  /saque\s+pix/i,                                     // "saque pix"
  /saque\s+via\s+pix/i,                               // "saque via pix"
  /solicitar\s+saque/i,                               // "solicitar saque"
  /pedir\s+saque/i,                                   // "pedir saque"
];

// 🆕 Padrões de REEMBOLSO DE PEDIDO (SEM OTP) - Devolução de pedido Kiwify
// A IA explica o processo e só transfere se cliente insistir
const REFUND_ACTION_PATTERNS = [
  /quero\s+reembolso/i,                               // "quero reembolso"
  /preciso\s+(de\s+)?reembolso/i,                     // "preciso de reembolso"
  /devolver\s+(meu\s+)?dinheiro/i,                    // "devolver meu dinheiro"
  /quero\s+meu\s+dinheiro\s+(de\s+)?volta/i,          // "quero meu dinheiro de volta"
  /estornar/i,                                        // "estornar"
  /estorno/i,                                         // "estorno"
  /cancelar\s+(meu\s+)?pedido/i,                      // "cancelar meu pedido"
  /devolução/i,                                       // "devolução"
  /devolver\s+pedido/i,                               // "devolver pedido"
];

// 🆕 Padrões de CANCELAMENTO DE ASSINATURA (SEM OTP) - Kiwify
const CANCELLATION_ACTION_PATTERNS = [
  /cancelar\s+(minha\s+)?assinatura/i,                // "cancelar minha assinatura"
  /cancelamento\s+(de\s+)?assinatura/i,               // "cancelamento de assinatura"
  /quero\s+cancelar/i,                                // "quero cancelar"
  /preciso\s+cancelar/i,                              // "preciso cancelar"
  /encerrar\s+(minha\s+)?assinatura/i,                // "encerrar minha assinatura"
  /parar\s+(de\s+)?pagar/i,                           // "parar de pagar"
  /não\s+quero\s+mais\s+pagar/i,                      // "não quero mais pagar"
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
  // Usa ticket_number se disponÃ­vel, senÃ£o fallback para UUID truncado
  const formattedId = ticketNumber || ticketId.slice(0, 8).toUpperCase();
  
  // FASE 5: Mensagem especÃ­fica para SAQUE com dados coletados - buscar template
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
    return `Solicitação de saque registrada!

Protocolo: #${formattedId}
Valor Solicitado: R$ ${withdrawalData.amount.toFixed(2)}
${withdrawalData.cpf_last4 ? `CPF (final): ...${withdrawalData.cpf_last4}` : ''}
Prazo: até 7 dias úteis

Você receberá um email confirmando a abertura do chamado.
Quando o saque for processado, você será notificado por email também.

IMPORTANTE: O saque será creditado via PIX na chave informada, vinculada ao seu CPF. Não é possível transferir para conta de terceiros.`;
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
  const orderInfo = orderId ? `\n\nPedido: ${orderId}` : '';
  
  return `${baseMessage}${orderInfo}`;
}

// ============================================================
// ðŸ†• CONTRATO ANTI-ALUCINAÃ‡ÃƒO: flow_context obrigatÃ³rio
// ============================================================
interface FlowContext {
  flow_id: string;
  node_id: string;
  node_type: 'ai_response';
  allowed_sources: ('kb' | 'crm' | 'tracking' | 'kiwify' | 'sandbox')[];
  response_format: 'text_only';
  personaId?: string;
  kbCategories?: string[];
  contextPrompt?: string;
  fallbackMessage?: string;
  // ðŸ†• FASE 1: Campos de Controle de Comportamento Anti-AlucinaÃ§Ã£o
  objective?: string;
  maxSentences?: number;
  forbidQuestions?: boolean;
  forbidOptions?: boolean;
  forbidFinancial?: boolean;
  forbidCommercial?: boolean;
  forbidCancellation?: boolean;
  forbidSupport?: boolean;
  forbidConsultant?: boolean;
  collectedData?: any;
}

// ðŸ†• FASE 1: FunÃ§Ã£o para gerar prompt RESTRITIVO baseado no flow_context
// Substitui o prompt extenso quando flow_context tem controles ativos
function generateRestrictedPrompt(flowContext: FlowContext, contactName: string, contactStatus: string, enrichment?: { orgName?: string | null; consultantName?: string | null; sellerName?: string | null; tags?: string[] }): string {
  const maxSentences = flowContext.maxSentences ?? 3;
  const objective = flowContext.objective || 'Responder a dÃºvida do cliente';
  const forbidQuestions = flowContext.forbidQuestions ?? true;
  const forbidOptions = flowContext.forbidOptions ?? true;
  const forbidFinancial = flowContext.forbidFinancial ?? false;
  
  let restrictions = `Você é um assistente corporativo.
Responda SOMENTE ao seguinte objetivo: "${objective}"
Use APENAS as fontes permitidas: ${flowContext.allowed_sources.join(', ')}.
Sua resposta deve ter NO MÁXIMO ${maxSentences} frases.`;

  if (forbidQuestions) {
    restrictions += '\nNÃO faça perguntas ao cliente.';
  }
  
  if (forbidOptions) {
    restrictions += '\nNÃO ofereça opções ou múltipla escolha.';
  }

  if (forbidFinancial) {
    restrictions += `\n\n🔒 TRAVA FINANCEIRA ATIVA:
Você PODE responder perguntas INFORMATIVAS sobre finanças (prazos, como funciona, onde consultar saldo, políticas).
Você NÃO PODE executar ou prometer AÇÕES financeiras (saque, reembolso, estorno, devolução, cancelamento de cobrança, transferência de saldo).
Se o cliente solicitar uma AÇÃO financeira (ex: "quero sacar", "faz meu reembolso", "quero meu dinheiro de volta"), responda:
"Entendi sua solicitação. Vou te encaminhar para o setor responsável que poderá te ajudar com isso."
E retorne [[FLOW_EXIT:financeiro]] imediatamente.
Você PODE: coletar dados (email, CPF, ID do pedido), resumir o caso, e responder dúvidas informativas. NÃO PODE: instruir processos financeiros, prometer resolução ou executar ações.

⚠️ ANTI-ALUCINAÇÃO FINANCEIRA (REGRA ABSOLUTA):
Quando o assunto for financeiro, sua PRIMEIRA ação deve ser verificar se a base de conhecimento contém a informação EXATA solicitada.
NÃO cite valores monetários, prazos em dias, datas específicas ou percentuais sobre saques, reembolsos, estornos ou devoluções A MENOS que essa informação EXATA exista na base de conhecimento fornecida.
Se a KB não contiver a informação, responda: "Não tenho essa informação no momento. O setor financeiro poderá te orientar com detalhes."
NUNCA invente, deduza ou estime valores, prazos ou condições financeiras.

🔍 DESAMBIGUAÇÃO FINANCEIRA OBRIGATÓRIA:
Se o cliente mencionar termos como saque, saldo, reembolso, estorno ou devolução sem deixar claro se quer uma INFORMAÇÃO ou realizar uma AÇÃO, você DEVE perguntar de forma natural e empática:
"Posso te ajudar com informações sobre [tema] ou você gostaria de fazer uma solicitação?"
Nunca assuma a intenção do cliente — sempre pergunte quando houver ambiguidade.
Se o cliente confirmar que quer SOLICITAR ou REALIZAR uma ação financeira → responda com [[FLOW_EXIT:financeiro]]
Se for apenas uma dúvida informativa → responda normalmente usando a Base de Conhecimento.`;
  }

  const forbidCancellation = flowContext.forbidCancellation ?? false;
  if (forbidCancellation) {
    restrictions += `\n\n🚫 TRAVA CANCELAMENTO ATIVA:
Se o cliente solicitar CANCELAR claramente (ex: "quero cancelar meu plano"), responda:
"Entendi sua solicitação de cancelamento. Vou te encaminhar para o setor responsável."
E retorne [[FLOW_EXIT:cancelamento]] imediatamente.

🔍 DESAMBIGUAÇÃO CANCELAMENTO OBRIGATÓRIA:
Se o cliente mencionar termos como cancelar, cancelamento, desistir ou encerrar sem deixar claro se quer uma INFORMAÇÃO ou realizar uma AÇÃO, você DEVE perguntar:
"Você tem dúvidas sobre cancelamento ou deseja cancelar um produto/serviço?"
Nunca assuma a intenção do cliente — sempre pergunte quando houver ambiguidade.
Se o cliente confirmar que quer CANCELAR → responda com [[FLOW_EXIT:cancelamento]]
Se for apenas dúvida → responda normalmente usando a Base de Conhecimento.`;
  }

  const forbidCommercial = flowContext.forbidCommercial ?? false;
  if (forbidCommercial) {
    restrictions += `\n\n🛒 TRAVA COMERCIAL ATIVA:
Se o cliente solicitar COMPRAR claramente (ex: "quero comprar", "quanto custa"), responda:
"Ótimo interesse! Vou te conectar com nosso time comercial."
E retorne [[FLOW_EXIT:comercial]] imediatamente.

🔍 DESAMBIGUAÇÃO COMERCIAL OBRIGATÓRIA:
Se o cliente mencionar termos como plano, compra, preço ou assinatura sem deixar claro se quer uma INFORMAÇÃO ou realizar uma COMPRA, você DEVE perguntar:
"Você deseja comprar algum plano ou tem dúvidas sobre seu plano atual?"
Nunca assuma a intenção do cliente — sempre pergunte quando houver ambiguidade.
Se o cliente confirmar que quer COMPRAR → responda com [[FLOW_EXIT:comercial]]
Se for apenas dúvida → responda normalmente usando a Base de Conhecimento.`;
  }

  const forbidConsultant = flowContext.forbidConsultant ?? false;
  if (forbidConsultant) {
    restrictions += `\n\n💼 TRAVA CONSULTOR ATIVA:
Se o cliente solicitar FALAR COM CONSULTOR claramente (ex: "quero meu consultor", "falar com consultor"), responda:
"Certo! Vou te conectar com seu consultor."
E retorne [[FLOW_EXIT:consultor]] imediatamente.

🔍 DESAMBIGUAÇÃO CONSULTOR OBRIGATÓRIA:
Se o cliente mencionar termos como consultor, assessor, gestor ou estratégia sem deixar claro a intenção, você DEVE perguntar:
"Você deseja falar com um consultor para saber estratégias de vendas? Ou quer um atendimento normal pela equipe de suporte?"
Nunca assuma a intenção do cliente — sempre pergunte quando houver ambiguidade.
Se o cliente confirmar que quer FALAR COM CONSULTOR → responda com [[FLOW_EXIT:consultor]]
Se for apenas dúvida → responda normalmente usando a Base de Conhecimento.`;
  }
  
  restrictions += `
NÃO sugira transferência para humano.
NÃO invente informações.
NÃO use markdown: sem negrito (**), sem # títulos, sem listas com - ou *.
Use apenas texto simples, sem formatação.
Se não houver dados suficientes, responda exatamente:
"No momento não tenho essa informação."

📦 CONSULTA DE PEDIDOS (REGRA ABSOLUTA):
Para consultar pedidos, SEMPRE peça o NÚMERO DO PEDIDO ou CÓDIGO DE RASTREIO.
NUNCA peça email, CPF ou telefone para consultar pedidos.
Exemplo correto: "Por favor, me informe o número do pedido ou o código de rastreio."
Exemplo PROIBIDO: "Me informe seu email para eu consultar."

A resposta deve ser curta, clara e objetiva.

Contexto do Cliente:
Nome: ${contactName}
Status: ${contactStatus}${enrichment?.orgName ? `\nOrganização: ${enrichment.orgName}` : ''}${enrichment?.consultantName ? `\nConsultor: ${enrichment.consultantName}` : ''}${enrichment?.sellerName ? `\nVendedor: ${enrichment.sellerName}` : ''}${enrichment?.tags && enrichment.tags.length > 0 ? `\nTags: ${enrichment.tags.join(', ')}` : ''}`;

  // Persona contextual baseada em perfil do contato
  if (contactStatus === 'customer' || contactStatus === 'vip') {
    restrictions += '\nTom: cordial e proativo. Este é um cliente ativo — priorize resolução ágil.';
  } else if (contactStatus === 'lead') {
    restrictions += '\nTom: amigável e consultivo. Foque em entender a necessidade sem pressão.';
  }

  // Tom empático quando contexto financeiro
  if (forbidFinancial) {
    restrictions += '\nSe o cliente demonstrar preocupação financeira, responda com empatia e tranquilidade antes de qualquer informação.';
  }

  return restrictions;
}

    restrictions += '\nSe o cliente demonstrar preocupaÃ§Ã£o financeira, responda com empatia e tranquilidade antes de qualquer informaÃ§Ã£o.';
  }

  return restrictions;
}

// ðŸ†• FASE 1: FunÃ§Ã£o para validar se IA violou restriÃ§Ãµes de comportamento
function validateResponseRestrictions(
  response: string, 
  forbidQuestions: boolean, 
  forbidOptions: boolean,
  flowContext?: any // FIX LOOP: contexto para detectar no de triagem
): { valid: boolean; violation?: string } {
  // Verificar perguntas â€” sÃ³ bloqueia se uma FRASE termina com ?
  // Evita falso positivo com ? dentro de parÃªnteses ou observaÃ§Ãµes
  // FIX LOOP: No de triagem precisa fazer perguntas - nao bloquear
  const isTriageCtx = flowContext &&
    ((flowContext.objective || '').toLowerCase().includes('triag') ||
     (flowContext.contextPrompt || '').toLowerCase().includes('triag') ||
     (flowContext.objective || '').toLowerCase().includes('inten') ||
     (flowContext.contextPrompt || '').toLowerCase().includes('inten'));

  if (forbidQuestions && !isTriageCtx) {
    const hasRealQuestion = response
      .split(/(?<=[.!])\s+/)
      .some(sentence => sentence.trim().endsWith('?'));
    if (hasRealQuestion) {
      return { valid: false, violation: 'question_detected' };
    }
  }
  
  // Verificar opÃ§Ãµes (padrÃµes comuns de mÃºltipla escolha)
  if (forbidOptions) {
    const optionPatterns = [
      /1ï¸âƒ£|2ï¸âƒ£|3ï¸âƒ£|4ï¸âƒ£|5ï¸âƒ£/,
      /\*\*A\)\*\*|\*\*B\)\*\*|\*\*C\)\*\*/i,
      /opção.*[:\-]/i,
      /escolha.*opção/i,
      /selecione/i,
      /qual.*prefere/i,
    ];
    
    if (optionPatterns.some(p => p.test(response))) {
      return { valid: false, violation: 'options_detected' };
    }
  }
  
  return { valid: true };
}

// ðŸ†• ESCAPE PATTERNS: Detectar quando IA tenta sair do contrato (semÃ¢ntico, agrupado por intenÃ§Ã£o)
const ESCAPE_PATTERNS = [
  // Token explÃ­cito de saÃ­da (IA pediu exit limpo)
  /\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]/i,
  // Promessa de aÃ§Ã£o de transferÃªncia (vou/irei/posso + verbo)
  /(vou|irei|posso)\s+(te\s+)?(direcionar|redirecionar|transferir|encaminhar|conectar|passar)/i,
  // AÃ§Ã£o em andamento (estou/estarei + gerÃºndio)
  /(estou|estarei)\s+(te\s+)?(direcionando|redirecionando|transferindo|encaminhando|conectando)/i,
  // MenÃ§Ã£o a humano/atendente com contexto de espera
  /\b(aguarde|sÃ³ um instante).*(atendente|especialista|consultor)\b/i,
  // Chamar/acionar humano
  /\b(chamar|acionar).*(atendente|especialista|consultor)\b/i,
  // Menu de atendimento (caso especÃ­fico)
  /menu\s+de\s+atendimento/i,
  // OpÃ§Ãµes numeradas (2+ emojis para evitar falso positivo com emoji isolado)
  /[1-9]ï¸âƒ£.*[1-9]ï¸âƒ£/s,
  // Menus textuais
  /escolha uma das op[Ã§c][Ãµo]es/i,
  /selecione uma op[Ã§c][Ã£a]o/i,
  // Menus textuais com numeraÃ§Ã£o (1) ... 2) ...)
  /\b1[\)\.\-][\s\S]*?\b2[\)\.\-]/i,
];

interface AutopilotChatRequest {
  conversationId: string;
  customerMessage: string;
  maxHistory?: number;
  customer_context?: {
    name: string;
    email: string;
    isVerified: boolean;
  } | null;
  // ðŸ†• CONTRATO: Contexto do fluxo (obrigatÃ³rio quando chamado via flow)
  flow_context?: FlowContext;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Wrapper: garante charset=utf-8 em TODAS as responses JSON
  const rawHandler = async (): Promise<Response> => {
  try {
    // Handler de warmup rÃ¡pido (sem processamento de IA)
    const bodyText = await req.text();
    const parsedBody = bodyText ? JSON.parse(bodyText) : {};
    
    if (parsedBody.warmup) {
      console.log('[ai-autopilot-chat] ðŸ”¥ Warmup ping received');
      return new Response(
        JSON.stringify({ status: 'warm', timestamp: new Date().toISOString() }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let { conversationId, customerMessage, maxHistory = 10, customer_context, flow_context }: AutopilotChatRequest = parsedBody;

    // ðŸ”’ FIX 1: Hard validation â€” customerMessage obrigatÃ³rio (exceto warmup)
    if (!customerMessage || typeof customerMessage !== 'string' || customerMessage.trim() === '') {
      console.error('[ai-autopilot-chat] âŒ BAD_REQUEST: customerMessage ausente ou vazio');
      return new Response(JSON.stringify({ 
        error: 'BAD_REQUEST', 
        detail: 'customerMessage is required and must be a non-empty string' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ðŸ†• Carregar RAGConfig uma Ãºnica vez para todo o handler
    const ragConfig = await getRAGConfig(supabaseClient);
    console.log('[ai-autopilot-chat] ðŸ“Š RAGConfig carregado:', { model: ragConfig.model, strictMode: ragConfig.strictMode, blockFinancial: ragConfig.blockFinancial });

    // ValidaÃ§Ã£o defensiva
    if (!conversationId || conversationId === 'undefined') {
      console.error('[ai-autopilot-chat] âŒ conversationId invÃ¡lido:', conversationId);
      return new Response(JSON.stringify({ 
        error: 'conversationId Ã© obrigatÃ³rio' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('[ai-autopilot-chat] Request received:', { 
      conversationId, 
      messagePreview: customerMessage?.substring(0, 50),
      hasFlowContext: !!flow_context,
      flowId: flow_context?.flow_id
    });

    // 🔧 TOKEN OPT: ACK Filter — mensagens curtas de confirmação não precisam de LLM
    const ackPatterns = /^(ok|oks|okay|certo|entendi|entendido|certo!|ok!|tudo bem|tá bom|tá|ta|sim|não|nao|obrigad[ao]|vlw|valeu|blz|beleza|show|perfeito|ótimo|otimo|claro|pode ser|combinado|fechado|👍|✅|😊|🙏)[\s!.]*$/i;
    if (ackPatterns.test(customerMessage.trim()) && !flow_context) {
      console.log('[ai-autopilot-chat] 🔧 ACK_FILTER: Mensagem de confirmação curta, retornando sem LLM');
      return new Response(JSON.stringify({
        response: 'De nada! 😊 Posso ajudar com mais alguma coisa?',
        source: 'ack_filter',
        handoff: false
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ðŸš¨ FASE 3: Declarar variÃ¡veis fora do try para acesso no catch
    let conversation: any = null;
    let responseChannel = 'web_chat';
    let contact: any = null;
    let department: string | null = null;
    
    // ðŸ†• Chat Flow: variÃ¡veis para persona/KB especÃ­ficas do fluxo
    let flowPersonaId: string | null = flow_context?.personaId || null;
    let flowKbCategories: string[] | null = flow_context?.kbCategories || null;
    let flowContextPrompt: string | null = flow_context?.contextPrompt || null;
    let flowFallbackMessage: string | null = flow_context?.fallbackMessage || null;
    
    // ðŸ†• FASE 1: VariÃ¡veis de Controle de Comportamento Anti-AlucinaÃ§Ã£o
    const flowObjective: string | null = flow_context?.objective || null;
    const flowMaxSentences: number = flow_context?.maxSentences ?? 3;
    const flowForbidQuestions: boolean = flow_context?.forbidQuestions ?? true;
    const flowForbidOptions: boolean = flow_context?.forbidOptions ?? true;
    const flowForbidFinancial: boolean = flow_context?.forbidFinancial ?? false;
    const flowForbidCancellation: boolean = flow_context?.forbidCancellation ?? false;
    const flowForbidCommercialPrompt: boolean = flow_context?.forbidCommercial ?? false;
    const flowForbidConsultantPrompt: boolean = flow_context?.forbidConsultant ?? false;
    
    // ðŸ†• FASE 1: Flag para usar prompt restritivo
    const useRestrictedPrompt = !!(flow_context && (flowObjective || flowForbidQuestions || flowForbidOptions || flowForbidFinancial));
    
    if (useRestrictedPrompt) {
      console.log('[ai-autopilot-chat] ðŸŽ¯ FASE 1: Modo restritivo ATIVO:', {
        objective: flowObjective?.substring(0, 50),
        maxSentences: flowMaxSentences,
        forbidQuestions: flowForbidQuestions,
        forbidOptions: flowForbidOptions,
        forbidFinancial: flowForbidFinancial
      });
    }

    // ðŸ”’ TRAVA FINANCEIRA â€” InterceptaÃ§Ã£o na ENTRADA (antes de chamar LLM)
    // ðŸ†• SEPARAÃ‡ÃƒO: Apenas AÃ‡Ã•ES financeiras bloqueiam. Perguntas informativas passam para a LLM.
    // ðŸ†• CORREÃ‡ÃƒO: Termos de cancelamento REMOVIDOS â€” tratados separadamente abaixo
    const financialActionPattern = /quero\s*(sacar|retirar|meu\s*(reembolso|dinheiro|estorno|saldo))|fa(z|Ã§a)\s*(meu\s*)?(reembolso|estorno|saque|devolu[Ã§c][Ã£a]o)|(sacar|retirar|tirar)\s*(meu\s*)?(saldo|dinheiro|valor)|(solicitar|pedir|fazer|realizar|efetuar|estornar)\s*(saque|reembolso|estorno|devolu[Ã§c][Ã£a]o|pagamento)|(quero|preciso|necessito)\s*(meu\s+dinheiro|devolu[Ã§c][Ã£a]o|reembolso|estorno|ressarcimento)|transferir\s*(meu\s*)?saldo|devolver\s*(meu\s*)?dinheiro|cobran[Ã§c]a\s*indevida|contestar\s*(cobran[Ã§c]a|pagamento)|cad[Ãªe]\s*(meu\s*)?(dinheiro|saldo|reembolso)|n[Ã£a]o\s+recebi\s*(meu\s*)?(reembolso|estorno|saque|pagamento|dinheiro)|me\s+(devolvam|reembolsem|paguem)|preciso\s+do\s+meu\s+(saque|reembolso|saldo)|quero\s+receber\s*(meu\s*)?(pagamento|dinheiro|saldo)/i;
    const financialInfoPattern = /qual\s*(o\s*)?(prazo|tempo|data)|como\s*(funciona|fa[Ã§c]o|solicito|pe[Ã§c]o)|onde\s*(vejo|consulto|acompanho)|quando\s*(posso|vou|ser[Ã¡a])|pol[iÃ­]tica\s*de\s*(reembolso|devolu[Ã§c][Ã£a]o|estorno|saque|cancelamento)|regras?\s*(de|para|do)\s*(saque|reembolso|estorno|devolu[Ã§c][Ã£a]o)|d[Ãºu]vida\s+(sobre|com|de|do|da)\s+(saque|reembolso|estorno|devolu|financ|saldo|cobran)|saber\s+sobre|informar\s+sobre|informa[Ã§c][Ã£a]o\s+(sobre|de|do|da)|perguntar\s+sobre|entender\s+(como|sobre|o\s+que)|explicar?\s+(como|sobre|o\s+que)|gostaria\s+de\s+(saber|entender|me\s+informar)|o\s+que\s+[Ã©e]\s*(saque|reembolso|estorno|devolu[Ã§c][Ã£a]o)|confirma[Ã§c][Ã£a]o\s+de/i;
    // ðŸ†• Regex para termos financeiros AMBÃGUOS (palavra isolada, sem verbo de aÃ§Ã£o nem contexto informativo)
    const financialAmbiguousPattern = /\b(saque|sacar|saldo|reembolso|estorno|devolu[Ã§c][Ã£a]o|ressarcimento|cobran[Ã§c]a)\b/i;
    
    const isFinancialAction = financialActionPattern.test(customerMessage || '');
    const isFinancialInfo = financialInfoPattern.test(customerMessage || '');
    const isFinancialAmbiguous = !isFinancialAction && !isFinancialInfo && financialAmbiguousPattern.test(customerMessage || '');
    
    // Flag para injetar instruÃ§Ã£o de desambiguaÃ§Ã£o no prompt quando termo Ã© ambÃ­guo
    const ambiguousFinancialDetected = flowForbidFinancial && isFinancialAmbiguous;
    if (ambiguousFinancialDetected) {
      console.log('[ai-autopilot-chat] ðŸ” DESAMBIGUAÃ‡ÃƒO FINANCEIRA: Termo ambÃ­guo detectado, IA vai perguntar ao cliente:', customerMessage?.substring(0, 80));
    }

    // ðŸ†• TRAVA CANCELAMENTO â€” Separada do financeiro para roteamento independente
    const cancellationActionPattern = /cancelar\s*(minha\s*)?(assinatura|cobran[Ã§c]a|pagamento|plano|conta|servi[Ã§c]o)|quero\s+cancelar|desistir\s*(do|da|de)\s*(plano|assinatura|servi[Ã§c]o|conta)|n[Ã£a]o\s+quero\s+mais\s*(o\s*)?(plano|assinatura|servi[Ã§c]o)|encerrar\s*(minha\s*)?(conta|assinatura|plano)/i;
    const isCancellationAction = cancellationActionPattern.test(customerMessage || '');
    // ðŸ†• Regex para termos de cancelamento AMBÃGUOS (palavra isolada, sem verbo de aÃ§Ã£o nem contexto informativo)
    const cancellationAmbiguousPattern = /\b(cancelar|cancelamento|desistir|encerrar|rescindir|rescis[Ã£a]o)\b/i;
    const isCancellationAmbiguous = !isCancellationAction && !isFinancialInfo && cancellationAmbiguousPattern.test(customerMessage || '');
    
    // Flag para injetar instruÃ§Ã£o de desambiguaÃ§Ã£o de cancelamento no prompt quando termo Ã© ambÃ­guo
    const ambiguousCancellationDetected = flowForbidCancellation && isCancellationAmbiguous;
    if (ambiguousCancellationDetected) {
      console.log('[ai-autopilot-chat] ðŸ” DESAMBIGUAÃ‡ÃƒO CANCELAMENTO: Termo ambÃ­guo detectado, IA vai perguntar ao cliente:', customerMessage?.substring(0, 80));
    }
    
    // ðŸ›’ DESAMBIGUAÃ‡ÃƒO COMERCIAL â€” Detectar termos comerciais ambÃ­guos
    const commercialAmbiguousPattern = /\b(comprar|pre[Ã§c]o|or[Ã§c]amento|plano|assinatura|upgrade|downgrade|cat[aÃ¡]logo|proposta|demonstra[Ã§c][Ã£a]o)\b/i;
    const commercialActionPattern = /comprar|quero comprar|quanto custa|pre[Ã§c]o|proposta|or[Ã§c]amento|cat[aÃ¡]logo|assinar|plano|tabela de pre[Ã§c]o|conhecer.*produto|demonstra[Ã§c][aÃ£]o|demo|trial|teste gr[aÃ¡]tis|upgrade|downgrade|mudar.*plano/i;
    const isCommercialAction = commercialActionPattern.test(customerMessage || '');
    const isCommercialAmbiguous = !isCommercialAction && commercialAmbiguousPattern.test(customerMessage || '');
    const ambiguousCommercialDetected = flowForbidCommercialPrompt && isCommercialAmbiguous;
    if (ambiguousCommercialDetected) {
      console.log('[ai-autopilot-chat] ðŸ” DESAMBIGUAÃ‡ÃƒO COMERCIAL: Termo ambÃ­guo detectado, IA vai perguntar ao cliente:', customerMessage?.substring(0, 80));
    }

    // ðŸ’¼ DESAMBIGUAÃ‡ÃƒO CONSULTOR â€” Detectar termos de consultor ambÃ­guos
    const consultorAmbiguousPattern = /\b(consultor|assessor|meu\s+gerente|meu\s+consultor|falar\s+com\s+meu)\b/i;
    const consultorActionPattern = /falar\s+com\s*(meu\s*)?(consultor|assessor|gerente)|quero\s*(meu\s*)?(consultor|assessor)|chamar\s*(meu\s*)?(consultor|assessor)|transferir\s+para\s*(meu\s*)?(consultor|assessor)/i;
    const isConsultorAction = consultorActionPattern.test(customerMessage || '');
    const isConsultorAmbiguous = !isConsultorAction && consultorAmbiguousPattern.test(customerMessage || '');
    const ambiguousConsultorDetected = flowForbidConsultantPrompt && isConsultorAmbiguous;
    if (ambiguousConsultorDetected) {
      console.log('[ai-autopilot-chat] ðŸ” DESAMBIGUAÃ‡ÃƒO CONSULTOR: Termo ambÃ­guo detectado, IA vai perguntar ao cliente:', customerMessage?.substring(0, 80));
    }
    
    // SÃ³ bloquear AÃ‡Ã•ES financeiras. Info passa para LLM responder via KB. AmbÃ­guo â†’ IA pergunta.
    if (ragConfig.blockFinancial && flowForbidFinancial && customerMessage && customerMessage.trim().length > 0 && isFinancialAction && !isFinancialInfo) {
      console.warn('[ai-autopilot-chat] ðŸ”’ TRAVA FINANCEIRA (ENTRADA): IntenÃ§Ã£o financeira detectada, bloqueando IA:', customerMessage.substring(0, 80));
      
      const fixedMessage = 'Entendi sua solicitaÃ§Ã£o. Vou te encaminhar para o setor financeiro que poderÃ¡ te ajudar com isso.';
      
      const hasFlowContext = !!(flow_context);
      
      if (!hasFlowContext) {
        // Buscar departamento financeiro dinamicamente
        let financialDeptId: string | null = null;
        try {
          const { data: deptRow } = await supabaseClient
            .from('departments')
            .select('id')
            .ilike('name', '%financ%')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          financialDeptId = deptRow?.id || null;
        } catch (deptErr) {
          console.error('[ai-autopilot-chat] âš ï¸ Erro buscando departamento financeiro:', deptErr);
        }

        try {
          const convUpdate: any = { ai_mode: 'waiting_human', assigned_to: null };
          if (financialDeptId) convUpdate.department = financialDeptId;
          await supabaseClient
            .from('conversations')
            .update(convUpdate)
            .eq('id', conversationId);
          console.log('[ai-autopilot-chat] ðŸ”’ Conversa transferida para humano (trava financeira - entrada, sem fluxo), dept:', financialDeptId || 'genÃ©rico');
        } catch (transferErr) {
          console.error('[ai-autopilot-chat] Erro ao transferir (trava financeira - entrada):', transferErr);
        }
      } else {
        console.log('[ai-autopilot-chat] ðŸ”’ Flow context presente â€” delegando avanÃ§o ao process-chat-flow via forceFinancialExit');
      }

      try {
        await supabaseClient
          .from('ai_events')
          .insert({
            entity_type: 'conversation',
            entity_id: conversationId,
            event_type: 'ai_blocked_financial',
            model: 'ai-autopilot-chat',
            output_json: {
              phase: 'input_interception',
              pattern: 'financialIntentPattern',
              message_preview: customerMessage.substring(0, 200),
              forbid_financial: true,
              has_flow_context: hasFlowContext,
            },
            input_summary: customerMessage.substring(0, 200),
          });
      } catch (logErr) {
        console.error('[ai-autopilot-chat] âš ï¸ Failed to log financial block event:', logErr);
      }

      // CorreÃ§Ã£o 2: Quando fluxo ativo, NÃƒO enviar mensagem fixa â€” delegar 100% ao process-chat-flow
      if (hasFlowContext) {
        return new Response(JSON.stringify({
          ok: true,
          financialBlocked: true,
          exitKeywordDetected: true,
          hasFlowContext: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        financialBlocked: true,
        exitKeywordDetected: true,
        hasFlowContext: false,
        response: fixedMessage,
        message: fixedMessage,
        aiResponse: fixedMessage,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ðŸ†• TRAVA CANCELAMENTO â€” InterceptaÃ§Ã£o na ENTRADA (antes de chamar LLM)
    if (flowForbidCancellation && customerMessage && customerMessage.trim().length > 0 && isCancellationAction && !isFinancialInfo) {
      console.warn('[ai-autopilot-chat] ðŸš« TRAVA CANCELAMENTO (ENTRADA): IntenÃ§Ã£o de cancelamento detectada, bloqueando IA:', customerMessage.substring(0, 80));
      
      const cancelMsg = 'Entendi que vocÃª deseja cancelar. Vou te direcionar para o processo de cancelamento.';
      const hasFlowContext = !!(flow_context);

      try {
        await supabaseClient
          .from('ai_events')
          .insert({
            entity_type: 'conversation',
            entity_id: conversationId,
            event_type: 'ai_blocked_cancellation',
            model: 'ai-autopilot-chat',
            output_json: {
              phase: 'input_interception',
              pattern: 'cancellationActionPattern',
              message_preview: customerMessage.substring(0, 200),
              has_flow_context: hasFlowContext,
            },
            input_summary: customerMessage.substring(0, 200),
          });
      } catch (logErr) {
        console.error('[ai-autopilot-chat] âš ï¸ Failed to log cancellation block event:', logErr);
      }

      if (hasFlowContext) {
        return new Response(JSON.stringify({
          ok: true,
          cancellationBlocked: true,
          exitKeywordDetected: true,
          hasFlowContext: true,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        cancellationBlocked: true,
        exitKeywordDetected: true,
        hasFlowContext: false,
        response: cancelMsg,
        message: cancelMsg,
        aiResponse: cancelMsg,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ðŸ”’ TRAVA COMERCIAL â€” InterceptaÃ§Ã£o na ENTRADA (antes de chamar LLM)
    const flowForbidCommercial: boolean = flow_context?.forbidCommercial ?? false;
    const commercialIntentPattern = /comprar|quero comprar|quanto custa|pre[Ã§c]o|proposta|or[Ã§c]amento|cat[aÃ¡]logo|assinar|plano|tabela de pre[Ã§c]o|conhecer.*produto|demonstra[Ã§c][aÃ£]o|demo|trial|teste gr[aÃ¡]tis|upgrade|downgrade|mudar.*plano/i;
    
    if (flowForbidCommercial && customerMessage && customerMessage.trim().length > 0 && commercialIntentPattern.test(customerMessage)) {
      console.warn('[ai-autopilot-chat] ðŸ›’ TRAVA COMERCIAL (ENTRADA): IntenÃ§Ã£o comercial detectada, bloqueando IA:', customerMessage.substring(0, 80));
      
      const commercialMsg = 'Ã“timo! Vou te conectar com nosso time comercial para te ajudar com isso.';
      const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
      
      const hasFlowContext = !!(flow_context);
      
      if (!hasFlowContext) {
        try {
          await supabaseClient
            .from('conversations')
            .update({ ai_mode: 'waiting_human', assigned_to: null, department: DEPT_COMERCIAL_ID })
            .eq('id', conversationId);
          console.log('[ai-autopilot-chat] ðŸ›’ Conversa transferida para Comercial - Nacional (trava comercial, sem fluxo)');
        } catch (transferErr) {
          console.error('[ai-autopilot-chat] Erro ao transferir (trava comercial):', transferErr);
        }
      } else {
        console.log('[ai-autopilot-chat] ðŸ›’ Flow context presente â€” delegando avanÃ§o ao process-chat-flow via forceCommercialExit');
      }

      try {
        await supabaseClient
          .from('ai_events')
          .insert({
            entity_type: 'conversation',
            entity_id: conversationId,
            event_type: 'ai_blocked_commercial',
            model: 'ai-autopilot-chat',
            output_json: {
              phase: 'input_interception',
              pattern: 'commercialIntentPattern',
              message_preview: customerMessage.substring(0, 200),
              forbid_commercial: true,
              has_flow_context: hasFlowContext,
            },
            input_summary: customerMessage.substring(0, 200),
          });
      } catch (logErr) {
        console.error('[ai-autopilot-chat] âš ï¸ Failed to log commercial block event:', logErr);
      }

      return new Response(JSON.stringify({
        ok: true,
        commercialBlocked: true,
        exitKeywordDetected: true,
        hasFlowContext,
        response: commercialMsg,
        message: commercialMsg,
        aiResponse: commercialMsg,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ðŸš¨ FASE 3: Fallback Gracioso - Try-catch interno para capturar falhas da IA
    try {
      // 1. Buscar conversa e informaÃ§Ãµes do contato (ANTES do cache)
      const { data: conversationData, error: convError } = await supabaseClient
        .from('conversations')
        .select(`
          *,
          contacts!inner(
            id, first_name, last_name, email, phone, whatsapp_id, company, status, document, kiwify_validated, kiwify_validated_at, organization_id, consultant_id, assigned_to
          )
        `)
        .eq('id', conversationId)
        .single();

      if (convError || !conversationData) {
        console.error('[ai-autopilot-chat] Conversa nÃ£o encontrada:', convError);
        return new Response(JSON.stringify({ error: 'Conversa nÃ£o encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      conversation = conversationData;
      contact = conversation.contacts as any;
      department = conversation.department || null;

      // ðŸ†• ENRIQUECIMENTO DE CONTEXTO: Buscar organizaÃ§Ã£o, consultor, vendedor e tags do contato
      let contactOrgName: string | null = null;
      let contactConsultantName: string | null = null;
      let contactSellerName: string | null = null;
      let contactTagsList: string[] = [];

      try {
        const enrichPromises: PromiseLike<any>[] = [];

        // OrganizaÃ§Ã£o
        if (contact.organization_id) {
          enrichPromises.push(
            supabaseClient
              .from('organizations')
              .select('name')
              .eq('id', contact.organization_id)
              .maybeSingle()
              .then((r: any) => ({ type: 'org', data: r.data }))
          );
        }

        // Consultor
        if (contact.consultant_id) {
          enrichPromises.push(
            supabaseClient
              .from('profiles')
              .select('full_name')
              .eq('id', contact.consultant_id)
              .maybeSingle()
              .then((r: any) => ({ type: 'consultant', data: r.data }))
          );
        }

        // Vendedor (assigned_to)
        if (contact.assigned_to) {
          enrichPromises.push(
            supabaseClient
              .from('profiles')
              .select('full_name')
              .eq('id', contact.assigned_to)
              .maybeSingle()
              .then((r: any) => ({ type: 'seller', data: r.data }))
          );
        }

        // Tags do contato
        enrichPromises.push(
          supabaseClient
            .from('contact_tags')
            .select('tags:tag_id(name)')
            .eq('contact_id', contact.id)
            .then((r: any) => ({ type: 'tags', data: r.data }))
        );

        const enrichResults = await Promise.all(enrichPromises);

        for (const result of enrichResults) {
          if (result.type === 'org' && result.data?.name) contactOrgName = result.data.name;
          if (result.type === 'consultant' && result.data?.full_name) contactConsultantName = result.data.full_name;
          if (result.type === 'seller' && result.data?.full_name) contactSellerName = result.data.full_name;
          if (result.type === 'tags' && result.data) {
            contactTagsList = result.data.map((t: any) => t.tags?.name).filter(Boolean);
          }
        }

        console.log('[ai-autopilot-chat] ðŸ·ï¸ Contexto enriquecido:', {
          org: contactOrgName,
          consultant: contactConsultantName,
          seller: contactSellerName,
          tags: contactTagsList
        });
      } catch (enrichErr) {
        console.error('[ai-autopilot-chat] âš ï¸ Erro ao enriquecer contexto do contato:', enrichErr);
      }

      // ðŸ†• BUSINESS HOURS: Buscar info de horÃ¡rio comercial para contexto da IA
      let businessHoursInfo: BusinessHoursResult | null = null;
      try {
        businessHoursInfo = await getBusinessHoursInfo(supabaseClient);
        console.log('[ai-autopilot-chat] ðŸ• Business hours:', {
          within_hours: businessHoursInfo.within_hours,
          is_holiday: businessHoursInfo.is_holiday,
          next_open: businessHoursInfo.next_open_text,
          schedule: businessHoursInfo.schedule_summary,
        });
      } catch (bhErr) {
        console.error('[ai-autopilot-chat] âš ï¸ Erro ao buscar horÃ¡rio comercial:', bhErr);
      }

      // ðŸ›¡ï¸ VERIFICAÃ‡ÃƒO GLOBAL: Checar se a IA estÃ¡ habilitada globalmente
      const { data: globalConfig } = await supabaseClient
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_global_enabled')
        .single();
      
      const isAIGloballyEnabled = globalConfig?.value === 'true' || globalConfig?.value === true;
      
      // ðŸ†• MODO DE TESTE: Verificar se a conversa estÃ¡ em modo de teste individual
      // Se is_test_mode = true, ignora ai_global_enabled e processa normalmente
      const isTestMode = conversation.is_test_mode === true;
      
      if (isTestMode) {
        console.log('[ai-autopilot-chat] ðŸ§ª MODO TESTE ATIVO - Ignorando ai_global_enabled');
      }
      
      if (!isAIGloballyEnabled && !isTestMode) {
        console.log('[ai-autopilot-chat] ðŸš« IA DESLIGADA GLOBALMENTE (e nÃ£o Ã© test mode) - IGNORANDO');
        return new Response(
          JSON.stringify({ 
            skipped: true, 
            reason: 'AI globally disabled',
            ai_global_enabled: false,
            is_test_mode: false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ðŸ›¡ï¸ VERIFICAÃ‡ÃƒO DEFENSIVA: NÃ£o processar se nÃ£o estÃ¡ em autopilot
      if (conversation.ai_mode !== 'autopilot') {
        console.log('[ai-autopilot-chat] âš ï¸ Conversa nÃ£o estÃ¡ em autopilot. ai_mode:', conversation.ai_mode, '- IGNORANDO');
        return new Response(
          JSON.stringify({ 
            skipped: true, 
            reason: `Conversa em modo ${conversation.ai_mode}`,
            ai_mode: conversation.ai_mode
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ðŸ›¡ï¸ ANTI-RACE-CONDITION: Verificar se handoff foi executado recentemente
      // Isso previne que mÃºltiplas chamadas reprocessem a mesma conversa
      const handoffExecutedAt = conversation.handoff_executed_at;
      if (handoffExecutedAt) {
        const handoffAgeMs = Date.now() - new Date(handoffExecutedAt).getTime();
        const HANDOFF_PROTECTION_WINDOW_MS = 60000; // 60 segundos de proteÃ§Ã£o
        
        if (handoffAgeMs < HANDOFF_PROTECTION_WINDOW_MS) {
          console.log('[ai-autopilot-chat] â¸ï¸ Handoff recente detectado (' + Math.round(handoffAgeMs/1000) + 's atrÃ¡s) - IGNORANDO para prevenir race condition');
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

      // ============================================================
      // ðŸ” PRIORIDADE ABSOLUTA: ESTADO awaiting_otp
      // Se hÃ¡ OTP pendente, validar de forma determinÃ­stica (com/sem espaÃ§os)
      // e NUNCA fazer handoff por cÃ³digo incorreto.
      // 
      // ðŸ›¡ï¸ MELHORIA: Verificar CONTEXTO da conversa para evitar confusÃ£o
      // Se a IA pediu nÃºmero de pedido/rastreio, NÃƒO deve tratar como OTP
      // ============================================================
      {
        const conversationMetadata = conversation.customer_metadata || {};
        const otpDigitsOnly = (customerMessage || '').replace(/\D/g, '');
        const hasAwaitingOTP = conversationMetadata.awaiting_otp === true;
        const otpExpiresAt = conversationMetadata.otp_expires_at;
        const hasRecentOTPPending = otpExpiresAt && new Date(otpExpiresAt) > new Date();
        
        // ðŸ†• VERIFICAÃ‡ÃƒO DE CONTEXTO: Buscar Ãºltima mensagem da IA para entender o contexto
        let lastAIAskedForOTP = false;
        let lastAIAskedForOrder = false;
        
        try {
          const { data: recentAIMessages } = await supabaseClient
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conversationId)
            .eq('sender_type', 'user')
            .eq('is_ai_generated', true)
            .order('created_at', { ascending: false })
            .limit(3);
          
          if (recentAIMessages && recentAIMessages.length > 0) {
            const lastAIContent = (recentAIMessages[0]?.content || '').toLowerCase();
            const last3AIContent = recentAIMessages.map(m => (m.content || '').toLowerCase()).join(' ');
            
            // PadrÃµes que indicam que a IA pediu cÃ³digo OTP/verificaÃ§Ã£o
            const otpContextPatterns = [
              /c[Ã³o]digo.*verifica[Ã§c][Ã£a]o/i,
              /c[Ã³o]digo.*6.*d[Ã­i]gitos/i,
              /enviamos.*c[Ã³o]digo/i,
              /digite.*c[Ã³o]digo/i,
              /informe.*c[Ã³o]digo/i,
              /reenviar.*c[Ã³o]digo/i,
              /otp/i,
              /validar.*identidade/i,
              /confirmar.*identidade/i
            ];
            
            // PadrÃµes que indicam que a IA pediu nÃºmero de PEDIDO/RASTREIO
            const orderContextPatterns = [
              /n[Ãºu]mero.*pedido/i,
              /c[Ã³o]digo.*rastreio/i,
              /c[Ã³o]digo.*rastreamento/i,
              /informar.*pedido/i,
              /fornecer.*pedido/i,
              /qual.*pedido/i,
              /status.*pedido/i,
              /verificar.*status/i,
              /rastrear/i,
              /tracking/i
            ];
            
            lastAIAskedForOTP = otpContextPatterns.some(p => p.test(lastAIContent) || p.test(last3AIContent));
            lastAIAskedForOrder = orderContextPatterns.some(p => p.test(lastAIContent));
            
            console.log('[ai-autopilot-chat] ðŸ“‹ Contexto da conversa:', {
              lastAIMessage: lastAIContent.substring(0, 100),
              lastAIAskedForOTP,
              lastAIAskedForOrder,
              hasAwaitingOTP,
              hasRecentOTPPending
            });
          }
        } catch (contextErr) {
          console.error('[ai-autopilot-chat] Erro ao verificar contexto:', contextErr);
        }
        
        // ðŸ›¡ï¸ SÃ“ INTERCEPTAR COMO OTP SE:
        // 1. HÃ¡ estado awaiting_otp E
        // 2. A Ãºltima mensagem da IA NÃƒO foi pedindo nÃºmero de pedido/rastreio
        // 3. A Ãºltima mensagem da IA FOI sobre OTP/verificaÃ§Ã£o
        const shouldTreatAsOTP = (hasAwaitingOTP || hasRecentOTPPending) && 
                                  !!contact?.email && 
                                  !lastAIAskedForOrder &&
                                  (lastAIAskedForOTP || hasAwaitingOTP);
        
        console.log('[ai-autopilot-chat] ðŸ” DecisÃ£o OTP:', {
          shouldTreatAsOTP,
          otpDigitsLength: otpDigitsOnly.length,
          hasAwaitingOTP,
          lastAIAskedForOrder,
          lastAIAskedForOTP
        });

        if (shouldTreatAsOTP && otpDigitsOnly.length > 0 && otpDigitsOnly.length !== 0) {
          // SOMENTE processar como OTP se realmente Ã© contexto de OTP
          // E se o cliente mandou exatamente 6 dÃ­gitos
          const channelToUse = (conversation.channel as string) || responseChannel;

          // Formato invÃ¡lido (ex: 4 dÃ­gitos, 7 dÃ­gitos etc.) - mas SOMENTE se estamos em contexto OTP real
          if (otpDigitsOnly.length !== 6 && lastAIAskedForOTP && !lastAIAskedForOrder) {
            const otpFormatResponse = `**CÃ³digo invÃ¡lido**\n\nO cÃ³digo deve ter **6 dÃ­gitos**.\n\nPor favor, envie apenas os 6 nÃºmeros (pode ser com ou sem espaÃ§os).\n\nDigite **"reenviar"** se precisar de um novo cÃ³digo.`;

            const { data: savedMsg } = await supabaseClient
              .from('messages')
              .insert({
                conversation_id: conversationId,
                content: otpFormatResponse,
                sender_type: 'user',
                is_ai_generated: true,
                channel: channelToUse
              })
              .select()
              .single();

            if (channelToUse === 'whatsapp' && contact?.phone) {
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
                  otpFormatResponse,
                  conversationId,
                  contact.whatsapp_id
                );
              }
            }

            return new Response(JSON.stringify({
              response: otpFormatResponse,
              messageId: savedMsg?.id,
              otpValidated: false,
              debug: { reason: 'otp_invalid_format_priority', digits_length: otpDigitsOnly.length, bypassed_ai: true }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Formato ok (6 dÃ­gitos): validar SOMENTE se contexto Ã© realmente OTP
          // Se a IA pediu nÃºmero de pedido, NÃƒO validar como OTP - deixar fluir para busca de rastreio
          if (lastAIAskedForOrder && !lastAIAskedForOTP) {
            console.log('[ai-autopilot-chat] ðŸ”„ 6 dÃ­gitos recebidos, mas contexto Ã© PEDIDO - nÃ£o tratando como OTP');
            // NÃ£o fazer nada, deixar o fluxo continuar para buscar rastreio
          } else if (otpDigitsOnly.length === 6) {
            // Contexto Ã© realmente OTP E tem 6 dÃ­gitos - validar
            try {
              const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('verify-code', {
                body: { email: contact.email, code: otpDigitsOnly }
              });
              if (otpError) throw otpError;

              const errorMessage = otpData?.error || 'O cÃ³digo nÃ£o Ã© vÃ¡lido. Verifique e tente novamente.';
              const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

              const otpResponse = otpData?.success
                ? `**CÃ³digo validado com sucesso!**\n\nOlÃ¡ ${contactName}! Sua identidade foi confirmada.\n\nAgora posso te ajudar com questÃµes financeiras. Como posso te ajudar?`
                : `**CÃ³digo invÃ¡lido**\n\n${errorMessage}\n\nDigite **"reenviar"** se precisar de um novo cÃ³digo.`;

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
              }

              const { data: savedMsg } = await supabaseClient
                .from('messages')
                .insert({
                  conversation_id: conversationId,
                  content: otpResponse,
                  sender_type: 'user',
                  is_ai_generated: true,
                  channel: channelToUse
                })
                .select()
                .single();

              if (channelToUse === 'whatsapp' && contact?.phone) {
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
                    otpResponse,
                    conversationId,
                    contact.whatsapp_id
                  );
                }
              }

              return new Response(JSON.stringify({
                response: otpResponse,
                messageId: savedMsg?.id,
                otpValidated: otpData?.success || false,
                debug: { reason: 'otp_priority_validation_bypass', otp_success: otpData?.success, bypassed_ai: true }
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } catch (err) {
              console.error('[ai-autopilot-chat] âŒ Erro ao validar OTP (prioridade):', err);
              // Se falhar, segue o fluxo normal (mas nÃ£o Ã© esperado)
            }
          }
        }
      }

      // ============================================================
      // ðŸ”’ PRIORIDADE: ESTADO awaiting_close_confirmation
      // Se IA pediu confirmaÃ§Ã£o de encerramento, processar resposta
      // ============================================================
      {
        const closeMeta = conversation.customer_metadata || {};
        if (closeMeta.awaiting_close_confirmation === true) {
          const msgLower = (customerMessage || '').toLowerCase().trim();
          
          // PadrÃµes flexÃ­veis de SIM (keyword matching, nÃ£o exige match exato)
          const yesKeywords = /\b(sim|s|yes|pode|pode fechar|pode encerrar|encerra|encerrar|fechou|claro|com certeza|isso|tÃ¡ bom|ta bom|foi sim)\b/i;
          // PadrÃµes flexÃ­veis de NÃƒO
          const noKeywords = /\b(n[aÃ£]o|nao|n|nÃ£o|nope|ainda n[aÃ£]o|tenho sim|outra|mais uma|espera|perai|pera|n[aÃ£]o foi|problema|d[uÃº]vida|continua|preciso)\b/i;
          // PadrÃµes de ambiguidade (presenÃ§a anula confirmaÃ§Ã£o)
          const ambiguityKeywords = /\b(mas|porÃ©m|porem|entretanto|sÃ³ que|so que|menos|exceto)\b/i;
          
          const hasYes = yesKeywords.test(msgLower);
          const hasNo = noKeywords.test(msgLower);
          const hasAmbiguity = ambiguityKeywords.test(msgLower);
          const hasQuestion = msgLower.includes('?');
          
          console.log(`[ai-autopilot-chat] ðŸ” Close confirmation check: msg="${msgLower}" hasYes=${hasYes} hasNo=${hasNo} hasAmbiguity=${hasAmbiguity} hasQuestion=${hasQuestion}`);
          
          if (hasYes && !hasNo && !hasAmbiguity && !hasQuestion) {
            console.log('[ai-autopilot-chat] âœ… Cliente CONFIRMOU encerramento');
            
            // Checar governanÃ§a
            const { data: aiConfigs } = await supabaseClient
              .from('system_configurations')
              .select('key, value')
              .in('key', ['ai_global_enabled', 'ai_shadow_mode', 'conversation_tags_required']);
            
            const configMap = new Map((aiConfigs || []).map((c: any) => [c.key, c.value]));
            const killSwitch = configMap.get('ai_global_enabled') === 'false';
            const shadowMode = configMap.get('ai_shadow_mode') === 'true';
            const tagsRequired = configMap.get('conversation_tags_required') === 'true';
            
            // Limpar flag
            const cleanMeta = { ...closeMeta };
            delete cleanMeta.awaiting_close_confirmation;
            delete cleanMeta.close_reason;
            
            if (killSwitch) {
              await supabaseClient.from('conversations')
                .update({ ai_mode: 'waiting_human', customer_metadata: cleanMeta })
                .eq('id', conversationId);
              const killMsg = 'No momento, o encerramento automÃ¡tico estÃ¡ indisponÃ­vel. Um atendente humano vai finalizar seu atendimento. Aguarde um momento!';
              await supabaseClient.from('messages').insert({
                conversation_id: conversationId, content: killMsg,
                sender_type: 'user', is_ai_generated: true, is_bot_message: true
              });
              if (responseChannel === 'whatsapp' || responseChannel === 'whatsapp_meta') {
                await supabaseClient.functions.invoke('send-meta-whatsapp', {
                  body: { conversationId, message: killMsg }
                });
              }
              return new Response(JSON.stringify({ status: 'disabled', reason: 'kill_switch' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            if (shadowMode) {
              await supabaseClient.from('conversations')
                .update({ customer_metadata: cleanMeta })
                .eq('id', conversationId);
              const shadowMsg = 'Obrigado pelo contato! Se precisar de mais alguma coisa, estou por aqui. ðŸ˜Š';
              await supabaseClient.from('messages').insert({
                conversation_id: conversationId, content: shadowMsg,
                sender_type: 'user', is_ai_generated: true, is_bot_message: true
              });
              // Shadow mode: NÃƒO enviar via WhatsApp, apenas sugestÃ£o interna
              await supabaseClient.from('ai_suggestions').insert({
                conversation_id: conversationId,
                suggested_reply: '(SugestÃ£o) Conversa pode ser encerrada pelo agente - cliente confirmou encerramento.',
                suggestion_type: 'close_suggestion',
                confidence_score: 0.95
              });
              return new Response(JSON.stringify({ status: 'suggested_only', reason: 'shadow_mode' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            
            // Checar tags obrigatÃ³rias
            if (tagsRequired) {
              const { data: convTags } = await supabaseClient
                .from('conversation_tags')
                .select('tag_id')
                .eq('conversation_id', conversationId);
              
              if (!convTags || convTags.length === 0) {
                await supabaseClient.from('conversations')
                  .update({ ai_mode: 'waiting_human', customer_metadata: cleanMeta })
                  .eq('id', conversationId);
                const tagMsg = 'Obrigado pelo contato! Um atendente vai finalizar seu atendimento em instantes. ðŸ˜Š';
                await supabaseClient.from('messages').insert({
                  conversation_id: conversationId, content: tagMsg,
                  sender_type: 'user', is_ai_generated: true, is_bot_message: true
                });
                if (responseChannel === 'whatsapp' || responseChannel === 'whatsapp_meta') {
                  await supabaseClient.functions.invoke('send-meta-whatsapp', {
                    body: { conversationId, message: tagMsg }
                  });
                }
                await supabaseClient.from('interactions').insert({
                  customer_id: contact.id, type: 'internal_note',
                  content: '**Encerramento pendente**: Cliente confirmou encerramento mas tags obrigatÃ³rias estÃ£o ausentes. Adicione tags e feche manualmente.',
                  channel: responseChannel,
                  metadata: { source: 'ai_close_blocked_tags' }
                });
                return new Response(JSON.stringify({ status: 'blocked', reason: 'missing_tags' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
            }
            
            // TUDO OK â†’ Chamar close-conversation
            const closeMsg = 'Foi um prazer ajudar! Seu atendimento serÃ¡ encerrado agora. AtÃ© a prÃ³xima! ðŸ˜Š';
            await supabaseClient.from('messages').insert({
              conversation_id: conversationId, content: closeMsg,
              sender_type: 'user', is_ai_generated: true, is_bot_message: true
            });
            if (responseChannel === 'whatsapp' || responseChannel === 'whatsapp_meta') {
              await supabaseClient.functions.invoke('send-meta-whatsapp', {
                body: { conversationId, message: closeMsg }
              });
            }
            
            // Invocar close-conversation (reuso total de CSAT, mÃ©tricas, timeline)
            const { data: closeResult, error: closeError } = await supabaseClient.functions.invoke('close-conversation', {
              body: {
                conversationId,
                userId: conversation.assigned_to || 'ai-autopilot',
                sendCsat: true
              }
            });
            
            if (closeError) {
              console.error('[ai-autopilot-chat] âŒ Erro ao encerrar conversa:', closeError);
            } else {
              console.log('[ai-autopilot-chat] âœ… Conversa encerrada com sucesso via close-conversation');
            }
            
            await supabaseClient.from('conversations')
              .update({ customer_metadata: {
                ...cleanMeta,
                ai_can_classify_ticket: true,
                ai_last_closed_at: new Date().toISOString(),
                ai_last_closed_by: 'autopilot'
              } })
              .eq('id', conversationId);
            
            return new Response(JSON.stringify({ status: 'applied', action: 'conversation_closed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            
          } else if (hasNo && !hasYes) {
            console.log('[ai-autopilot-chat] âŒ Cliente NÃƒO quer encerrar');
            const cleanMeta = { ...closeMeta };
            delete cleanMeta.awaiting_close_confirmation;
            delete cleanMeta.close_reason;
            await supabaseClient.from('conversations')
              .update({ customer_metadata: cleanMeta })
              .eq('id', conversationId);
            // NÃ£o retorna - cai no fluxo normal para IA continuar atendimento
          } else {
            // AmbÃ­guo - repetir pergunta
            const ambiguousMsg = 'SÃ³ confirmando: posso encerrar seu atendimento? Responda **sim** ou **nÃ£o**.';
            await supabaseClient.from('messages').insert({
              conversation_id: conversationId, content: ambiguousMsg,
              sender_type: 'user', is_ai_generated: true, is_bot_message: true
            });
            if (responseChannel === 'whatsapp' || responseChannel === 'whatsapp_meta') {
              await supabaseClient.functions.invoke('send-meta-whatsapp', {
                body: { conversationId, message: ambiguousMsg }
              });
            }
            return new Response(JSON.stringify({ status: 'awaiting_confirmation' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      }

      // ============================================================
      // ðŸ†• PRIORIDADE ABSOLUTA: ESTADO awaiting_email_for_handoff
      // Se estÃ¡ aguardando email, processar ANTES de qualquer outro fluxo
      // ============================================================
      const customerMetadata = conversation.customer_metadata || {};
      const isAwaitingEmailForHandoff = customerMetadata.awaiting_email_for_handoff === true;
      const handoffBlockedAt = customerMetadata.handoff_blocked_at ? new Date(customerMetadata.handoff_blocked_at).getTime() : 0;
      
      if (isAwaitingEmailForHandoff) {
        console.log('[ai-autopilot-chat] ðŸ“§ ESTADO: awaiting_email_for_handoff ATIVO - processando email prioritariamente');
        
        // Tentar extrair email com extrator tolerante
        const emailExtraction = extractEmailTolerant(customerMessage);
        
        console.log('[ai-autopilot-chat] ðŸ“§ Resultado da extraÃ§Ã£o tolerante:', {
          found: emailExtraction.found,
          email: emailExtraction.email,
          source: emailExtraction.source,
          debug: emailExtraction.debugInfo
        });
        
        if (!emailExtraction.found) {
          // âŒ Email NÃƒO encontrado - verificar anti-spam (nÃ£o repetir mensagem muito rÃ¡pido)
          const timeSinceHandoffBlocked = Date.now() - handoffBlockedAt;
          const ANTI_SPAM_WINDOW_MS = 30000; // 30 segundos
          
          if (timeSinceHandoffBlocked < ANTI_SPAM_WINDOW_MS) {
            console.log('[ai-autopilot-chat] ðŸ›¡ï¸ Anti-spam: mensagem de email enviada hÃ¡', Math.round(timeSinceHandoffBlocked/1000), 's - nÃ£o repetindo');
            
            // Enviar mensagem mais curta de correÃ§Ã£o de formato
            const formatHintMessage = 'ðŸ“§ Por favor, envie seu email em uma Ãºnica linha (sem espaÃ§os ou quebras). Exemplo: seuemail@dominio.com';
            
            await supabaseClient.from('messages').insert({
              conversation_id: conversationId,
              content: formatHintMessage,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            });
            
            // Enviar via WhatsApp se necessÃ¡rio
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
                  formatHintMessage,
                  conversationId,
                  contact.whatsapp_id
                );
              }
            }
            
            return new Response(JSON.stringify({
              status: 'awaiting_email',
              message: formatHintMessage,
              reason: 'Email nÃ£o detectado na mensagem - pedindo formato correto',
              anti_spam_active: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Fora da janela anti-spam, mas ainda sem email vÃ¡lido
          console.log('[ai-autopilot-chat] âŒ Email nÃ£o encontrado e fora da janela anti-spam');
          
          const askEmailAgainMessage = 'ðŸ“§ NÃ£o consegui identificar seu email. Por favor, envie apenas o email em uma linha (ex: seunome@email.com)';
          
          // Atualizar timestamp para anti-spam
          await supabaseClient.from('conversations')
            .update({
              customer_metadata: {
                ...customerMetadata,
                handoff_blocked_at: new Date().toISOString()
              }
            })
            .eq('id', conversationId);
          
          await supabaseClient.from('messages').insert({
            conversation_id: conversationId,
            content: askEmailAgainMessage,
            sender_type: 'user',
            is_ai_generated: true,
            channel: responseChannel
          });
          
          // Enviar via WhatsApp se necessÃ¡rio
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
                askEmailAgainMessage,
                conversationId,
                contact.whatsapp_id
              );
            }
          }
          
          return new Response(JSON.stringify({
            status: 'awaiting_email',
            message: askEmailAgainMessage,
            reason: 'Email nÃ£o detectado - solicitando novamente'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // âœ… Email ENCONTRADO! Processar verificaÃ§Ã£o
        const detectedEmail = emailExtraction.email!;
        console.log('[ai-autopilot-chat] âœ… EMAIL DETECTADO:', detectedEmail, '(via', emailExtraction.source, ')');
        
        // Chamar verify-customer-email para verificar se Ã© cliente existente
        try {
          const { data: verifyResult, error: verifyError } = await supabaseClient.functions.invoke(
            'verify-customer-email',
            { body: { email: detectedEmail, contact_id: contact.id } }
          );
          
          console.log('[ai-autopilot-chat] ðŸ“§ Resultado verify-customer-email:', {
            error: verifyError,
            found: verifyResult?.found,
            customer: verifyResult?.customer?.email
          });
          
          // Limpar estado awaiting_email_for_handoff SEMPRE (evita loop)
          const updatedMetadata = { ...customerMetadata };
          delete updatedMetadata.awaiting_email_for_handoff;
          delete updatedMetadata.handoff_blocked_at;
          delete updatedMetadata.handoff_blocked_reason;
          
          // Atualizar contato com email
          await supabaseClient.from('contacts')
            .update({ email: detectedEmail })
            .eq('id', contact.id);
          
          console.log('[ai-autopilot-chat] âœ… Email salvo no contato e metadata limpo');
          
          const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
          const DEPT_SUPORTE_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
          
          if (!verifyError && verifyResult?.found) {
            // CLIENTE EXISTENTE - Ir para Suporte
            console.log('[ai-autopilot-chat] âœ… Cliente ENCONTRADO no banco - direcionando para Suporte');
            
            // ðŸ†• CORREÃ‡ÃƒO: Verificar se o email pertence a OUTRO contato existente
            const existingCustomerId = verifyResult.customer?.id;
            const existingCustomerEmail = verifyResult.customer?.email;
            const isExistingCustomerDifferent = existingCustomerId && existingCustomerId !== contact.id;
            
            console.log('[ai-autopilot-chat] ðŸ” VerificaÃ§Ã£o de rebind:', {
              currentContactId: contact.id,
              existingCustomerId,
              existingCustomerEmail,
              isExistingCustomerDifferent
            });
            
            // ðŸ†• RECUPERAR CONTEXTO ORIGINAL (se existir)
            const originalIntent = customerMetadata.original_intent;
            const originalIntentCategory = customerMetadata.original_intent_category;
            
            console.log('[ai-autopilot-chat] ðŸ“‹ Contexto original recuperado:', {
              hasOriginalIntent: !!originalIntent,
              originalIntentCategory,
              intentPreview: originalIntent?.substring(0, 50)
            });
            
            // Limpar contexto original do metadata apÃ³s usar
            delete updatedMetadata.original_intent;
            delete updatedMetadata.original_intent_category;
            delete updatedMetadata.original_intent_timestamp;
            
            if (isExistingCustomerDifferent) {
              // ðŸ†• Email pertence a OUTRO contato existente (customer)
              // Revincula a conversa ao contato correto
              console.log('[ai-autopilot-chat] ðŸ”„ Revinculando conversa ao cliente existente:', existingCustomerId);
              
              await supabaseClient.from('conversations')
                .update({
                  contact_id: existingCustomerId,
                  customer_metadata: updatedMetadata,
                  department: DEPT_SUPORTE_ID
                })
                .eq('id', conversationId);
              
              // Atualizar o contato local para usar o cliente correto
              contact = { ...contact, id: existingCustomerId, email: existingCustomerEmail, status: 'customer' };
              
            } else {
              // Email nÃ£o existe OU pertence ao mesmo contato - atualizar status
              await supabaseClient.from('conversations')
                .update({
                  customer_metadata: updatedMetadata,
                  department: DEPT_SUPORTE_ID
                })
                .eq('id', conversationId);
              
              await supabaseClient.from('contacts')
                .update({ status: 'customer', email: detectedEmail })
                .eq('id', contact.id);
            }
            
            const customerName = verifyResult.customer?.name?.split(' ')[0] || contact.first_name || '';
            
            // ðŸ†• MENSAGEM COM CONTEXTO PRESERVADO
            let successMessage: string;
            
            if (originalIntent && originalIntentCategory) {
              // TEM CONTEXTO: Mensagem que retoma o assunto original
              const intentLabel = getIntentCategoryLabel(originalIntentCategory);
              successMessage = `Ã“timo, ${customerName}! âœ…\n\nIdentifiquei vocÃª em nosso sistema. VocÃª mencionou sobre **${intentLabel}** - vou te ajudar com isso agora!\n\n_Processando sua solicitaÃ§Ã£o..._`;
              
              console.log('[ai-autopilot-chat] ðŸŽ¯ Preservando contexto:', intentLabel);
            } else {
              // SEM CONTEXTO: Mensagem genÃ©rica (comportamento antigo)
              successMessage = `Ã“timo, ${customerName}! âœ…\n\nIdentifiquei vocÃª em nosso sistema. Como posso ajudar hoje?`;
            }
            
            await supabaseClient.from('messages').insert({
              conversation_id: conversationId,
              content: successMessage,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            });
            
            // Enviar via WhatsApp se necessÃ¡rio
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
                  successMessage,
                  conversationId,
                  contact.whatsapp_id
                );
              }
            }
            
            // ðŸ”§ CORREÃ‡ÃƒO: SEMPRE chamar route-conversation para clientes verificados
            // Isso distribui a conversa para agentes de suporte disponÃ­veis
            console.log('[ai-autopilot-chat] ðŸ”„ Chamando route-conversation para cliente verificado...');
            try {
              const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
                body: { 
                  conversationId,
                  department_id: DEPT_SUPORTE_ID
                }
              });
              
              if (routeError) {
                console.error('[ai-autopilot-chat] âŒ Erro ao rotear cliente verificado:', routeError);
              } else {
                console.log('[ai-autopilot-chat] âœ… Cliente verificado roteado para Suporte:', routeResult);
              }
            } catch (routeErr) {
              console.error('[ai-autopilot-chat] âŒ ExceÃ§Ã£o ao rotear cliente verificado:', routeErr);
            }
            
            // ðŸ†• SE TEM CONTEXTO ORIGINAL: NÃ£o retornar, deixar IA processar a intenÃ§Ã£o original
            if (originalIntent && originalIntentCategory) {
              console.log('[ai-autopilot-chat] ðŸ”„ Contexto preservado - deixando IA processar intenÃ§Ã£o original');
              
              // Atualizar objeto local para refletir email
              contact.email = detectedEmail;
              contact.status = 'customer';
              
              // NÃƒO RETORNAR - Deixar fluxo continuar para IA processar
              // A mensagem de confirmaÃ§Ã£o jÃ¡ foi enviada, agora a IA vai responder sobre o assunto original
            } else {
              // SEM CONTEXTO: Retornar com indicaÃ§Ã£o que estÃ¡ tudo ok
              // A conversa jÃ¡ foi roteada, cliente jÃ¡ recebeu confirmaÃ§Ã£o
              return new Response(JSON.stringify({
                status: 'email_verified_customer',
                message: successMessage,
                email: detectedEmail,
                department: 'suporte',
                routed: true,
                extraction_source: emailExtraction.source
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
          } else {
            // LEAD NOVO - Encaminhar para Comercial com handoff
            console.log('[ai-autopilot-chat] ðŸ†• Email NÃƒO encontrado no banco - Lead novo, encaminhando para Comercial');
            
            const handoffTimestamp = new Date().toISOString();
            
            // Atualizar conversa: limpar metadata + mover para Comercial + waiting_human
            await supabaseClient.from('conversations')
              .update({
                customer_metadata: updatedMetadata,
                department: DEPT_COMERCIAL_ID,
                ai_mode: 'waiting_human',
                handoff_executed_at: handoffTimestamp,
                needs_human_review: true
              })
              .eq('id', conversationId);
            
            // Rotear para agente comercial
            await supabaseClient.functions.invoke('route-conversation', {
              body: { conversationId, department_id: DEPT_COMERCIAL_ID }
            });
            
            const leadHandoffMessage = `Obrigado! ðŸ“\n\nRegistramos seu contato (${detectedEmail}). Um de nossos consultores vai entrar em contato em breve para te ajudar.\n\nAguarde um momento, por favor.`;
            
            await supabaseClient.from('messages').insert({
              conversation_id: conversationId,
              content: leadHandoffMessage,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            });
            
            // Enviar via WhatsApp se necessÃ¡rio
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
                  leadHandoffMessage,
                  conversationId,
                  contact.whatsapp_id
                );
              }
            }
            
            // Registrar nota interna
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'internal_note',
              content: `ðŸ“§ **Lead Identificado via Email**\n\n**Email:** ${detectedEmail}\n**ExtraÃ§Ã£o:** ${emailExtraction.source}\n**AÃ§Ã£o:** Encaminhado para Comercial`,
              channel: responseChannel
            });
            
            return new Response(JSON.stringify({
              status: 'email_verified_lead',
              message: leadHandoffMessage,
              email: detectedEmail,
              department: 'comercial',
              handoff: true,
              extraction_source: emailExtraction.source
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
        } catch (verifyErr) {
          console.error('[ai-autopilot-chat] âŒ Erro ao verificar email:', verifyErr);
          
          // Em caso de erro, limpar estado e continuar processamento normal
          const updatedMetadata = { ...customerMetadata };
          delete updatedMetadata.awaiting_email_for_handoff;
          
          await supabaseClient.from('conversations')
            .update({ customer_metadata: updatedMetadata })
            .eq('id', conversationId);
          
          // Salvar email mesmo com erro na verificaÃ§Ã£o
          await supabaseClient.from('contacts')
            .update({ email: detectedEmail })
            .eq('id', contact.id);
          
          // Atualizar objeto local
          contact.email = detectedEmail;
          
          console.log('[ai-autopilot-chat] âš ï¸ Erro na verificaÃ§Ã£o mas email salvo - continuando fluxo normal');
          // NÃƒO retornar, deixar continuar para processamento normal
        }
      }
      // ============================================================
      // FIM DO PROCESSAMENTO PRIORITÃRIO DE EMAIL
      // ============================================================

      // FASE 4: Buscar canal da ÃšLTIMA mensagem do cliente (nÃ£o da conversa)
      const { data: lastCustomerMessage } = await supabaseClient
        .from('messages')
        .select('channel')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      responseChannel = lastCustomerMessage?.channel || 'web_chat';
    
      console.log(`[ai-autopilot-chat] Canal da Ãºltima mensagem: ${responseChannel}, Departamento: ${department}`);

    // ðŸ†• TRIAGEM SILENCIOSA UNIFICADA â€” Sempre validar pela base Kiwify
    // SÃ³ pula se jÃ¡ estÃ¡ validado (kiwify_validated = true)
    if (!contact.kiwify_validated) {
      console.log('[ai-autopilot-chat] ðŸ” Triagem silenciosa: validando phone+email+CPF contra base Kiwify...');
      
      try {
        const validationPromises: PromiseLike<any>[] = [];

        // 1) Telefone â€” inline query (sem invoke entre edge functions)
        if (contact.phone || contact.whatsapp_id) {
          const phoneVal = contact.phone || contact.whatsapp_id || '';
          const digitsVal = phoneVal.replace(/\D/g, '');
          let normVal = '';
          if (digitsVal.startsWith('55') && digitsVal.length >= 12 && digitsVal.length <= 13) normVal = digitsVal;
          else if (digitsVal.length >= 10 && digitsVal.length <= 11) normVal = '55' + digitsVal;

          if (normVal.length >= 9) {
            const last9Val = normVal.slice(-9);
            validationPromises.push(
              supabaseClient
                .from('kiwify_events')
                .select('id, payload, customer_email, created_at')
                .in('event_type', ['paid', 'order_approved', 'subscription_renewed'])
                .filter('payload->Customer->>mobile', 'ilike', `%${last9Val}`)
                .order('created_at', { ascending: false })
                .limit(10)
                .then(({ data: matches, error: matchErr }) => {
                  if (matchErr || !matches || matches.length === 0) {
                    return { source: 'phone', data: { found: false } };
                  }
                  const customer = matches[0].payload?.Customer || {};
                  const products = [...new Set(matches.map(e => e.payload?.Product?.product_name || 'Produto'))];
                  
                  // Atualizar contato inline
                  const updatePayload: Record<string, unknown> = {
                    status: 'customer', source: 'kiwify_validated',
                    kiwify_validated: true, kiwify_validated_at: new Date().toISOString(),
                  };
                  if (customer.email) updatePayload.email = customer.email;
                  supabaseClient.from('contacts').update(updatePayload).eq('id', contact.id).then(() => {
                    supabaseClient.from('interactions').insert({
                      customer_id: contact.id, type: 'internal_note',
                      content: `âœ… Cliente identificado via autopilot inline Kiwify. Produtos: ${products.join(', ')}`,
                      channel: 'system',
                    });
                  });

                  return {
                    source: 'phone',
                    data: {
                      found: true,
                      customer: {
                        name: customer.full_name || customer.first_name || 'Cliente',
                        email: customer.email || matches[0].customer_email || '',
                        products,
                      }
                    }
                  };
                })
            );
          }
        }

        // 2) Email
        if (contact.email && contact.email.trim() !== '') {
          validationPromises.push(
            supabaseClient.functions.invoke('verify-customer-email', {
              body: { email: contact.email, contact_id: contact.id }
            }).then(r => ({ source: 'email', ...r }))
          );
        }

        // 3) CPF/Documento
        if (contact.document) {
          validationPromises.push(
            supabaseClient.functions.invoke('validate-by-cpf', {
              body: { cpf: contact.document, contact_id: contact.id }
            }).then(r => ({ source: 'cpf', ...r }))
          );
        }

        if (validationPromises.length > 0) {
          const results = await Promise.allSettled(validationPromises);
          
          // Verificar se qualquer um encontrou
          let foundCustomer = false;
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value?.data?.found) {
              const src = result.value.source || 'unknown';
              const customerData = result.value.data.customer;
              console.log(`[ai-autopilot-chat] âœ… Cliente identificado via ${src}!`, {
                name: customerData?.name,
                email: customerData?.email
              });

              // Atualizar contato local silenciosamente
              contact.status = 'customer';
              contact.kiwify_validated = true;
              if (customerData?.email && (!contact.email || contact.email.trim() === '')) {
                contact.email = customerData.email;
              }
              foundCustomer = true;
              break; // Um match Ã© suficiente
            }
          }

          if (!foundCustomer) {
            console.log('[ai-autopilot-chat] â„¹ï¸ Nenhuma compra Kiwify encontrada (phone/email/CPF)');
          }
        } else {
          console.log('[ai-autopilot-chat] â„¹ï¸ Contato sem phone/email/CPF para triagem');
        }
      } catch (kiwifyErr) {
        console.warn('[ai-autopilot-chat] âš ï¸ Erro na triagem silenciosa (nÃ£o crÃ­tico):', kiwifyErr);
      }
    } else {
      console.log('[ai-autopilot-chat] âœ… Contato jÃ¡ validado (kiwify_validated=true), pulando triagem');
    }

    // ðŸ†• BUSCAR PRODUTOS KIWIFY DO CONTATO (para injetar no contexto da IA)
    let customerProducts: string[] = [];
    try {
      const phoneForProducts = contact.phone || contact.whatsapp_id || '';
      const digitsForProducts = phoneForProducts.replace(/\D/g, '');
      let last9ForProducts = '';
      if (digitsForProducts.length >= 9) {
        last9ForProducts = digitsForProducts.slice(-9);
      }

      // Buscar por telefone OU email
      const productQueries: PromiseLike<any>[] = [];

      if (last9ForProducts) {
        productQueries.push(
          supabaseClient
            .from('kiwify_events')
            .select('payload')
            .in('event_type', ['paid', 'order_approved', 'subscription_renewed'])
            .filter('payload->Customer->>mobile', 'ilike', `%${last9ForProducts}`)
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }) => data || [])
        );
      }

      if (contact.email && contact.email.trim() !== '') {
        productQueries.push(
          supabaseClient
            .from('kiwify_events')
            .select('payload')
            .in('event_type', ['paid', 'order_approved', 'subscription_renewed'])
            .eq('customer_email', contact.email.toLowerCase().trim())
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }) => data || [])
        );
      }

      if (productQueries.length > 0) {
        const productResults = await Promise.all(productQueries);
        const allEvents = productResults.flat();
        const productNames = new Set<string>();
        for (const evt of allEvents) {
          const name = evt.payload?.Product?.product_name || evt.payload?.Subscription?.plan?.name;
          if (name) productNames.add(name);
        }
        customerProducts = [...productNames];
        if (customerProducts.length > 0) {
          console.log(`[ai-autopilot-chat] ðŸ“¦ Produtos do contato: ${customerProducts.join(', ')}`);
        }
      }
    } catch (prodErr) {
      console.warn('[ai-autopilot-chat] âš ï¸ Erro ao buscar produtos Kiwify (nÃ£o crÃ­tico):', prodErr);
    }

    // FASE 1: Verificar se deve pular cache para experiÃªncia personalizada
    const contactHasEmailForCache = contact.email && contact.email.trim() !== '';
    const isFinancialForCache = FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
    const isFirstContactGreeting = /^(oi|olÃ¡|ola|bom dia|boa tarde|boa noite|ei|eae|e aÃ­|hey|hi|hello)[\s!.,?]*$/i.test(customerMessage.trim());

    const shouldSkipCacheForPersonalization = 
      (contactHasEmailForCache && isFirstContactGreeting) || // Cliente conhecido + saudaÃ§Ã£o
      isFinancialForCache || // Contexto financeiro (precisa OTP)
      (!contactHasEmailForCache && responseChannel === 'whatsapp'); // Lead novo WhatsApp

    // Gerar hash da pergunta (usado tanto para busca quanto para salvar cache depois)
    const questionHash = await generateQuestionHash(customerMessage);

    if (shouldSkipCacheForPersonalization) {
      console.log('[ai-autopilot-chat] âš¡ SKIP CACHE para experiÃªncia personalizada');
    } else {
      // FASE 2: Verificar cache antes de processar (zero latÃªncia para perguntas repetidas)
      const { data: cachedResponse } = await supabaseClient
        .from('ai_response_cache')
        .select('answer, context_ids, created_at')
        .eq('question_hash', questionHash)
        .gte('created_at', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()) // âœ… FASE 3: TTL reduzido para 1h
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedResponse) {
        console.log('âœ… [CACHE HIT] Resposta instantÃ¢nea recuperada do cache');
        
        // ðŸ†• FASE 1: Verificar se resposta cacheada Ã© fallback e executar handoff real
        const isCachedFallback = FALLBACK_PHRASES.some(phrase => 
          cachedResponse.answer.toLowerCase().includes(phrase)
        );
        
        if (isCachedFallback) {
          console.log('ðŸš¨ [CACHE] Resposta cacheada Ã© FALLBACK - IGNORANDO cache e gerando nova resposta');
          
          // ðŸ›¡ï¸ ANTI-RACE-CONDITION: Marcar handoff com timestamp
          const handoffTimestamp = new Date().toISOString();
          
          // 1. Mudar modo para waiting_human (NÃƒO copilot!) e marcar timestamp
          await supabaseClient
            .from('conversations')
            .update({ 
              ai_mode: 'waiting_human', // ðŸ†• waiting_human para ficar na fila
              handoff_executed_at: handoffTimestamp, // ðŸ†• Anti-race-condition flag
              needs_human_review: true
            })
            .eq('id', conversationId);
          
          console.log('[CACHE] âœ… Handoff executado com timestamp:', handoffTimestamp);
          
          // 2. Rotear para agente humano
          await supabaseClient.functions.invoke('route-conversation', {
            body: { conversationId }
          });
          
          // 3. Criar ticket se for financeiro (com verificaÃ§Ã£o de INTENÃ‡ÃƒO, nÃ£o keyword solta)
          const isInformational = INFORMATIONAL_PATTERNS.some(p => p.test(customerMessage));
          const isFinancial = !isInformational && FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
          
          let ticketProtocol = '';
          if (isFinancial) {
            // ðŸ”’ ANTI-DUPLICAÃ‡ÃƒO: Verificar se conversa jÃ¡ tem ticket vinculado
            if (conversation.related_ticket_id) {
              console.log('[CACHE] âš ï¸ Conversa jÃ¡ possui ticket vinculado - pulando criaÃ§Ã£o:', conversation.related_ticket_id);
              ticketProtocol = conversation.related_ticket_id.slice(0, 8).toUpperCase();
            } else {
              // Criar ticket apenas se nÃ£o houver
              const { data: ticket } = await supabaseClient
                .from('tickets')
              .insert({
                  customer_id: contact.id,
                  subject: `SolicitaÃ§Ã£o Financeira - ${customerMessage.substring(0, 50)}`,
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
                console.log('ðŸŽ« [CACHE] Ticket financeiro criado:', ticket.id);
                
                // Vincular Ã  conversa
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
            content: `Handoff automÃ¡tico (cache poisoning detectado): "${customerMessage}"`,
            channel: responseChannel
          });
          
          // 5. Invalidar esse cache
          await supabaseClient
            .from('ai_response_cache')
            .delete()
            .eq('question_hash', questionHash);
          
          console.log('âœ… [CACHE] Handoff executado, cache invalidado');
          
          // ðŸ†• 6. RETORNAR RESPOSTA IMEDIATA DE HANDOFF (nÃ£o usar cache ruim!)
          const handoffMessage = isFinancial && ticketProtocol
            ? `Entendi sua solicitaÃ§Ã£o financeira. Estou transferindo vocÃª para um especialista humano que vai te ajudar com isso.\n\nProtocolo criado: #${ticketProtocol}`
            : `Entendi sua dÃºvida. Estou transferindo vocÃª para um especialista humano que poderÃ¡ te ajudar melhor.`;
          
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
          
          // ðŸ†• RETORNAR AQUI - NÃ£o deixar o cÃ³digo continuar para retornar cache ruim
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
        
        // âŒ REMOVIDO: NÃ£o inserir mensagem do cliente aqui - jÃ¡ foi inserida por useSendMessageOffline/handle-whatsapp-event/inbound-email

        // Salvar resposta da IA (do cache)
        const { data: aiMessageData } = await supabaseClient
          .from("messages")
          .insert({
            conversation_id: conversationId,
            content: cachedResponse.answer,
            sender_type: "user",
            is_ai_generated: true,
            attachment_url: JSON.stringify(cachedResponse.context_ids || []),
            channel: responseChannel, // âœ… FASE 4: Adicionar canal
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
            console.log('[ai-autopilot-chat] ðŸ“¤ Enviando resposta cached via WhatsApp');

            const sendResult = await sendWhatsAppMessage(
              supabaseClient,
              whatsappResult,
              contact.phone,
              cachedResponse.answer,
              conversationId,
              contact.whatsapp_id,
              false, // useQueue
              null // Cache response - persona not loaded yet
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

    console.log('âš ï¸ [CACHE MISS] Processando nova resposta...');
    
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
    // FASE 5: VERIFICAÃ‡ÃƒO DE DUPLICATA - ANTES do processamento da IA
    // ============================================================
    console.log('[ai-autopilot-chat] ðŸ” Verificando duplicatas...');
    
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('content, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'user')
      .eq('is_ai_generated', true)
      .gte('created_at', new Date(Date.now() - 10000).toISOString()) // Ãšltimos 10 segundos
      .order('created_at', { ascending: false })
      .limit(3);

    const isDuplicate = recentMessages?.some(msg => 
      msg.content.length > 50 && // SÃ³ verificar mensagens longas (evitar falsos positivos com "ok", "sim")
      (Date.now() - new Date(msg.created_at).getTime()) < 5000 // Menos de 5 segundos
    );

    if (isDuplicate) {
      console.warn('[ai-autopilot-chat] âš ï¸ Mensagem duplicada detectada - ignorando processamento');
      return new Response(JSON.stringify({ 
        status: 'duplicate',
        message: 'Mensagem duplicada ignorada'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ============================================================
    // ðŸ†• PRIORIDADE 1: CHAT FLOW - Verificar ANTES da triagem
    // ============================================================
    let flowProcessedEarly = false;
    // Só resetar variáveis de flow se NÃO veio flow_context explícito (widget/portal)
    // Preserva valores definidos na extração inicial (linhas ~1506-1509)
    if (!flow_context) {
      flowPersonaId = null;
      flowKbCategories = null;
      flowContextPrompt = null;
      flowFallbackMessage = null;
    }
    
    // GUARD: Se flow_context foi fornecido explicitamente (ex: widget do portal),
    // NAO chamar process-chat-flow - usar o contexto direto do request
    if (flow_context) {
      console.log('[ai-autopilot-chat] flow_context fornecido no body - PULANDO process-chat-flow (widget/portal mode)');
    }
    
    if (!flow_context) try {
      console.log('[ai-autopilot-chat] ðŸ”„ [PRIORIDADE] Verificando Chat Flow ANTES da triagem...');
      
      const { data: flowResult, error: flowError } = await supabaseClient.functions.invoke(
        'process-chat-flow',
        // âœ… FIX 4: process-chat-flow espera 'customerMessage', nÃ£o 'userMessage'
        { body: { conversationId, customerMessage: customerMessage } }
      );
      
      if (!flowError && flowResult) {
        console.log('[ai-autopilot-chat] ðŸ“‹ Resultado do Chat Flow (early check):', {
          useAI: flowResult.useAI,
          hasResponse: !!flowResult.response,
          flowStarted: flowResult.flowStarted,
          transfer: flowResult.transfer
        });
        
        // Se o fluxo retornou uma resposta determinÃ­stica (nÃ£o precisa de IA)
        if (flowResult.useAI === false && flowResult.response) {
          console.log('[ai-autopilot-chat] âœ… Chat Flow MATCH - Ignorando triagem!');
          flowProcessedEarly = true;
          
          // ðŸ†• TRANSFER NODE: Se Ã© uma transferÃªncia, executar handoff real
          if (flowResult.transfer === true && flowResult.departmentId) {
            console.log('[ai-autopilot-chat] ðŸ”€ TRANSFER NODE - Executando handoff real para departamento:', flowResult.departmentId);
            
            const handoffTimestamp = new Date().toISOString();

            // ðŸ†• Buscar consultant_id do contato para atribuiÃ§Ã£o direta
            const { data: contactConsultantData } = await supabaseClient
              .from('contacts')
              .select('consultant_id')
              .eq('id', contact?.id)
              .maybeSingle();

            let consultantId = contactConsultantData?.consultant_id || null;

            // ðŸ†• Se nÃ£o tem consultor pelo contato, buscar pelo email coletado no fluxo
            if (!consultantId) {
              let emailToSearch: string | null = null;

              // 1. Tentar do collectedData do fluxo
              const collectedEmail = flowResult.collectedData?.email;
              if (collectedEmail && typeof collectedEmail === 'string') {
                emailToSearch = collectedEmail.toLowerCase().trim();
                console.log('[ai-autopilot-chat] ðŸ“§ Email encontrado no collectedData:', emailToSearch);
              }

              // 2. Fallback: buscar email nas mensagens recentes
              if (!emailToSearch) {
                const { data: recentMsgs } = await supabaseClient
                  .from('messages')
                  .select('content')
                  .eq('conversation_id', conversationId)
                  .eq('sender_type', 'contact')
                  .order('created_at', { ascending: false })
                  .limit(10);

                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                for (const msg of recentMsgs || []) {
                  const match = msg.content?.match(emailRegex);
                  if (match) {
                    emailToSearch = match[0].toLowerCase();
                    console.log('[ai-autopilot-chat] ðŸ“§ Email encontrado nas mensagens:', emailToSearch);
                    break;
                  }
                }
              }

              // 3. Buscar contato com esse email que tenha consultor
              if (emailToSearch) {
                const { data: emailContact } = await supabaseClient
                  .from('contacts')
                  .select('consultant_id')
                  .ilike('email', emailToSearch)
                  .not('consultant_id', 'is', null)
                  .maybeSingle();

                if (emailContact?.consultant_id) {
                  consultantId = emailContact.consultant_id;
                  console.log('[ai-autopilot-chat] ðŸ‘¤ Consultor encontrado pelo email:', emailToSearch, 'â†’', consultantId);
                }
              }
            }

            const transferUpdate: Record<string, unknown> = {
              ai_mode: 'waiting_human',
              handoff_executed_at: handoffTimestamp,
              needs_human_review: true,
              department: flowResult.departmentId,
            };

            if (consultantId) {
              transferUpdate.assigned_to = consultantId;
              transferUpdate.ai_mode = 'copilot';
              console.log('[ai-autopilot-chat] ðŸ‘¤ Atribuindo ao consultor:', consultantId);
            }
            
            const { error: handoffUpdateError } = await supabaseClient
              .from('conversations')
              .update(transferUpdate)
              .eq('id', conversationId);
            
            if (handoffUpdateError) {
              console.error('[ai-autopilot-chat] âŒ Erro ao marcar handoff:', handoffUpdateError);
            } else {
              console.log('[ai-autopilot-chat] âœ… Conversa marcada com department:', flowResult.departmentId,
                'ai_mode:', consultantId ? 'copilot' : 'waiting_human',
                'assigned_to:', consultantId || 'pool');
            }
            
            // Chamar route-conversation SOMENTE se NÃƒO atribuiu ao consultor
            if (!consultantId) {
              try {
                const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
                  body: { 
                    conversationId,
                    targetDepartmentId: flowResult.departmentId
                  }
                });
                
                if (routeError) {
                  console.error('[ai-autopilot-chat] âŒ Erro ao rotear conversa:', routeError);
                } else {
                  console.log('[ai-autopilot-chat] âœ… Conversa roteada com sucesso:', routeResult);
                }
              } catch (routeErr) {
                console.error('[ai-autopilot-chat] âŒ ExceÃ§Ã£o ao chamar route-conversation:', routeErr);
              }
            } else {
              console.log('[ai-autopilot-chat] â­ï¸ Pulando route-conversation - consultor jÃ¡ atribuÃ­do diretamente');
            }
          }
          
          // ðŸ†• Formatar mensagem com opÃ§Ãµes de mÃºltipla escolha (se houver)
          const formattedFlowResponse = flowResult.response + formatOptionsAsText(flowResult.options);
          
          console.log('[ai-autopilot-chat] ðŸ“‹ Flow response formatted:', {
            hasOptions: !!flowResult.options?.length,
            optionsCount: flowResult.options?.length || 0,
            responsePreview: formattedFlowResponse.substring(0, 100)
          });
          
          // Salvar resposta do fluxo
          const { data: flowMsgData } = await supabaseClient
            .from("messages")
            .insert({
              conversation_id: conversationId,
              content: formattedFlowResponse,
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
                formattedFlowResponse,
                conversationId,
                contact.whatsapp_id
              );
            }
          }
          
          // Retornar resposta do fluxo - BYPASS TOTAL DA TRIAGEM
          return new Response(
            JSON.stringify({
              response: formattedFlowResponse,
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
        
        // Se o fluxo precisa de IA, popular variÃ¡veis para uso posterior
        if (flowResult.useAI === true) {
          flowPersonaId = flowResult.personaId || null;
          flowKbCategories = flowResult.kbCategories || null;
          flowContextPrompt = flowResult.contextPrompt || null;
          flowFallbackMessage = flowResult.fallbackMessage || null;
          
          // ðŸ†• MASTER FLOW: Log especÃ­fico quando vem do Master Flow
          const source = flowResult.masterFlowId ? 'Master Flow' : 'Chat Flow';
          console.log(`[ai-autopilot-chat] ðŸŽ¯ ${source} definiu configuraÃ§Ãµes para IA:`, {
            source,
            masterFlowId: flowResult.masterFlowId || null,
            masterFlowName: flowResult.masterFlowName || null,
            personaId: flowPersonaId,
            kbCategories: flowKbCategories,
            hasContextPrompt: !!flowContextPrompt
          });
        }
      }
    } catch (flowError) {
      console.error('[ai-autopilot-chat] âš ï¸ Erro ao processar Chat Flow (early check):', flowError);
    }
    
    // ============================================================
    // ðŸŽ¯ TRIAGEM VIA MASTER FLOW: LÃ³gica legada REMOVIDA
    // A triagem agora Ã© feita 100% pelo Master Flow visual
    // que foi processado anteriormente via process-chat-flow
    // ============================================================
    console.log('[ai-autopilot-chat] âœ… Triagem legada desativada - Master Flow Ã© a Ãºnica fonte de triagem');
    
    // ============================================================
    // ðŸ” DETECÃ‡ÃƒO AUTOMÃTICA DE EMAIL NA MENSAGEM
    // Se cliente SEM email envia uma mensagem contendo email vÃ¡lido,
    // processamos automaticamente como identificaÃ§Ã£o
    // ============================================================
    let emailWasVerifiedInThisRequest = false; // ðŸ†• Flag para evitar re-invoke do fluxo apÃ³s validaÃ§Ã£o de email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailInMessage = customerMessage.match(emailRegex)?.[0];
    
    if (emailInMessage && !contact.email) {
      console.log('[ai-autopilot-chat] ðŸ“§ EMAIL DETECTADO NA MENSAGEM (Lead sem email):', emailInMessage);
      
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
          console.log('[ai-autopilot-chat] âœ… Email processado automaticamente:', {
            email: emailInMessage,
            result: verifyResult.found ? 'found_in_db' : 'new_lead',
            otp_sent: verifyResult.otp_sent || false
          });
          
          // Montar resposta baseada no resultado
          const maskedEmailResponse = maskEmail(emailInMessage);
          let autoResponse = '';
          let skipEarlyReturn = false;
          
          if (verifyResult.found) {
            // ðŸŽ¯ TRIAGEM: Email encontrado = Cliente identificado (SEM OTP)
            console.log('[ai-autopilot-chat] ðŸŽ¯ TRIAGEM: Email encontrado');
            
            // ðŸ†• Recuperar original_intent do metadata (salvo quando IA pediu email)
            const custMeta = (conversation.customer_metadata || {}) as Record<string, any>;
            const originalIntent = custMeta.original_intent || null;
            const originalIntentCategory = custMeta.original_intent_category || null;
            // skipEarlyReturn jÃ¡ declarado no escopo externo
            
            console.log('[ai-autopilot-chat] ðŸ” Original intent recovery:', {
              originalIntent: originalIntent ? originalIntent.substring(0, 60) : null,
              originalIntentCategory,
              hasOriginalIntent: !!originalIntent
            });
            
            // ðŸ†• CORREÃ‡ÃƒO: Verificar se o email pertence a OUTRO contato existente
            const existingCustomerId = verifyResult.customer?.id;
            const existingCustomerEmail = verifyResult.customer?.email;
            const isExistingCustomerDifferent = existingCustomerId && existingCustomerId !== contact.id;
            
            console.log('[ai-autopilot-chat] ðŸ” VerificaÃ§Ã£o de contato:', {
              currentContactId: contact.id,
              existingCustomerId,
              existingCustomerEmail,
              isExistingCustomerDifferent
            });
            
            // Buscar template de confirmaÃ§Ã£o com menu
            let foundMessage = await getMessageTemplate(
              supabaseClient,
              'confirmacao_email_encontrado',
              { contact_name: contact.first_name || verifyResult.customer?.name || 'cliente' }
            );
            
            if (!foundMessage) {
              foundMessage = `Encontrei seu cadastro, ${contact.first_name || verifyResult.customer?.name || 'cliente'}! ðŸŽ‰\n\nAgora me diz: precisa de ajuda com:\n**1** - Pedidos\n**2** - Sistema`;
            }
            
            if (isExistingCustomerDifferent) {
              // ðŸ†• Email pertence a OUTRO contato existente (customer)
              // Revincula a conversa ao contato correto
              console.log('[ai-autopilot-chat] ðŸ”„ Revinculando conversa ao cliente existente:', existingCustomerId);
              
              const updatedMeta: Record<string, any> = {
                ...(conversation.customer_metadata || {}),
                email_verified_at: new Date().toISOString(),
                original_contact_id: contact.id, // Guardar referÃªncia do lead original
                rebind_reason: 'email_matched_existing_customer'
              };
              
              // ðŸ†• Limpar original_intent apÃ³s recuperaÃ§Ã£o
              if (originalIntent) {
                delete updatedMeta.original_intent;
                delete updatedMeta.original_intent_category;
                delete updatedMeta.original_intent_timestamp;
              }
              
              await supabaseClient.from('conversations')
                .update({
                  contact_id: existingCustomerId,
                  customer_metadata: updatedMeta
                })
                .eq('id', conversationId);
              
              // Atualizar o contato local para usar o cliente correto
              contact = { ...contact, id: existingCustomerId, email: existingCustomerEmail, status: 'customer' };
              
            } else {
              // Email nÃ£o existe OU pertence ao mesmo contato - atualizar status
              await supabaseClient.from('contacts')
                .update({ 
                  email: emailInMessage.toLowerCase().trim(),
                  status: 'customer'
                })
                .eq('id', contact.id);
              
              const updatedMeta: Record<string, any> = {
                ...(conversation.customer_metadata || {}),
                email_verified_at: new Date().toISOString()
              };
              
              // ðŸ†• Limpar original_intent apÃ³s recuperaÃ§Ã£o
              if (originalIntent) {
                delete updatedMeta.original_intent;
                delete updatedMeta.original_intent_category;
                delete updatedMeta.original_intent_timestamp;
              }
              
              // Email verificado - continuar processamento normal (Master Flow assume)
              await supabaseClient.from('conversations')
                .update({
                  customer_metadata: updatedMeta
                })
                .eq('id', conversationId);
            }
            
            // ðŸ†• CONSULTANT REDIRECT: Se cliente tem consultor, redirecionar direto
            const consultantId = verifyResult.customer?.consultant_id;
            
            if (consultantId && !flow_context) {
              console.log('[ai-autopilot-chat] ðŸŽ¯ CONSULTANT REDIRECT: Cliente tem consultor, redirecionando direto:', consultantId);
              
              // Atribuir conversa ao consultor em modo copilot
              await supabaseClient.from('conversations')
                .update({
                  assigned_to: consultantId,
                  ai_mode: 'copilot',
                  customer_metadata: {
                    ...(conversation.customer_metadata || {}),
                    email_verified_at: new Date().toISOString(),
                    consultant_redirect: true,
                    consultant_redirect_at: new Date().toISOString()
                  }
                })
                .eq('id', conversationId);
              
              // Persistir consultant_id no contato do lead (se diferente)
              await supabaseClient.from('contacts')
                .update({ consultant_id: consultantId })
                .eq('id', contact.id)
                .is('consultant_id', null);
              
              // Chamar route-conversation para enfileirar distribuiÃ§Ã£o
              await supabaseClient.functions.invoke('route-conversation', {
                body: { conversationId, assigned_to: consultantId }
              });
              
              // Registrar nota de auditoria
              await supabaseClient.from('interactions').insert({
                customer_id: contact.id,
                type: 'internal_note',
                content: `ðŸŽ¯ **Redirecionamento AutomÃ¡tico para Consultor**\n\nEmail verificado: ${maskedEmailResponse}\nCliente encontrado com consultor designado.\nConversa atribuÃ­da ao consultor (copilot).`,
                channel: responseChannel
              });
              
              // Mensagem personalizada (sem menu)
              autoResponse = `Encontrei seu cadastro, ${contact.first_name || verifyResult.customer?.name || 'cliente'}! ðŸŽ‰\n\nVou te conectar com seu consultor. Aguarde um momento! ðŸ¤`;
            } else if (originalIntent) {
              // ðŸ†• FIX: Tem original_intent â†’ NÃƒO enviar menu, deixar IA processar a pergunta original
              console.log('[ai-autopilot-chat] ðŸŽ¯ ORIGINAL INTENT RECOVERY: Recuperando contexto original em vez de menu genÃ©rico');
              
              const customerName = contact.first_name || verifyResult.customer?.name || 'cliente';
              autoResponse = `Encontrei seu cadastro, ${customerName}! âœ…\n\nVoltando Ã  sua dÃºvida...`;
              
              // ðŸ†• Substituir a mensagem do cliente pelo intent original para que a IA processe
              // Isso faz o fluxo continuar apÃ³s o early return com o contexto correto
              skipEarlyReturn = true;
              customerMessage = originalIntent;
              
              console.log('[ai-autopilot-chat] ðŸ”„ Mensagem substituÃ­da pelo original_intent:', originalIntent.substring(0, 80));
            } else if (consultantId && flow_context) {
              // flow_context ativo: IA continua ajudando, nÃ£o redireciona
              console.log('[ai-autopilot-chat] â„¹ï¸ Consultor encontrado mas flow_context ativo - IA continua ajudando');
              
              // Salvar consultant_id no contato para uso futuro (pÃ³s-fluxo)
              await supabaseClient.from('contacts')
                .update({ consultant_id: consultantId })
                .eq('id', contact.id)
                .is('consultant_id', null);
              
              autoResponse = `Encontrei seu cadastro! âœ… Continuando seu atendimento...`;
              skipEarlyReturn = true; // Deixar IA continuar com flow_context
            } else if (!consultantId && flow_context) {
              // flow_context ativo sem consultor: confirmar email e deixar IA continuar
              console.log('[ai-autopilot-chat] âœ… Email verificado com flow_context ativo - IA continua sem menu');
              autoResponse = `Encontrei seu cadastro! âœ… Continuando seu atendimento...`;
              skipEarlyReturn = true; // Deixar IA continuar com flow_context
            } else {
              // ðŸ†• FIX: Sempre continuar com contexto da conversa, nunca enviar menu genÃ©rico
              // A IA tem acesso ao histÃ³rico completo e pode responder sobre o assunto que o cliente jÃ¡ mencionou
              console.log('[ai-autopilot-chat] ðŸŽ¯ Email verificado - continuando com contexto da conversa (sem menu genÃ©rico)');
              const customerName = contact.first_name || verifyResult.customer?.name || 'cliente';
              autoResponse = `Encontrei seu cadastro, ${customerName}! âœ…\n\nVoltando Ã  sua dÃºvida...`;
              skipEarlyReturn = true;
            }
          } else if (!verifyResult.found) {
            // ðŸŽ¯ TRIAGEM: Email nÃ£o encontrado = Lead â†’ Rotear para Comercial
            console.log('[ai-autopilot-chat] ðŸŽ¯ TRIAGEM: Email nÃ£o encontrado - roteando para Comercial');
            
            const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
            
            // Buscar template de lead direcionado
            let leadMessage = await getMessageTemplate(supabaseClient, 'lead_direcionado_comercial', {});
            if (!leadMessage) {
              leadMessage = 'Obrigado! Como vocÃª ainda nÃ£o Ã© nosso cliente, vou te direcionar para nosso time Comercial que poderÃ¡ te ajudar. ðŸ¤\n\nAguarde um momento que logo um de nossos consultores irÃ¡ te atender!';
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
              content: `ðŸŽ¯ **Lead Novo - Roteado para Comercial**\n\nEmail informado: ${maskedEmailResponse}\nMotivo: Email nÃ£o encontrado na base de clientes`,
              channel: responseChannel
            });
            
            autoResponse = leadMessage;
          } else {
            // Fallback: email processado mas sem aÃ§Ã£o clara
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
          
          // Enviar via WhatsApp se necessÃ¡rio (Meta ou Evolution)
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
          
          // ðŸ†• Se skipEarlyReturn = true, NÃƒO retornar early â†’ deixar IA processar o original_intent
          if (skipEarlyReturn) {
            emailWasVerifiedInThisRequest = true; // ðŸ†• Marcar que email foi verificado nesta request
            console.log('[ai-autopilot-chat] ðŸ”„ skipEarlyReturn=true - IA vai processar a mensagem original apÃ³s confirmaÃ§Ã£o de email');
            // autoResponse jÃ¡ foi enviada via WhatsApp acima como confirmaÃ§Ã£o
            // customerMessage foi substituÃ­do pelo original_intent
            // O fluxo continua normalmente para a IA processar
          } else {
            // RETURN EARLY - Email processado, nÃ£o chamar IA
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
        }
      } catch (error) {
        console.error('[ai-autopilot-chat] âŒ Erro ao processar email detectado:', error);
        // Se falhar, continua para IA tentar lidar
      }
    }
    
    console.log(`[ai-autopilot-chat] Processando mensagem para conversa ${conversationId}...`);

    // ============================================================
    // ðŸ†• Chat Flow jÃ¡ foi verificado ANTES da triagem (linhas ~1203)
    // As variÃ¡veis flowPersonaId, flowKbCategories, etc. jÃ¡ estÃ£o populadas
    // ============================================================

    // 2. Buscar persona baseado em routing rules (canal + departamento)
    // ðŸ†• OU usar persona especÃ­fica do Chat Flow (se flowPersonaId estiver definido)
    let persona: any = null;
    
    if (flowPersonaId) {
      // ðŸ†• Chat Flow: Buscar persona especÃ­fica definida no nÃ³ ai_response
      console.log('[ai-autopilot-chat] ðŸŽ¯ Usando persona do Chat Flow:', flowPersonaId);
      
      const { data: flowPersona, error: personaError } = await supabaseClient
        .from('ai_personas')
        .select('id, name, role, system_prompt, temperature, max_tokens, knowledge_base_paths, is_active, use_priority_instructions, data_access')
        .eq('id', flowPersonaId)
        .eq('is_active', true)
        .single();
      
      if (!personaError && flowPersona) {
        persona = flowPersona;
        console.log(`[ai-autopilot-chat] âœ… Persona do fluxo carregada: ${persona.name}`);
      } else {
        console.warn('[ai-autopilot-chat] âš ï¸ Persona do fluxo nÃ£o encontrada, usando routing rules');
      }
    }
    
    // Fallback 1: Usar PERSONA GLOBAL se nÃ£o tem persona do fluxo
    if (!persona) {
      console.log('[ai-autopilot-chat] ðŸ” Buscando Persona Global...');
      
      const { data: globalPersonaConfig } = await supabaseClient
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_default_persona_id')
        .maybeSingle();
      
      if (globalPersonaConfig?.value) {
        const { data: globalPersona, error: globalPersonaError } = await supabaseClient
          .from('ai_personas')
          .select('id, name, role, system_prompt, temperature, max_tokens, knowledge_base_paths, is_active, use_priority_instructions, data_access')
          .eq('id', globalPersonaConfig.value)
          .eq('is_active', true)
          .single();
        
        if (!globalPersonaError && globalPersona) {
          persona = globalPersona;
          console.log(`[ai-autopilot-chat] âœ… Persona GLOBAL carregada: ${persona.name}`);
        } else {
          console.warn('[ai-autopilot-chat] âš ï¸ Persona global configurada mas nÃ£o encontrada:', globalPersonaConfig.value);
        }
      } else {
        console.log('[ai-autopilot-chat] â„¹ï¸ Nenhuma Persona Global configurada');
      }
    }
    
    // Fallback 2: Usar routing rules se nÃ£o tem persona do fluxo nem global
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
      
      // Fallback: regra sÃ³ com canal (department null)
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
    console.log('[ai-autopilot-chat] ðŸ” Data Access Config:', persona.data_access);
    
    // âœ… Verificar permissÃµes de acesso a dados da persona
    const personaDataAccess = persona.data_access || {
      customer_data: true,
      knowledge_base: true,
      order_history: false,
      financial_data: false,
      tracking_data: false
    };
    
    let canAccessCustomerData = personaDataAccess.customer_data !== false;
    let canAccessKnowledgeBase = personaDataAccess.knowledge_base !== false;
    let canAccessFinancialData = personaDataAccess.financial_data === true;
    let canAccessTracking = personaDataAccess.tracking_data === true || personaDataAccess.order_history === true;
    
    // ðŸ†• FASE 2: Intersectar permissÃµes da persona com toggles do nÃ³ de fluxo
    // Se flow_context.allowed_sources existe, restringir ainda mais
    if (flow_context?.allowed_sources) {
      const flowSources = flow_context.allowed_sources;
      if (!flowSources.includes('kb')) canAccessKnowledgeBase = false;
      if (!flowSources.includes('crm')) canAccessCustomerData = false;
      if (!flowSources.includes('kiwify')) canAccessFinancialData = false;
      if (!flowSources.includes('tracking')) canAccessTracking = false;
      
      console.log('[ai-autopilot-chat] ðŸ” Flow-level source gating applied:', {
        flowSources,
        canAccessKnowledgeBase,
        canAccessCustomerData,
        canAccessFinancialData,
        canAccessTracking
      });
    }
    
    console.log('[ai-autopilot-chat] ðŸ” PermissÃµes finais:', {
      canAccessCustomerData,
      canAccessKnowledgeBase,
      canAccessFinancialData,
      canAccessTracking
    });

    // ðŸŽ“ Buscar exemplos de treinamento (Few-Shot Learning)
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

    // 3. Buscar tools vinculadas Ã  persona
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

    console.log(`[ai-autopilot-chat] ${enabledTools.length} tools disponÃ­veis para esta persona`);

    // 4. Buscar histÃ³rico de mensagens
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(maxHistory);

    if (messagesError) {
      console.error('[ai-autopilot-chat] Erro ao buscar histÃ³rico:', messagesError);
    }

    const messageHistory = messages?.reverse().map(m => ({
      role: m.sender_type === 'contact' ? 'user' : 'assistant',
      content: m.content
    })) || [];

    // Obter API keys antecipadamente
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    // LOVABLE_API_KEY removida - usando OpenAI diretamente
    
    // Usar modelo do RAGConfig jÃ¡ carregado (evita query duplicada)
    const configuredAIModel = ragConfig.model;
    console.log(`[ai-autopilot-chat] Using AI model: ${configuredAIModel}`);
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY nÃ£o configurada');
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

    // Helper: Chamar IA com OpenAI direta (usa modelo configurado + fallback automÃ¡tico)
    const callAIWithFallback = async (payload: any) => {
      const configuredModel = sanitizeModelName(ragConfig.model);
      
      // Models requiring max_completion_tokens: convert max_tokens
      const finalPayload = { ...payload };
      if (MAX_COMPLETION_TOKEN_MODELS.has(configuredModel) && finalPayload.max_tokens) {
        finalPayload.max_completion_tokens = finalPayload.max_tokens;
        delete finalPayload.max_tokens;
      }
      
      // Remove campos nÃ£o suportados por modelos mais novos
      delete finalPayload.stream;
      
      const tryModel = async (model: string, attempt: string, overridePayload?: Record<string, any>) => {
        const attemptPayload = overridePayload ? { ...overridePayload } : { ...finalPayload };
        // Models that don't support max_tokens / temperature
        if (MAX_COMPLETION_TOKEN_MODELS.has(model)) {
          if (attemptPayload.max_tokens) {
            attemptPayload.max_completion_tokens = attemptPayload.max_tokens;
            delete attemptPayload.max_tokens;
          }
          delete attemptPayload.temperature;
        }
        
        console.log(`[callAIWithFallback] ðŸ¤– ${attempt} com modelo: ${model}`);
        
        const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, ...attemptPayload }),
        }, 60000);
        
        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unable to read error body');
          console.error(`[callAIWithFallback] âŒ ${attempt} falhou: ${response.status}`, errorBody);
          
          if (response.status === 429) {
            throw new Error('QUOTA_ERROR: Erro de Saldo/Cota na IA.');
          }
          throw new Error(`OpenAI error: ${response.status} | ${errorBody.substring(0, 200)}`);
        }
        
        return await response.json();
      };
      
      // Tentativa 1: modelo configurado
      try {
        return await tryModel(configuredModel, 'Tentativa principal');
      } catch (primaryError) {
        const errMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
        
        // Se Ã© erro de quota, nÃ£o tentar fallback
        if (errMsg.includes('QUOTA_ERROR')) throw primaryError;
        
        // Se Ã© erro 400/422 (payload invÃ¡lido), tentar modelo de contingÃªncia seguro
        if (errMsg.includes('400') || errMsg.includes('422')) {
          console.warn(`[callAIWithFallback] âš ï¸ Erro ${errMsg.includes('400') ? '400' : '422'} com ${configuredModel}, tentando fallback gpt-5-nano`);
          
          try {
            // Fallback: modelo mais estÃ¡vel e tolerante
            const safeFallbackPayload = { ...finalPayload };
            // gpt-5-nano usa max_completion_tokens
            delete safeFallbackPayload.max_tokens;
            if (!safeFallbackPayload.max_completion_tokens) {
              safeFallbackPayload.max_completion_tokens = 1024;
            }
            
            return await tryModel('gpt-5-nano', 'Fallback tÃ©cnico', safeFallbackPayload);
          } catch (fallbackError) {
            console.error('[callAIWithFallback] âŒ Fallback gpt-5-nano tambÃ©m falhou:', fallbackError);
            throw primaryError; // Propagar erro original
          }
        }
        
        throw primaryError;
      }
    }
    
    // ============================================================
    // ðŸŽ¯ MODO RAG ESTRITO - OpenAI GPT-5 Exclusivo (Anti-AlucinaÃ§Ã£o)
    // ============================================================
    // Quando ativo: usa APENAS OpenAI GPT-5, sem fallback, com thresholds rÃ­gidos
    // Cita fontes explicitamente e recusa responder quando nÃ£o tem informaÃ§Ã£o
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
      console.log('[callStrictRAG] ðŸŽ¯ Iniciando RAG Estrito com GPT-5');
      
      // Filtrar apenas artigos com alta confianÃ§a (â‰¥80%)
      const highConfidenceArticles = knowledgeArticles.filter(
        (a: any) => (a.similarity || 0) >= STRICT_SIMILARITY_THRESHOLD
      );
      
      console.log('[callStrictRAG] ðŸ“Š Artigos filtrados:', {
        total: knowledgeArticles.length,
        highConfidence: highConfidenceArticles.length,
        threshold: STRICT_SIMILARITY_THRESHOLD
      });
      
      // Se nÃ£o houver artigos de alta confianÃ§a, handoff imediato
      if (highConfidenceArticles.length === 0) {
        return {
          shouldHandoff: true,
          reason: 'Nenhum artigo com confianÃ§a >= 80% na base de conhecimento',
          response: null
        };
      }
      
      // Prompt enxuto e focado para RAG estrito
      const strictPrompt = `VocÃª Ã© um assistente de suporte que APENAS responde com base nos documentos fornecidos.

REGRAS ABSOLUTAS:
1. NUNCA invente informaÃ§Ãµes que nÃ£o estejam nos documentos abaixo
2. Se a resposta nÃ£o estiver nos documentos, diga EXATAMENTE: "NÃ£o encontrei essa informaÃ§Ã£o na base de conhecimento. Posso te conectar com um especialista?"
3. Sempre cite a fonte: "De acordo com [tÃ­tulo do artigo]..."
4. Mantenha respostas concisas (mÃ¡ximo 150 palavras)
5. Seja direto e objetivo

DOCUMENTOS DISPONÃVEIS:
${highConfidenceArticles.map((a: any) => `### ${a.title} (${((a.similarity || 0) * 100).toFixed(0)}% relevÃ¢ncia)
${a.content}`).join('\n\n---\n\n')}`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5', // Modelo mais preciso para Strict RAG
            messages: [
              { role: 'system', content: strictPrompt },
              { role: 'user', content: `${contactName}: ${customerMessage}` }
            ],
            max_completion_tokens: 400
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[callStrictRAG] âŒ OpenAI GPT-5 falhou:', response.status, errorText);
          throw new Error(`OpenAI strict RAG failed: ${response.status}`);
        }
        
        const data = await response.json();
        const aiMessage = data.choices?.[0]?.message?.content || '';

        // 🔧 GUARD 1: resposta vazia do modelo → handoff imediato (nunca salvar vazio)
        if (!aiMessage || aiMessage.trim().length === 0) {
          console.warn('[callStrictRAG] ⚠️ GPT-5 retornou resposta vazia - forçando handoff');
          return {
            shouldHandoff: true,
            reason: 'GPT-5 retornou resposta vazia',
            response: null
          };
        }
        
        console.log('[callStrictRAG] ðŸ“ Resposta GPT-5 recebida:', aiMessage.substring(0, 100) + '...');
        
        // ValidaÃ§Ã£o pÃ³s-geraÃ§Ã£o: detectar indicadores de incerteza/alucinaÃ§Ã£o
        const hasUncertainty = HALLUCINATION_INDICATORS.some(
          indicator => aiMessage.toLowerCase().includes(indicator)
        );
        
        if (hasUncertainty) {
          console.log('[callStrictRAG] âš ï¸ Incerteza detectada na resposta - forÃ§ando handoff');
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
          console.log('[callStrictRAG] ðŸ“­ IA indicou que nÃ£o encontrou informaÃ§Ã£o - handoff');
          return {
            shouldHandoff: true,
            reason: 'InformaÃ§Ã£o nÃ£o encontrada na base de conhecimento (IA reconheceu)',
            response: aiMessage
          };
        }
        
        console.log('[callStrictRAG] âœ… Resposta validada com sucesso');
        return {
          shouldHandoff: false,
          reason: null,
          response: aiMessage,
          citedArticles: highConfidenceArticles.map((a: any) => a.title)
        };
        
      } catch (error) {
        console.error('[callStrictRAG] âŒ Erro no RAG estrito:', error);
        // Em modo estrito, erro = handoff (nÃ£o fallback para outro modelo)
        return {
          shouldHandoff: true,
          reason: `Erro no processamento RAG: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          response: null
        };
      }
    }

    // FASE 1 & 2: Classificar intenÃ§Ã£o com lÃ³gica invertida (skip vs search)
    console.log('[ai-autopilot-chat] Classificando intenÃ§Ã£o da mensagem...');
    
    let intentType = 'search'; // Default: sempre buscar
    let knowledgeArticles: any[] = [];
    
    try {
      const intentData = await callAIWithFallback({
        messages: [
          { 
            role: 'system', 
            content: `Classifique a mensagem:
- "skip" APENAS se for: saudaÃ§Ã£o pura (oi, olÃ¡, bom dia), confirmaÃ§Ã£o pura (ok, entendi, beleza), ou elogio/agradecimento puro (obrigado, valeu)
- "search" para QUALQUER outra coisa (perguntas, dÃºvidas, problemas, informaÃ§Ãµes, etc.)

Se tiver QUALQUER indÃ­cio de pergunta ou dÃºvida, responda "search".
Responda APENAS: skip ou search`
          },
          { role: 'user', content: customerMessage }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      intentType = intentData.choices?.[0]?.message?.content?.trim().toLowerCase() || 'search';
      console.log(`[ai-autopilot-chat] IntenÃ§Ã£o detectada: ${intentType}`);
    } catch (error) {
      console.error('[ai-autopilot-chat] Erro na classificaÃ§Ã£o de intenÃ§Ã£o:', error);
      // Fallback: buscar na base em caso de erro
      intentType = 'search';
    }
    
    // FASE 1 & 3: LÃ³gica invertida - buscar para tudo, exceto "skip"
    if (intentType === 'skip') {
      // SaudaÃ§Ãµes/confirmaÃ§Ãµes puras: pular busca na base, responder naturalmente
      console.log('[ai-autopilot-chat] âš¡ Skip detectado - pulando busca na base');
    } else {
      // QUALQUER outra coisa: buscar na base de conhecimento
      console.log('[ai-autopilot-chat] ðŸ” Search - consultando base de conhecimento...');
      
      // âœ… Verificar se persona tem permissÃ£o para acessar knowledge base
      if (!canAccessKnowledgeBase) {
        console.log('[ai-autopilot-chat] ðŸš« Persona NÃƒO tem acesso Ã  base de conhecimento - pulando busca');
        knowledgeArticles = [];
      } else {
        // FASE 1: Verificar categorias especÃ­ficas configuradas
        // ðŸ†• Chat Flow: priorizar categorias do fluxo sobre as da persona
        let activeKbCategories: string[] = [];
        let categorySource = 'ALL (sem filtro)';
        
        const flowCats = flowKbCategories as string[] | null;
        const personaCats = persona.knowledge_base_paths as string[] | null;
        
        // ðŸ†• UPGRADE RESILIÃŠNCIA: Se persona tem acesso global (knowledge_base_paths null)
        // E as categorias vÃªm APENAS do flow, tratar como "sem filtro" para nÃ£o
        // bloquear artigos de categorias novas que ainda nÃ£o foram adicionadas ao flow.
        const personaHasGlobalAccess = !personaCats || personaCats.length === 0;
        
        if (flowCats && Array.isArray(flowCats) && flowCats.length > 0 && !personaHasGlobalAccess) {
          // Categorias definidas no nÃ³ ai_response do Chat Flow â€” SÃ“ aplica se persona tambÃ©m restringe
          activeKbCategories = flowCats;
          categorySource = `Chat Flow (${flowCats.length} categorias)`;
        } else if (!personaHasGlobalAccess && personaCats && personaCats.length > 0) {
          // Categorias da persona (restritivas)
          activeKbCategories = personaCats;
          categorySource = `Persona (${personaCats.length} categorias)`;
        } else {
          // Persona com acesso global â†’ buscar em TODAS as categorias
          categorySource = personaHasGlobalAccess 
            ? 'ALL (persona com acesso global â€” ignorando filtro do flow)' 
            : 'ALL (sem filtro)';
        }
        
        const hasPersonaCategories = activeKbCategories.length > 0;
      
        console.log('[ai-autopilot-chat] ðŸ“‚ KB Categories:', {
          persona_id: persona.id,
          persona_name: persona.name,
          flow_categories: flowKbCategories,
          persona_categories: persona.knowledge_base_paths,
          active_categories: hasPersonaCategories ? activeKbCategories : 'ALL',
          category_source: categorySource
        });
        
        // ðŸ†• Alias para compatibilidade com cÃ³digo existente
        const personaCategories = activeKbCategories;
      
      try {
        // FASE 5: Query Expansion + Semantic Search MÃºltiplo
        if (OPENAI_API_KEY) {
          console.log('[ai-autopilot-chat] ðŸš€ Iniciando Query Expansion...');
          
          // Step 1: Expandir query para mÃºltiplas variaÃ§Ãµes
          let expandedQueries: string[] = [customerMessage];
          
          try {
            const { data: expansionData, error: expansionError } = await supabaseClient.functions.invoke(
              'expand-query',
              { body: { query: customerMessage } }
            );

            if (!expansionError && expansionData?.expanded_queries) {
              // ðŸ›¡ï¸ FASE A+B: Sanitizar queries expandidas - remover tokens sujos
              const rawQueries = expansionData.expanded_queries as string[];
              const sanitizedQueries = rawQueries
                .filter((q: string) => {
                  if (!q || typeof q !== 'string') return false;
                  const trimmed = q.trim();
                  // Remover tokens invÃ¡lidos: code fences, brackets, strings muito curtas
                  if (trimmed.length < 5) return false;
                  if (/^[\[\]{}"`']+$/.test(trimmed)) return false;
                  if (trimmed.startsWith('```')) return false;
                  if (trimmed === 'json' || trimmed === 'JSON') return false;
                  return true;
                })
                .map((q: string) => q.trim())
                .slice(0, 5); // Limitar a 5 queries expandidas
              
              expandedQueries = [customerMessage, ...sanitizedQueries];
              console.log(`[ai-autopilot-chat] âœ… Query expandida em ${expandedQueries.length} variaÃ§Ãµes (sanitizadas)`);
            } else {
              console.log('[ai-autopilot-chat] âš ï¸ Usando apenas query original (expansion falhou)');
            }
          } catch (expansionError) {
            console.error('[ai-autopilot-chat] Erro no query expansion:', expansionError);
          }

          // Step 2: Buscar embeddings para todas as queries expandidas
          const articleMap: Map<string, any> = new Map();
          let embeddingAttempted = false;
          let embeddingSucceeded = false;
          
          // ðŸ›¡ï¸ FASE A: SÃ³ tentar embeddings se OPENAI_API_KEY existir
          if (OPENAI_API_KEY) {
            embeddingAttempted = true;
            
            for (const query of expandedQueries) {
              try {
                console.log(`[ai-autopilot-chat] ðŸ” Gerando embedding para: "${query.substring(0, 50)}..."`);
                
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
                  
                  // Buscar artigos similares - FASE 5: Threshold aumentado para reduzir alucinaÃ§Ãµes
                  const { data: semanticResults, error: semanticError } = await supabaseClient.rpc(
                    'match_knowledge_articles',
                    {
                      query_embedding: queryEmbedding,
                      match_threshold: 0.50, // Reduzido de 0.70 - permite artigos com 50%+ de similaridade
                      match_count: 5,        // Aumentado de 3 para 5 - mais artigos candidatos
                    }
                  );

                  if (!semanticError && semanticResults) {
                    // Adicionar ao mapa para deduplicar (mantÃ©m melhor similaridade)
                    semanticResults.forEach((article: any) => {
                      const existing = articleMap.get(article.id);
                      if (!existing || article.similarity > existing.similarity) {
                        articleMap.set(article.id, article);
                      }
                    });
                  }
                } else {
                  console.warn(`[ai-autopilot-chat] âš ï¸ Embedding falhou com status: ${embeddingResponse.status}`);
                }
              } catch (error) {
                console.error(`[ai-autopilot-chat] âŒ Erro no embedding para query: "${query}"`, error);
              }
            }
          } else {
            console.log('[ai-autopilot-chat] âš ï¸ OPENAI_API_KEY nÃ£o configurada - pulando embeddings');
          }

          // Step 3: Converter mapa para array e aplicar filtros
          let allArticles = Array.from(articleMap.values());
          console.log(`[ai-autopilot-chat] ðŸ“Š Total de artigos Ãºnicos encontrados: ${allArticles.length}`);
          
          // ðŸ›¡ï¸ FASE A: FALLBACK ROBUSTO - Executar busca por palavras-chave se:
          // 1. Embeddings nÃ£o foram tentados (sem OPENAI_API_KEY)
          // 2. Embeddings falharam completamente
          // 3. Embeddings retornaram 0 resultados
          const needsKeywordFallback = !embeddingAttempted || !embeddingSucceeded || allArticles.length === 0;
          
          if (needsKeywordFallback) {
            console.log('[ai-autopilot-chat] ðŸ”„ FALLBACK ATIVO: Buscando por palavras-chave...', {
              reason: !embeddingAttempted ? 'no_openai_key' : !embeddingSucceeded ? 'embedding_failed' : 'no_results',
              original_query: customerMessage.substring(0, 50)
            });
            
            // Extrair palavras-chave relevantes (remover stopwords comuns)
            const stopwords = ['a', 'o', 'e', 'Ã©', 'de', 'da', 'do', 'que', 'para', 'com', 'em', 'um', 'uma', 'os', 'as', 'no', 'na', 'por', 'mais', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'Ã ', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'hÃ¡', 'nos', 'jÃ¡', 'estÃ¡', 'eu', 'tambÃ©m', 'sÃ³', 'pelo', 'pela', 'atÃ©', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estÃ£o', 'vocÃª', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'Ã s', 'minha', 'tÃªm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'serÃ¡', 'nÃ³s', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele', 'tu', 'te', 'vocÃªs', 'vos', 'lhes', 'meus', 'minhas', 'teu', 'tua', 'teus', 'tuas', 'nosso', 'nossa', 'nossos', 'nossas', 'dela', 'delas', 'esta', 'estes', 'estas', 'aquele', 'aquela', 'aqueles', 'aquelas', 'isto', 'aquilo', 'estou', 'estÃ¡', 'estamos', 'estÃ£o', 'estive', 'esteve', 'estivemos', 'estiveram', 'estava', 'estÃ¡vamos', 'estavam', 'estivera', 'estivÃ©ramos', 'esteja', 'estejamos', 'estejam', 'estivesse', 'estivÃ©ssemos', 'estivessem', 'estiver', 'estivermos', 'estiverem', 'hei', 'hÃ¡', 'havemos', 'hÃ£o', 'houve', 'houvemos', 'houveram', 'houvera', 'houvÃ©ramos', 'haja', 'hajamos', 'hajam', 'houvesse', 'houvÃ©ssemos', 'houvessem', 'houver', 'houvermos', 'houverem', 'houverei', 'houverÃ¡', 'houveremos', 'houverÃ£o', 'houveria', 'houverÃ­amos', 'houveriam', 'sou', 'somos', 'sÃ£o', 'era', 'Ã©ramos', 'eram', 'fui', 'foi', 'fomos', 'foram', 'fora', 'fÃ´ramos', 'seja', 'sejamos', 'sejam', 'fosse', 'fÃ´ssemos', 'fossem', 'for', 'formos', 'forem', 'serei', 'serÃ¡', 'seremos', 'serÃ£o', 'seria', 'serÃ­amos', 'seriam', 'tenho', 'tem', 'temos', 'tÃ©m', 'tinha', 'tÃ­nhamos', 'tinham', 'tive', 'teve', 'tivemos', 'tiveram', 'tivera', 'tivÃ©ramos', 'tenha', 'tenhamos', 'tenham', 'tivesse', 'tivÃ©ssemos', 'tivessem', 'tiver', 'tivermos', 'tiverem', 'terei', 'terÃ¡', 'teremos', 'terÃ£o', 'teria', 'terÃ­amos', 'teriam', 'quero', 'preciso', 'gostaria', 'oi', 'olÃ¡', 'bom', 'dia', 'tarde', 'noite', 'obrigado', 'obrigada', 'ok', 'sim', 'nÃ£o'];
            
            const keywords = customerMessage
              .toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .split(/\s+/)
              .filter(word => word.length > 2 && !stopwords.includes(word));
            
            // Termos especÃ­ficos para busca direta (alta prioridade)
            // Termos especÃ­ficos para busca direta (alta prioridade) - EXPANDIDO com termos comuns de clientes
            const directTerms = [
              // Termos existentes
              'shopeecreation', 'shopee', 'creation', 'loja', 'produtos', 'cadastro', 'nivelamento', 'formulario',
              // NOVOS: Termos genÃ©ricos que clientes usam muito
              'pedido', 'pedidos', 'entrega', 'rastreio', 'envio', 'frete', 'rastrear', 'rastreamento',
              'saque', 'dinheiro', 'pix', 'saldo', 'reembolso', 'pagamento', 'comissao',
              'assinatura', 'plano', 'curso', 'acesso', 'login', 'senha',
              'horario', 'atendimento', 'suporte', 'ajuda', 'cancelar', 'cancelamento'
            ];
            const messageLower = customerMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const matchedDirectTerms = directTerms.filter(term => messageLower.includes(term));
            
            console.log('[ai-autopilot-chat] ðŸ”‘ Keywords extraÃ­das:', keywords.slice(0, 10));
            console.log('[ai-autopilot-chat] ðŸŽ¯ Termos diretos encontrados:', matchedDirectTerms);
            
            // Buscar por tÃ­tulo ou conteÃºdo contendo as palavras-chave
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
              console.log(`[ai-autopilot-chat] ðŸ“Š Artigos apÃ³s fallback: ${allArticles.length}`);
            }
          }

          // Filtrar por categoria se persona tiver configurado
          if (hasPersonaCategories) {
            allArticles = allArticles.filter((a: any) => 
              personaCategories.includes(a.category)
            );
            console.log(`[ai-autopilot-chat] ðŸ”’ Filtro de categoria: ${articleMap.size} â†’ ${allArticles.length} artigos`);
          }

          if (allArticles.length > 0) {
            // ðŸ†• BOOST de similaridade para matches de tÃ­tulo (mais relevante que sÃ³ conteÃºdo)
            const customerWords = customerMessage.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
            
            knowledgeArticles = allArticles
              .map((a: any) => {
                // Boost de +0.15 se tÃ­tulo contÃ©m palavra-chave do cliente
                const titleLower = a.title?.toLowerCase() || '';
                const hasKeywordInTitle = customerWords.some((word: string) => titleLower.includes(word));
                const boostedSimilarity = hasKeywordInTitle 
                  ? Math.min((a.similarity || 0.5) + 0.15, 1.0) 
                  : (a.similarity || 0.5);
                
                return {
                  id: a.id,
                  title: a.title,
                  content: a.content,
                  category: a.category,
                  similarity: boostedSimilarity,
                  originalSimilarity: a.similarity, // Para debug
                  boosted: hasKeywordInTitle
                };
              })
              .sort((a: any, b: any) => b.similarity - a.similarity)
              .slice(0, 5);
            
            // ðŸ†• Log detalhado para diagnÃ³stico de KB search
            console.log('[ai-autopilot-chat] ðŸ“š KB SEARCH RESULT:', {
              articles_found: knowledgeArticles.length,
              persona_has_global_access: !persona.knowledge_base_paths || persona.knowledge_base_paths.length === 0,
              persona_categories: persona.knowledge_base_paths,
              data_access_kb_enabled: personaDataAccess.knowledge_base,
              embedding_used: !!OPENAI_API_KEY,
              fallback_used: needsKeywordFallback,
              top_matches: knowledgeArticles.slice(0, 3).map((a: any) => ({
                title: a.title,
                similarity: `${(a.similarity * 100).toFixed(1)}%`,
                category: a.category,
                boosted: a.boosted || false,
                originalSimilarity: a.originalSimilarity ? `${(a.originalSimilarity * 100).toFixed(1)}%` : 'N/A'
              }))
            });
            
            console.log(`[ai-autopilot-chat] âœ… Query Expansion + Semantic: ${knowledgeArticles.length} artigos finais:`, 
              knowledgeArticles.map((a: any) => `${a.title} [${a.category}] (${(a.similarity * 100).toFixed(1)}%${a.boosted ? ' BOOSTED' : ''})`));
          } else {
            console.log('[ai-autopilot-chat] âš ï¸ Nenhum artigo relevante apÃ³s filtros', {
              hasPersonaCategories,
              personaCategories,
              articleMapSize: articleMap.size,
              query: customerMessage.substring(0, 50)
            });
          }
        }
      } catch (searchError) {
        console.error('[ai-autopilot-chat] âŒ Erro geral na busca de conhecimento:', searchError);
        // knowledgeArticles permanece vazio, mas nÃ£o quebra o fluxo
      }
      } // Fechamento do else de canAccessKnowledgeBase
    }

    // 5. FASE 1: Identity Wall - Verificar se contato tem email OU Ã© cliente Kiwify validado
    const contactEmail = customer_context?.email || contact.email;
    const contactHasEmail = !!contactEmail;
    const contactName = customer_context?.name || `${contact.first_name} ${contact.last_name}`.trim();
    const contactCompany = contact.company ? ` da empresa ${contact.company}` : '';
    const contactStatus = contact.status || 'lead';
    
    // ðŸ†• CROSS-SESSION MEMORY: Buscar Ãºltimas 3 conversas fechadas do mesmo contato
    let crossSessionContext = '';
    try {
      const { data: pastConvs } = await supabaseClient
        .from('conversations')
        .select('id, created_at, closed_at')
        .eq('contact_id', contact.id)
        .eq('status', 'closed')
        .neq('id', conversationId)
        .order('closed_at', { ascending: false })
        .limit(3);
      
      if (pastConvs && pastConvs.length > 0) {
        for (const conv of pastConvs) {
          const { data: lastMsg } = await supabaseClient
            .from('messages')
            .select('content, sender_type')
            .eq('conversation_id', conv.id)
            .in('sender_type', ['agent', 'system'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg?.content) {
            const dateStr = conv.closed_at
              ? new Date(conv.closed_at).toLocaleDateString('pt-BR')
              : 'data desconhecida';
            crossSessionContext += `- ${dateStr}: "${lastMsg.content.substring(0, 150)}"\n`;
          }
        }
      }
      if (crossSessionContext) {
        crossSessionContext = `\n\nHistÃ³rico de atendimentos anteriores deste cliente:\n${crossSessionContext}(Use apenas como contexto, nÃ£o mencione explicitamente ao cliente)`;
        console.log(`[ai-autopilot-chat] ðŸ§  Cross-session memory encontrada para contato ${contact.id}`);
      }
    } catch (memErr) {
      console.warn('[ai-autopilot-chat] âš ï¸ Erro ao buscar memÃ³ria cross-session:', memErr);
    }
    
    // ðŸ†• PERSONA CONTEXTUAL: Variar tom baseado no status/contexto do contato
    let personaToneInstruction = '';
    if (contact.status === 'vip' || contact.subscription_plan) {
      personaToneInstruction = '\n\nTom: Extremamente cordial e proativo. Este Ã© um cliente VIP/assinante. OfereÃ§a assistÃªncia premium e priorize a resoluÃ§Ã£o rÃ¡pida.';
    } else if (contact.status === 'churn_risk' || contact.status === 'inactive') {
      personaToneInstruction = '\n\nTom: EmpÃ¡tico e acolhedor. Este cliente pode estar insatisfeito. Demonstre cuidado genuÃ­no e resolva com atenÃ§Ã£o especial.';
    } else if (contact.lead_score && contact.lead_score >= 80) {
      personaToneInstruction = '\n\nTom: Entusiasmado e consultivo. Este Ã© um lead quente com alta pontuaÃ§Ã£o. Seja proativo em ajudar e guiar.';
    }
    
    // ðŸ†• CORREÃ‡ÃƒO: Cliente Ã© "conhecido" se tem email OU se foi validado via Kiwify OU se estÃ¡ na base como customer
    const isKiwifyValidated = contact.kiwify_validated === true;
    const isCustomerInDatabase = contact.status === 'customer';
    // ðŸ†• Cliente identificado pelo telefone (webhook jÃ¡ verificou que existe no banco)
    const isPhoneVerified = customer_context?.isVerified === true;
    const isValidatedCustomer = contactHasEmail || isKiwifyValidated || isCustomerInDatabase || isPhoneVerified;
    
    // ðŸ” LGPD: Dados mascarados para exposiÃ§Ã£o Ã  IA
    const safeEmail = maskEmail(contactEmail);
    const safePhone = maskPhone(contact.phone);
    
    console.log('[ai-autopilot-chat] ðŸ” Identity Wall Check:', {
      hasEmail: contactHasEmail,
      isKiwifyValidated: isKiwifyValidated,
      isCustomerInDatabase: isCustomerInDatabase,
      isPhoneVerified: isPhoneVerified,
      isValidatedCustomer: isValidatedCustomer,
      email: safeEmail,
      channel: responseChannel,
      contactStatus: contact.status
    });
    
    // ðŸ†• CORREÃ‡ÃƒO: Se Ã© cliente validado mas status nÃ£o Ã© 'customer', atualizar
    if (isValidatedCustomer && contact.status !== 'customer') {
      console.log('[ai-autopilot-chat] ðŸ”„ Atualizando status para customer...');
      await supabaseClient
        .from('contacts')
        .update({ status: 'customer' })
        .eq('id', contact.id);
    }
    
    // ðŸ†• CORREÃ‡ÃƒO: Cliente validado vai para SUPORTE, nÃ£o Comercial
    const SUPORTE_DEPT_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
    if (isValidatedCustomer) {
      const { data: currentConv } = await supabaseClient
        .from('conversations')
        .select('department')
        .eq('id', conversationId)
        .single();
      
      if (currentConv && currentConv.department !== SUPORTE_DEPT_ID) {
        console.log('[ai-autopilot-chat] ðŸ¢ Movendo conversa para Suporte (cliente validado)');
        await supabaseClient
          .from('conversations')
          .update({ department: SUPORTE_DEPT_ID })
          .eq('id', conversationId);
      }
    }
    
    // ============================================================
    // ðŸŽ¯ SISTEMA ANTI-ALUCINAÃ‡ÃƒO - VERIFICAÃ‡ÃƒO DE CONFIANÃ‡A
    // ============================================================
    
    // ðŸ†• Usar RAGConfig jÃ¡ carregado (query Ãºnica no inÃ­cio do handler)
    const isStrictRAGMode = ragConfig.strictMode;
    console.log('[ai-autopilot-chat] ðŸŽ¯ Modo RAG Estrito:', isStrictRAGMode ? 'ATIVADO' : 'desativado');
    
    // ============================================================
    // ðŸ†• MODO RAG ESTRITO - Processamento exclusivo com GPT-5
    // Bypass: temas operacionais (pedidos/tracking) pulam o Strict RAG
    // para que a IA possa usar CRM + Tracking lookup
    // ============================================================
    const detectedDept = pickDepartment(customerMessage);
    const isOperationalTopic = ['suporte_pedidos'].includes(detectedDept);
    
    // ðŸ†• BYPASS: Detectar saudaÃ§Ãµes e contatos genÃ©ricos ANTES do Strict RAG
    // Evita que mensagens como "OlÃ¡, vim pelo site" sejam rejeitadas por 0% confianÃ§a
    const isSimpleGreetingEarly = /^(oi|olÃ¡|ola|hey|hi|hello|boa?\s*(dia|tarde|noite)|obrigad[oa]|valeu|ok|tudo\s*(bem|bom|certo|tranquilo|joia|jÃ³ia|beleza)|como\s*(vai|estÃ¡|vc\s*estÃ¡|vc\s*ta|ce\s*ta)|e\s*a[iÃ­]|eai|eae|blz|tranquilo|suave|beleza|fala|falae|salve)[\s!?.,]*$/i.test(customerMessage.trim());
    const isGenericContactEarly = /^(ol[aÃ¡]|oi|hey|boa?\s*(dia|tarde|noite))?[,!.\s]*(vim|cheguei|estou|preciso|quero|gostaria|queria|buscando|procurando|entrei|acessei).{0,80}(atendimento|ajuda|suporte|falar|contato|informaÃ§Ã£o|informaÃ§Ãµes|saber|conhecer|entender|site|pÃ¡gina|pagina|indicaÃ§Ã£o|indicacao)/i.test(customerMessage.trim());
    const isGreetingBypass = isSimpleGreetingEarly || isGenericContactEarly;
    
    if (isGreetingBypass) {
      console.log('[ai-autopilot-chat] ðŸ‘‹ Greeting/contato genÃ©rico detectado â€” BYPASS Strict RAG para resposta natural');
    }
    
    if (isOperationalTopic && isStrictRAGMode) {
      console.log('[ai-autopilot-chat] ðŸ“¦ Tema operacional (pedidos/tracking) detectado - BYPASS do Strict RAG para usar CRM/Tracking');
    }
    
    if (isStrictRAGMode && !isOperationalTopic && !isGreetingBypass && OPENAI_API_KEY && knowledgeArticles.length > 0) {
      console.log('[ai-autopilot-chat] ðŸŽ¯ STRICT RAG MODE ATIVO - Usando GPT-5 exclusivo');
      
      const strictResult = await callStrictRAG(
        supabaseClient,
        customerMessage,
        knowledgeArticles,
        contactName,
        OPENAI_API_KEY
      );
      
      if (strictResult.shouldHandoff) {
        console.log('[ai-autopilot-chat] ðŸš¨ STRICT RAG: Handoff necessÃ¡rio -', strictResult.reason);
        
        // ðŸ†• GUARD: Se flow_context existe, NÃƒO executar handoff direto
        // Pular todo o bloco Strict RAG e cair no fluxo padrÃ£o (persona + contexto)
        if (flow_context) {
          console.log('[ai-autopilot-chat] âš ï¸ STRICT RAG + flow_context â†’ IGNORANDO handoff E resposta strict, caindo no fluxo padrÃ£o (persona)', {
            reason: strictResult.reason,
            flow_id: flow_context.flow_id,
            node_id: flow_context.node_id
          });
          // NÃƒO usa strictResult.response (pode ser null)
          // NÃƒO retorna â€” cai no fluxo padrÃ£o abaixo (linha "FLUXO PADRÃƒO")
        } else {
        // Executar handoff direto (sem flow_context â€” comportamento original preservado)
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
        
        // Finalizar flow state ativo (se existir)
        try {
          const { data: activeFS } = await supabaseClient
            .from('chat_flow_states')
            .select('id')
            .eq('conversation_id', conversationId)
            .in('status', ['active', 'waiting_input', 'in_progress'])
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (activeFS) {
            await supabaseClient
              .from('chat_flow_states')
              .update({ status: 'transferred', completed_at: new Date().toISOString() })
              .eq('id', activeFS.id);
            console.log('[ai-autopilot-chat] âœ… Flow state finalizado (strict RAG handoff):', activeFS.id);
          }
        } catch (fsErr) {
          console.warn('[ai-autopilot-chat] âš ï¸ Erro ao finalizar flow state (strict RAG):', fsErr);
        }
        
        // Mensagem padronizada de handoff para modo estrito
        const strictHandoffMessage = `OlÃ¡ ${contactName}! Para te ajudar da melhor forma com essa questÃ£o especÃ­fica, vou te conectar com um de nossos especialistas.\n\nUm momento, por favor.`;
        
        // Salvar mensagem
        await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: strictHandoffMessage,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        });
        
        // Enviar via WhatsApp se necessÃ¡rio
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
          content: `ðŸŽ¯ **Handoff via Modo RAG Estrito**\n\n**Motivo:** ${strictResult.reason}\n**Pergunta:** "${customerMessage}"\n\nModo anti-alucinaÃ§Ã£o ativo - handoff executado por falta de informaÃ§Ã£o confiÃ¡vel na KB.`,
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
        
        // ðŸ“Š FIX 4: Telemetria anti-alucinaÃ§Ã£o â€” Strict RAG handoff
        console.log(JSON.stringify({
          event: 'ai_decision',
          conversation_id: conversationId,
          reason: 'strict_rag_handoff',
          score: 0,
          hasFlowContext: !!flow_context,
          exitType: 'handoff',
          fallback_used: false,
          articles_found: knowledgeArticles.length,
          timestamp: new Date().toISOString()
        }));
        // Persist telemetry to ai_events (non-blocking)
        Promise.resolve(supabaseClient.from('ai_events').insert({
          entity_type: 'conversation',
          entity_id: conversationId,
          event_type: 'ai_decision_strict_rag_handoff',
          model: 'system',
          score: 0,
          output_json: { reason: 'strict_rag_handoff', exitType: 'handoff', fallback_used: false, articles_found: knowledgeArticles.length, hasFlowContext: !!flow_context },
        })).catch(() => {});
        
        return new Response(JSON.stringify({
          status: 'strict_rag_handoff',
          message: strictHandoffMessage,
          reason: strictResult.reason,
          strict_mode: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        } // end else (no flow_context)
      }
      
      // ðŸ†• GUARD: Se flow_context + shouldHandoff, pular resposta strict (response pode ser null)
      // Cair direto no fluxo padrÃ£o abaixo
      if (flow_context && strictResult.shouldHandoff) {
        console.log('[ai-autopilot-chat] â© Pulando bloco strict response â€” flow_context ativo + shouldHandoff, usando fluxo padrÃ£o');
      } else {
      
      // Resposta validada - enviar ao cliente
      console.log('[ai-autopilot-chat] âœ… STRICT RAG: Resposta validada com fontes citadas');
      
      const strictResponse = strictResult.response!;

      // 🔧 GUARD 2: nunca salvar/enviar resposta vazia mesmo após validação
      if (!strictResponse || strictResponse.trim().length === 0) {
        console.error('[ai-autopilot-chat] ⚠️ strictResponse vazio após validação - usando fallback de saudação');
        const fallbackGreeting = `Olá${contactName ? ', ' + contactName : ''}! Como posso te ajudar hoje? 😊`;
        return new Response(JSON.stringify({
          response: fallbackGreeting,
          source: 'strict_rag_empty_fallback',
          handoff: false
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
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
      
      // Enviar via WhatsApp se necessÃ¡rio
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
            contact.whatsapp_id,
            false, // useQueue
            persona?.name || null // ðŸ†• Nome da persona
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
        confidence_score: 1, // Alto score por ter passado validaÃ§Ã£o
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
      } // end else (strict response block â€” skipped when flow_context + shouldHandoff)
    }
    
    // ============================================================
    // FLUXO PADRÃƒO (modo estrito desativado ou sem artigos)
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

    console.log('[ai-autopilot-chat] ðŸŽ¯ CONFIDENCE SCORE:', {
      score: (confidenceResult.score * 100).toFixed(0) + '%',
      action: confidenceResult.action,
      reason: confidenceResult.reason,
      department: confidenceResult.department,
      components: confidenceResult.components,
      articlesCount: knowledgeArticles.length
    });

    // ðŸš¨ HANDOFF AUTOMÃTICO POR BAIXA CONFIANÃ‡A
    // FASE 5: Corrigido - Faz handoff baseado no SCORE, nÃ£o na existÃªncia de artigos
    // Antes: sÃ³ fazia handoff se knowledgeArticles.length === 0 (bug - ignorava artigos irrelevantes)
    const isSimpleGreeting = /^(oi|olÃ¡|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|tÃ¡|ta|sim|nÃ£o|nao|tudo\s*(bem|bom|certo|tranquilo|joia|jÃ³ia|beleza)|como\s*(vai|estÃ¡|vc\s*estÃ¡|vc\s*ta|ce\s*ta)|e\s*a[iÃ­]|eai|eae|blz|tranquilo|suave|beleza|fala|falae|salve|hey|hi|hello)[\s!?.,]*$/i.test(customerMessage.trim());
    
    // ðŸ†• BYPASS HANDOFF: Detectar se mensagem parece ser pedido/rastreio
    // Se contÃ©m nÃºmero de pedido ou cÃ³digo de rastreio, FORÃ‡AR processamento com tools
    const trackingPatterns = [
      /\b\d{7,15}\b/, // NÃºmeros de 7-15 dÃ­gitos (IDs de pedido)
      /\b[A-Z]{2}\d{9,13}[A-Z]{0,2}\b/i, // CÃ³digos de rastreio (BR123456789BR, LP...)
      /\b(pedido|rastreio|rastrear|entrega|enviado|encomenda|codigo|cÃ³digo|tracking)\b/i, // Palavras-chave
    ];
    const looksLikeTrackingQuery = trackingPatterns.some(p => p.test(customerMessage));
    
    // ðŸ†• Extrair nÃºmeros de pedido/rastreio da mensagem para PRÃ‰-CONSULTA
    const extractedOrderIds = customerMessage.match(/\b\d{7,15}\b/g) || [];
    const extractedTrackingCodes = customerMessage.match(/\b[A-Z]{2}\d{9,13}[A-Z]{0,2}\b/gi) || [];
    const allExtractedCodes = [...new Set([...extractedOrderIds, ...extractedTrackingCodes])];
    
    console.log('[ai-autopilot-chat] ðŸ” Tracking query detection:', {
      customerMessage: customerMessage.substring(0, 50),
      looksLikeTrackingQuery,
      canAccessTracking,
      originalAction: confidenceResult.action,
      extractedCodes: allExtractedCodes
    });
    
    // ðŸšš PRÃ‰-CONSULTA DIRETA: Se detectar nÃºmeros de pedido/rastreio, consultar MySQL ANTES da IA
    if (allExtractedCodes.length > 0 && canAccessTracking) {
      console.log('[ai-autopilot-chat] ðŸšš PRÃ‰-CONSULTA DIRETA: Consultando MySQL com cÃ³digos extraÃ­dos');
      
      try {
        const { data: fetchResult, error: fetchError } = await supabaseClient.functions.invoke('fetch-tracking', {
          body: { tracking_codes: allExtractedCodes }
        });
        
        console.log('[ai-autopilot-chat] ðŸšš PRÃ‰-CONSULTA resultado:', {
          success: fetchResult?.success,
          found: fetchResult?.found,
          total: fetchResult?.total_requested,
          hasData: !!fetchResult?.data
        });
        
        // Se encontrou resultados, retornar resposta direta SEM chamar IA
        if (fetchResult?.success && fetchResult?.found > 0 && fetchResult?.data) {
          console.log('[ai-autopilot-chat] ðŸšš BYPASS IA: Retornando dados de rastreio diretamente');
          
          let directResponse = '';
          const codesFound: string[] = [];
          const codesNotFound: string[] = [];
          
          for (const code of allExtractedCodes) {
            const info = fetchResult.data[code];
            if (info) {
              codesFound.push(code);
              const packedAt = info.express_time_formatted || 'Recentemente';
              const trackingNum = info.tracking_number || 'Aguardando cÃ³digo';
              const buyerName = info.buyer_name || '';
              const status = info.order_status_label || info.status || 'Em processamento';
              
              if (info.is_packed) {
                directResponse += `**Pedido ${code}**${buyerName ? ` - ${buyerName}` : ''}
ðŸ“¦ Embalado em: ${packedAt}
ðŸšš CÃ³digo de rastreio: ${trackingNum}
âœ… Status: ${status}

`;
              } else {
                directResponse += `**Pedido ${code}**${buyerName ? ` - ${buyerName}` : ''}
â³ ${info.packing_message || 'Pedido ainda estÃ¡ sendo preparado.'}
ðŸ“‹ Status: ${status}

`;
              }
            } else {
              codesNotFound.push(code);
            }
          }
          
          // Adicionar mensagem para cÃ³digos nÃ£o encontrados
          if (codesNotFound.length > 0) {
            if (codesNotFound.length === 1) {
              directResponse += `\nâ“ O cÃ³digo **${codesNotFound[0]}** nÃ£o foi encontrado no sistema.
Este nÃºmero estÃ¡ correto? Se sim, pode ser que o pedido ainda nÃ£o tenha entrado em preparaÃ§Ã£o.`;
            } else {
              directResponse += `\nâ“ Os seguintes cÃ³digos nÃ£o foram encontrados: ${codesNotFound.join(', ')}
Esses nÃºmeros estÃ£o corretos? Se sim, pode ser que ainda nÃ£o tenham entrado em preparaÃ§Ã£o.`;
            }
          }
          
          if (codesFound.length > 0) {
            directResponse = `Encontrei as informaÃ§Ãµes do seu pedido:\n\n${directResponse}\nPosso ajudar com mais alguma coisa?`;
          } else {
            directResponse = directResponse.trim();
          }
          
          // Salvar mensagem no banco
          const { data: savedDirectMsg } = await supabaseClient
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: directResponse,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            })
            .select('id')
            .single();
          
          // Enviar via WhatsApp se necessÃ¡rio
          if (responseChannel === 'whatsapp' && contact?.phone && savedDirectMsg) {
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
                directResponse,
                conversationId,
                contact.whatsapp_id
              );
            }
          }
          
          // Atualizar last_message_at
          await supabaseClient
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);
          
          return new Response(JSON.stringify({
            status: 'success',
            message: directResponse,
            type: 'direct_tracking_lookup',
            codes_found: codesFound,
            codes_not_found: codesNotFound,
            bypassed_ai: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Se NÃƒO encontrou nada, perguntar se o nÃºmero estÃ¡ correto
        if (fetchResult?.success && fetchResult?.found === 0) {
          console.log('[ai-autopilot-chat] ðŸšš Nenhum cÃ³digo encontrado - perguntando confirmaÃ§Ã£o');
          
          const notFoundMessage = allExtractedCodes.length === 1
            ? `NÃ£o encontrei o pedido **${allExtractedCodes[0]}** no sistema de rastreio.

ðŸ¤” Esse nÃºmero estÃ¡ correto?

Se foi pago recentemente, pode ser que ainda nÃ£o tenha entrado em preparaÃ§Ã£o. Caso contrÃ¡rio, me envie o nÃºmero correto para eu verificar novamente.`
            : `NÃ£o encontrei os cÃ³digos ${allExtractedCodes.join(', ')} no sistema de rastreio.

ðŸ¤” Esses nÃºmeros estÃ£o corretos?

Se foram pagos recentemente, pode ser que ainda nÃ£o tenham entrado em preparaÃ§Ã£o.`;
          
          // Salvar mensagem no banco
          const { data: savedNotFoundMsg } = await supabaseClient
            .from('messages')
            .insert({
              conversation_id: conversationId,
              content: notFoundMessage,
              sender_type: 'user',
              is_ai_generated: true,
              channel: responseChannel
            })
            .select('id')
            .single();
          
          // Enviar via WhatsApp se necessÃ¡rio
          if (responseChannel === 'whatsapp' && contact?.phone && savedNotFoundMsg) {
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
                notFoundMessage,
                conversationId,
                contact.whatsapp_id
              );
            }
          }
          
          // Atualizar last_message_at
          await supabaseClient
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);
          
          return new Response(JSON.stringify({
            status: 'success',
            message: notFoundMessage,
            type: 'tracking_not_found_confirmation',
            codes_searched: allExtractedCodes,
            bypassed_ai: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
      } catch (preQueryError) {
        console.error('[ai-autopilot-chat] âŒ Erro na prÃ©-consulta de rastreio:', preQueryError);
        // Continua para o fluxo normal da IA
      }
    }
    
    // ðŸ†• Se parece ser consulta de rastreio E temos permissÃ£o de tracking, FORÃ‡AR resposta (nÃ£o handoff)
    if (looksLikeTrackingQuery && canAccessTracking && confidenceResult.action === 'handoff') {
      console.log('[ai-autopilot-chat] ðŸšš BYPASS HANDOFF: Mensagem parece ser pedido/rastreio - forÃ§ando processamento com tools');
      confidenceResult.action = 'cautious'; // Usar 'cautious' que permite resposta com tools
      confidenceResult.reason = 'Detectado cÃ³digo de pedido/rastreio - tentando consultar via check_tracking tool';
    }
    
    // ðŸ†• Detectar mensagens genÃ©ricas de "quero atendimento" (NÃƒO fazer handoff imediato)
    const isGenericContactRequest = /^(ol[aÃ¡]|oi|bom dia|boa tarde|boa noite)?[,!.\s]*(vim|cheguei|estou|preciso|quero|gostaria|queria|buscando|procurando).{0,50}(atendimento|ajuda|suporte|falar|contato|informaÃ§Ã£o|informaÃ§Ãµes|saber|conhecer|entender)/i.test(customerMessage.trim());
    
    // Buscar contagem de mensagens do cliente para determinar se Ã© inÃ­cio de conversa
    const { count: customerMessagesCount } = await supabaseClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'contact');
    
    const isEarlyConversation = (customerMessagesCount || 0) <= 2;
    
    // ðŸ†• CONDIÃ‡ÃƒO EXPANDIDA: NÃ£o fazer handoff se for saudaÃ§Ã£o OU contato genÃ©rico no inÃ­cio da conversa
    const shouldSkipHandoff = isSimpleGreeting || (isGenericContactRequest && isEarlyConversation);
    
    console.log('[ai-autopilot-chat] ðŸ” Handoff check:', {
      isSimpleGreeting,
      isGenericContactRequest,
      isEarlyConversation,
      customerMessagesCount,
      shouldSkipHandoff,
      confidenceAction: confidenceResult.action
    });
    
    // ðŸ†• Responder com boas-vindas para mensagens de contato inicial (antes do handoff)
    if (isGenericContactRequest && isEarlyConversation && confidenceResult.action === 'handoff') {
      console.log('[ai-autopilot-chat] ðŸ‘‹ Mensagem de primeiro contato genÃ©rico detectada - respondendo com boas-vindas');
      
      // Usar template do banco ou fallback
      let welcomeMessage = await getMessageTemplate(
        supabaseClient,
        'primeiro_contato_boas_vindas',
        { contact_name: contactName || '' }
      );
      
      if (!welcomeMessage) {
        const firstName = contactName ? contactName.split(' ')[0] : '';
        welcomeMessage = `OlÃ¡${firstName ? `, ${firstName}` : ''}! ðŸ‘‹\n\nFicamos felizes com seu contato! Em que posso te ajudar hoje?`;
      }
      
      // Salvar mensagem
      await supabaseClient.from('messages').insert({
        conversation_id: conversationId,
        content: welcomeMessage,
        sender_type: 'user',
        is_ai_generated: true,
        channel: responseChannel
      });
      
      // ðŸ“¤ ENVIAR PARA WHATSAPP (se for canal WhatsApp) - Meta ou Evolution
      if (responseChannel === 'whatsapp' && contact?.phone) {
        const whatsappResult = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation
        );
        
        if (whatsappResult) {
          console.log('[ai-autopilot-chat] ðŸ“¤ Enviando boas-vindas via WhatsApp');
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
    
    // ðŸ†• NOVA VERIFICAÃ‡ÃƒO: Cliente pediu EXPLICITAMENTE por humano?
    // SÃ³ faz handoff se cliente usou uma das frases de pedido explÃ­cito
    const customerRequestedHuman = EXPLICIT_HUMAN_REQUEST_PATTERNS.some(pattern => 
      pattern.test(customerMessage)
    );
    
    console.log('[ai-autopilot-chat] ðŸ” Handoff check:', {
      confidenceAction: confidenceResult.action,
      customerRequestedHuman,
      shouldSkipHandoff,
      customerMessage: customerMessage.substring(0, 60)
    });
    
    // ============================================================
    // ðŸ†• FIX: 0 artigos + 0% confianÃ§a + flow_context â†’ NÃƒO SAIR, forÃ§ar modo cautious
    // A IA deve sempre tentar responder usando persona + contexto + conhecimento geral
    // ============================================================
    if (flow_context && confidenceResult.score === 0 && knowledgeArticles.length === 0 && !shouldSkipHandoff) {
      console.log('[ai-autopilot-chat] âš ï¸ ZERO CONFIDENCE + ZERO ARTICLES + flow_context â†’ forÃ§ando modo CAUTIOUS (permanece no nÃ³)', {
        score: confidenceResult.score,
        articles: knowledgeArticles.length,
        flow_id: flow_context.flow_id,
        node_id: flow_context.node_id
      });
      
      // ðŸ“Š FIX 4: Telemetria anti-alucinaÃ§Ã£o â€” Zero confidence guard
      console.log(JSON.stringify({
        event: 'ai_decision',
        conversation_id: conversationId,
        reason: 'zero_confidence_cautious',
        score: confidenceResult.score,
        hasFlowContext: true,
        exitType: 'stay_in_node',
        fallback_used: false,
        articles_found: knowledgeArticles.length,
        timestamp: new Date().toISOString()
      }));
      Promise.resolve(supabaseClient.from('ai_events').insert({
        entity_type: 'conversation',
        entity_id: conversationId,
        event_type: 'ai_decision_zero_confidence_cautious',
        model: 'system',
        score: confidenceResult.score,
        output_json: { reason: 'zero_confidence_cautious', exitType: 'stay_in_node', fallback_used: false, articles_found: knowledgeArticles.length, hasFlowContext: true },
      })).catch(() => {});
      
      // ForÃ§ar modo cautious em vez de sair do nÃ³
      confidenceResult.action = 'cautious';
      // Continua execuÃ§Ã£o normalmente â€” a IA serÃ¡ chamada com persona + contexto
    }


    // ðŸ†• MUDANÃ‡A CRÃTICA: SÃ³ fazer handoff se cliente PEDIR EXPLICITAMENTE
    // OU se action Ã© 'handoff' E cliente pediu humano
    // REMOVIDO: handoff automÃ¡tico por baixa confianÃ§a
    if (customerRequestedHuman) {
      console.log('[ai-autopilot-chat] ðŸš¨ CLIENTE PEDIU HUMANO EXPLICITAMENTE');
      
      // ðŸ†• VERIFICAÃ‡ÃƒO DE LEAD: Se nÃ£o tem email E nÃ£o Ã© cliente â†’ PEDIR EMAIL PRIMEIRO
      const isLeadWithoutEmail = !contactHasEmail && !isCustomerInDatabase && !isKiwifyValidated && !isPhoneVerified;
      const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
      const DEPT_SUPORTE_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
      
      console.log('[ai-autopilot-chat] ðŸŽ¯ Handoff department decision:', {
        isLeadWithoutEmail,
        contactHasEmail,
        isCustomerInDatabase,
        isPhoneVerified,
        contactStatus: contact.status
      });
      
      // Lead sem email â†’ Pedir email primeiro antes de transferir
      if (isLeadWithoutEmail) {
        const existingMetadata = conversation.customer_metadata || {};
        const alreadyAwaitingEmail = existingMetadata.awaiting_email_for_handoff === true;
        const existingHandoffBlockedAt = existingMetadata.handoff_blocked_at ? new Date(existingMetadata.handoff_blocked_at).getTime() : 0;
        const timeSinceBlocked = Date.now() - existingHandoffBlockedAt;
        const ANTI_SPAM_WINDOW_MS = 60000; // 60 segundos
        
        console.log('[ai-autopilot-chat] ðŸ” LEAD SEM EMAIL - Verificando estado:', {
          alreadyAwaitingEmail,
          timeSinceBlocked: Math.round(timeSinceBlocked / 1000) + 's',
          antiSpamActive: alreadyAwaitingEmail && timeSinceBlocked < ANTI_SPAM_WINDOW_MS
        });
        
        // ðŸ›¡ï¸ ANTI-SPAM: Se jÃ¡ pediu email recentemente, NÃƒO repetir a mesma mensagem
        if (alreadyAwaitingEmail && timeSinceBlocked < ANTI_SPAM_WINDOW_MS) {
          console.log('[ai-autopilot-chat] ðŸ›¡ï¸ Anti-spam ativo - nÃ£o repetindo pedido de email');
          
          // Apenas retornar status sem enviar nova mensagem
          return new Response(JSON.stringify({
            status: 'awaiting_email',
            message: null,
            reason: 'Anti-spam: pedido de email jÃ¡ enviado recentemente',
            anti_spam_active: true,
            time_since_blocked: Math.round(timeSinceBlocked / 1000)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('[ai-autopilot-chat] ðŸ“§ Pedindo email pela primeira vez (ou apÃ³s janela anti-spam)');
        
        // Usar template do banco ou fallback - ðŸ†• Adicionar instruÃ§Ã£o sobre formato
        let askEmailMessage = await getMessageTemplate(
          supabaseClient,
          'identity_wall_ask_email',
          { contact_name: contactName || '' }
        );
        
        if (!askEmailMessage) {
          const firstName = contactName ? contactName.split(' ')[0] : '';
          askEmailMessage = `OlÃ¡${firstName ? `, ${firstName}` : ''}! ðŸ‘‹\n\nPara garantir um atendimento personalizado e seguro, preciso que vocÃª me informe seu email.\n\nðŸ“§ *Envie apenas o email em uma linha (ex: seunome@email.com)*`;
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
            console.log('[ai-autopilot-chat] ðŸ“¤ Enviando pedido de email via WhatsApp');
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
        
        // ðŸ†• PRESERVAÃ‡ÃƒO DE CONTEXTO: Salvar intenÃ§Ã£o original antes de pedir email
        const originalIntent = customerMessage;
        const originalIntentCategory = detectIntentCategory(customerMessage);
        
        console.log('[ai-autopilot-chat] ðŸ“§ Salvando contexto original:', {
          originalIntent: originalIntent.substring(0, 50) + '...',
          originalIntentCategory
        });
        
        // Atualizar metadata para rastrear que estamos aguardando email + CONTEXTO ORIGINAL
        await supabaseClient.from('conversations')
          .update({
            customer_metadata: {
              ...(conversation.customer_metadata || {}),
              awaiting_email_for_handoff: true,
              handoff_blocked_at: new Date().toISOString(),
              handoff_blocked_reason: 'low_confidence_lead_without_email',
              // ðŸ†• CONTEXTO: Salvar intenÃ§Ã£o original para recuperar apÃ³s email
              original_intent: originalIntent,
              original_intent_category: originalIntentCategory,
              original_intent_timestamp: new Date().toISOString()
            }
          })
          .eq('id', conversationId);
        
        console.log('[ai-autopilot-chat] âœ… Handoff bloqueado - aguardando email do lead');
        
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
      
      // ðŸ†• GUARD: Se flow_context existe, NÃƒO executar handoff direto
      // Devolver controle ao process-chat-flow para avanÃ§ar ao prÃ³ximo nÃ³
      if (flow_context) {
        console.log('[ai-autopilot-chat] ðŸ”„ CONFIDENCE HANDOFF + flow_context â†’ retornando flow_advance_needed (soberania do fluxo)', {
          score: confidenceResult.score,
          reason: confidenceResult.reason,
          flow_id: flow_context.flow_id,
          node_id: flow_context.node_id
        });
        
        // Log de qualidade
        await supabaseClient.from('ai_quality_logs').insert({
          conversation_id: conversationId,
          contact_id: contact.id,
          customer_message: customerMessage,
          action_taken: 'flow_advance',
          handoff_reason: `confidence_flow_advance: ${confidenceResult.reason}`,
          confidence_score: confidenceResult.score,
          articles_count: knowledgeArticles.length
        });
        
        // ðŸ“Š FIX 4: Telemetria anti-alucinaÃ§Ã£o â€” Confidence handoff (flow_advance_needed)
        console.log(JSON.stringify({
          event: 'ai_decision',
          conversation_id: conversationId,
          reason: 'confidence_flow_advance',
          score: confidenceResult.score,
          hasFlowContext: true,
          exitType: 'flow_advance_needed',
          fallback_used: false,
          articles_found: knowledgeArticles.length,
          timestamp: new Date().toISOString()
        }));
        Promise.resolve(supabaseClient.from('ai_events').insert({
          entity_type: 'conversation',
          entity_id: conversationId,
          event_type: 'ai_decision_confidence_flow_advance',
          model: 'system',
          score: confidenceResult.score,
          output_json: { reason: 'confidence_flow_advance', exitType: 'flow_advance_needed', fallback_used: false, articles_found: knowledgeArticles.length, hasFlowContext: true },
        })).catch(() => {});
        
        return new Response(JSON.stringify({
          status: 'flow_advance_needed',
          reason: confidenceResult.reason,
          score: confidenceResult.score,
          hasFlowContext: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // âœ… Cliente identificado â†’ Continuar com handoff normal para Suporte (sem flow_context)
      // âœ… Respeitar departamento definido pelo fluxo (nunca sobrescrever)
      const handoffDepartment = conversation.department || confidenceResult.department || DEPT_SUPORTE_ID;
      
      console.log('[ai-autopilot-chat] ðŸ”„ Departamento de handoff:', {
        flowDepartment: conversation.department,
        aiDetectedDepartment: confidenceResult.department || 'nenhum',
        finalDepartment: handoffDepartment,
        reason: conversation.department ? 'RESPEITANDO FLUXO' : 'USANDO IA'
      });
      
      // ðŸ›¡ï¸ Atualizar ai_mode para waiting_human E marcar timestamp anti-race-condition
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
      
      console.log('[ai-autopilot-chat] âœ… Handoff marcado com timestamp:', handoffTimestamp);
      
      // Rotear para agente COM DEPARTAMENTO EXPLÃCITO
      const { data: routeResult } = await supabaseClient.functions.invoke('route-conversation', {
        body: { 
          conversationId, 
          department_id: handoffDepartment 
        }
      });
      
      // Finalizar flow state ativo (se existir)
      try {
        const { data: activeFS2 } = await supabaseClient
          .from('chat_flow_states')
          .select('id')
          .eq('conversation_id', conversationId)
          .in('status', ['active', 'waiting_input', 'in_progress'])
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (activeFS2) {
          await supabaseClient
            .from('chat_flow_states')
            .update({ status: 'transferred', completed_at: new Date().toISOString() })
            .eq('id', activeFS2.id);
          console.log('[ai-autopilot-chat] âœ… Flow state finalizado (confidence handoff):', activeFS2.id);
        }
      } catch (fsErr) {
        console.warn('[ai-autopilot-chat] âš ï¸ Erro ao finalizar flow state (confidence):', fsErr);
      }
      
      // Mensagem para cliente identificado
      const handoffMessage = `OlÃ¡ ${contactName}! Para te ajudar melhor com essa questÃ£o, vou te conectar com um de nossos especialistas. Um momento, por favor.`;
      
      // Salvar mensagem
      await supabaseClient.from('messages').insert({
        conversation_id: conversationId,
        content: handoffMessage,
        sender_type: 'user',
        is_ai_generated: true,
        channel: responseChannel
      });
      
      // ðŸ“¤ ENVIAR PARA WHATSAPP (se for canal WhatsApp) - Meta ou Evolution
      if (responseChannel === 'whatsapp' && contact?.phone) {
        const whatsappResult = await getWhatsAppInstanceForConversation(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation
        );
        
        if (whatsappResult) {
          console.log('[ai-autopilot-chat] ðŸ“¤ Enviando mensagem de handoff via WhatsApp');
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
            console.error('[ai-autopilot-chat] âŒ Erro ao enviar handoff via WhatsApp:', sendResult.error);
          } else {
            console.log('[ai-autopilot-chat] âœ… Handoff enviado via WhatsApp');
          }
        }
      }
      
      // Registrar nota interna
      await supabaseClient.from('interactions').insert({
        customer_id: contact.id,
        type: 'internal_note',
        content: `ðŸŽ¯ **Handoff AutomÃ¡tico por Baixa ConfianÃ§a**

**Score:** ${(confidenceResult.score * 100).toFixed(0)}%
**Motivo:** ${confidenceResult.reason}
**Departamento:** ðŸŽ§ Suporte (Cliente identificado)
**Pergunta do Cliente:** "${customerMessage}"

**AÃ§Ã£o:** IA nÃ£o tinha informaÃ§Ãµes suficientes na base de conhecimento para responder com seguranÃ§a.`,
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
      knowledgeContext = `\n\n**ðŸ“š BASE DE CONHECIMENTO:**\n${knowledgeArticles.map(a => 
        `**${a.title}**\n${a.content}`
      ).join('\n\n---\n\n')}`;
    }
    
    // ðŸ†• SANDBOX TRAINING: Buscar artigos de treinamento do sandbox quando fonte habilitada
    let sandboxTrainingContext = '';
    let sandboxUsedFlag = false;
    if (ragConfig.sources?.sandbox) {
      try {
        const { data: sandboxArticles } = await supabaseClient
          .from('knowledge_articles')
          .select('id, title, content')
          .eq('source', 'sandbox_training')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (sandboxArticles && sandboxArticles.length > 0) {
          sandboxUsedFlag = true;
          sandboxTrainingContext = `\n\n**ðŸ§ª EXEMPLOS DE TREINAMENTO (Sandbox):**\nOs exemplos abaixo sÃ£o pares de pergunta-resposta validados manualmente. Use-os como referÃªncia de tom, estilo e precisÃ£o para suas respostas.\n${sandboxArticles.map((a: any) => 
            `**${a.title}**\n${a.content}`
          ).join('\n\n---\n\n')}`;
          
          console.log(`[ai-autopilot-chat] ðŸ§ª Sandbox training: ${sandboxArticles.length} artigos carregados`);
        } else {
          console.log('[ai-autopilot-chat] ðŸ§ª Sandbox training: nenhum artigo encontrado');
        }
      } catch (sandboxErr) {
        console.error('[ai-autopilot-chat] âŒ Erro ao buscar sandbox training:', sandboxErr);
      }
    } else {
      console.log('[ai-autopilot-chat] ðŸ§ª Sandbox training: fonte desabilitada nas configuraÃ§Ãµes');
    }
    
    // FASE 2: Preparar contexto financeiro (CPF mascarado)
    const contactCPF = contact.document || ''; // CPF completo
    const maskedCPF = contactCPF.length >= 4 ? `***.***.***-${contactCPF.slice(-2)}` : 'NÃ£o cadastrado';
    const cpfLast4 = contactCPF.length >= 4 ? contactCPF.slice(-4) : '';
    
    // ðŸ” DEBUG: Log CPF data
    console.log('[ai-autopilot-chat] ðŸ” CPF DEBUG:', {
      has_document: !!contact.document,
      document_length: contact.document?.length,
      maskedCPF: maskedCPF,
      cpfLast4: cpfLast4,
      contact_status: contact.status
    });
    
    // ============================================================
    // ðŸ”’ DEFINIÃ‡Ã•ES UNIFICADAS DE CLIENTE (evita inconsistÃªncias)
    // ============================================================
    // âœ… CORREÃ‡ÃƒO: Cliente verificado = tem email cadastrado (independente de status)
    // Status Ã© atualizado automaticamente pelo webhook Kiwify quando hÃ¡ compra
    const isContactVerified = !!contact.email;
    const hasCompleteCadastro = !!contactCPF; // CPF cadastrado
    const canAccessFinancialFeatures = isContactVerified && hasCompleteCadastro;
    
    console.log('[ai-autopilot-chat] ðŸ” CUSTOMER STATUS:', {
      contact_id: contact.id,
      contact_name: contactName,
      has_email: !!contact.email,
      contact_status: contact.status,
      has_cpf: hasCompleteCadastro,
      is_contact_verified: isContactVerified,
      can_access_financial_features: canAccessFinancialFeatures,
      channel: responseChannel
    });
    
    // âœ… CORREÃ‡ÃƒO: Cliente real = tem email + tem CPF (independente de status)
    const isRealCustomer = !!contact.email && hasCompleteCadastro;
    const canRequestWithdrawal = canAccessFinancialFeatures;
    const withdrawalBlockReason = !hasCompleteCadastro 
      ? 'CPF nÃ£o cadastrado - nÃ£o Ã© cliente verificado'
      : !contact.email
        ? 'Email nÃ£o cadastrado - precisa se identificar primeiro'
        : null;
    
    // ðŸš¨ DETECÃ‡ÃƒO DE TIPO DE SOLICITAÃ‡ÃƒO FINANCEIRA
    // Separamos em 3 categorias com tratamentos diferentes:
    // 1. SAQUE DE SALDO â†’ Exige OTP (seguranÃ§a mÃ¡xima)
    // 2. REEMBOLSO DE PEDIDO â†’ Sem OTP (explica processo)
    // 3. CANCELAMENTO DE ASSINATURA â†’ Sem OTP (processo Kiwify)
    
    const isFinancialRequest = FINANCIAL_BARRIER_KEYWORDS.some(keyword =>
      customerMessage.toLowerCase().includes(keyword)
    );
    
    // ðŸ” SAQUE DE SALDO - ÃšNICA operaÃ§Ã£o que EXIGE OTP
    const isWithdrawalRequest = WITHDRAWAL_ACTION_PATTERNS.some(pattern =>
      pattern.test(customerMessage)
    ) || OTP_REQUIRED_KEYWORDS.some(keyword =>
      customerMessage.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // ðŸ“¦ REEMBOLSO DE PEDIDO - Sem OTP, explica processo
    const isRefundRequest = REFUND_ACTION_PATTERNS.some(pattern =>
      pattern.test(customerMessage)
    );
    
    // âŒ CANCELAMENTO DE ASSINATURA - Sem OTP, processo Kiwify
    const isCancellationRequest = CANCELLATION_ACTION_PATTERNS.some(pattern =>
      pattern.test(customerMessage)
    );
    
    console.log('[ai-autopilot-chat] ðŸŽ¯ FINANCIAL REQUEST DETECTION:', {
      isFinancialRequest,
      isWithdrawalRequest,    // ÃšNICA que exige OTP
      isRefundRequest,        // Sem OTP
      isCancellationRequest,  // Sem OTP
      message_preview: customerMessage.substring(0, 50)
    });

    // ============================================================
    // BYPASS DIRETO: CANCELAMENTO DE ASSINATURA
    // Responde imediatamente com a resposta padrao Kiwify
    // SEM passar pelo sistema de confianca, SEM pedir email
    // ============================================================
    if (isCancellationRequest) {
      console.log('[ai-autopilot-chat] CANCELAMENTO DETECTADO - Bypass direto para resposta Kiwify');
      
      const cancellationResponse = `Entendi! O cancelamento de cursos/assinaturas é feito diretamente pela plataforma Kiwify.

📌 Você tem *7 dias de garantia* a partir da compra para solicitar reembolso.

🔗 *Acesse aqui para cancelar:* https://reembolso.kiwify.com.br/login

Use o mesmo email da compra para fazer login e solicitar o reembolso.

Posso ajudar em mais alguma coisa?`;
      
      // Salvar mensagem
      const { data: cancellationMsgData } = await supabaseClient
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: cancellationResponse,
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
      
      // Enviar via WhatsApp se necessÃ¡rio
      if (responseChannel === 'whatsapp' && contact?.phone && cancellationMsgData) {
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
            cancellationResponse,
            conversationId,
            contact.whatsapp_id
          );
        }
      }
      
      // Log de qualidade
      await supabaseClient.from('ai_quality_logs').insert({
        conversation_id: conversationId,
        contact_id: contact.id,
        customer_message: customerMessage,
        ai_response: cancellationResponse,
        action_taken: 'direct_cancellation_bypass',
        confidence_score: 1,
        articles_count: 0
      });
      
      return new Response(JSON.stringify({
        status: 'success',
        message: cancellationResponse,
        type: 'direct_cancellation_response',
        bypassed_ai: true,
        reason: 'Cancelamento de assinatura detectado - resposta direta sem necessidade de identificaÃ§Ã£o'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar se tem verificaÃ§Ã£o OTP recente (1 HORA para operaÃ§Ãµes financeiras)
    const { data: recentVerification } = await supabaseClient
      .from('email_verifications')
      .select('*')
      .eq('email', contactEmail)
      .eq('verified', true)
      .gte('created_at', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()) // 1h ao invÃ©s de 24h
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const hasRecentOTPVerification = !!recentVerification;
    
    // ðŸ†• FASE: Verificar se cliente JÃ FEZ OTP ALGUMA VEZ (primeiro contato)
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

    console.log('[ai-autopilot-chat] ðŸ” FIRST CONTACT CHECK:', {
      contact_email: contactEmail,
      has_ever_verified_otp: hasEverVerifiedOTP,
      is_first_contact: !hasEverVerifiedOTP && contactHasEmail
    });
    
    // ============================================================
    // ðŸŽ¯ DECISION MATRIX - Log unificado para debugging de fluxo
    // ============================================================
    // ðŸ†• OTP APENAS para SAQUE DE SALDO (isWithdrawalRequest)
    // Reembolsos e cancelamentos NÃƒO precisam de OTP
    const needsOTPForFinancial = isWithdrawalRequest && !contactHasEmail && isValidatedCustomer;
    const willAskForEmail = !isValidatedCustomer; // SÃ³ pede email se nÃ£o for cliente conhecido
    const willSendOTP = contactHasEmail && !hasEverVerifiedOTP;
    const willAskFinancialOTP = contactHasEmail && hasEverVerifiedOTP && isWithdrawalRequest && !hasRecentOTPVerification;
    const willProcessNormally = isValidatedCustomer && !isWithdrawalRequest;
    
    console.log('[ai-autopilot-chat] ðŸŽ¯ DECISION MATRIX:', {
      // Inputs
      contactHasEmail,
      isCustomerInDatabase,
      isKiwifyValidated,
      hasEverVerifiedOTP,
      hasRecentOTPVerification,
      isFinancialRequest,
      isWithdrawalRequest,    // ðŸ†• ÃšNICA que exige OTP
      isRefundRequest,        // ðŸ†• Sem OTP
      isCancellationRequest,  // ðŸ†• Sem OTP
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
    
    console.log('[ai-autopilot-chat] ðŸ” FINANCIAL SECURITY CHECK:', {
      is_financial_request: isFinancialRequest,
      is_withdrawal_request: isWithdrawalRequest,
      is_refund_request: isRefundRequest,
      is_cancellation_request: isCancellationRequest,
      has_recent_otp: hasRecentOTPVerification,
      otp_verified_at: recentVerification?.created_at || null,
      can_show_financial_data: hasRecentOTPVerification && isRealCustomer
    });

    // ðŸ” BARREIRA OTP: APENAS para SAQUE DE SALDO sem verificaÃ§Ã£o OTP recente
    // Reembolsos e cancelamentos NÃƒO ativam barreira OTP
    const financialBarrierActive = isWithdrawalRequest && !hasRecentOTPVerification;

    console.log('[ai-autopilot-chat] ðŸ” FINANCIAL BARRIER CHECK:', {
      financialBarrierActive,
      isWithdrawalRequest,
      isFinancialRequest,
      hasRecentOTPVerification,
      contactHasEmail,
      customerMessage: customerMessage.substring(0, 50)
    });

    // Flag para mostrar dados sensÃ­veis (sÃ³ apÃ³s OTP verificado + permissÃ£o da persona)
    const canShowFinancialData = hasRecentOTPVerification && isRealCustomer && canAccessFinancialData;
    
    // FASE 3 & 4: Identity Wall + DiferenciaÃ§Ã£o Cliente vs Lead
    let identityWallNote = '';
    
    // Detectar se Ã© a primeira mensagem pÃ³s-verificaÃ§Ã£o (FASE 3)
    const isRecentlyVerified = customer_context?.isVerified === true;
    
    // Detectar se Ã© contexto financeiro na mensagem atual
    const isFinancialContext = FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
    
    // ============================================================
    // ðŸŽ¯ TRIAGEM VIA MASTER FLOW
    // A triagem (saudaÃ§Ã£o, menu, coleta de email) Ã© feita 100% pelo 
    // Master Flow visual processado via process-chat-flow
    // CÃ³digo de triagem legada foi REMOVIDO - nÃ£o duplicar aqui!
    // ============================================================
    
    // FASE 1: Criar instruÃ§Ã£o prioritÃ¡ria que vai NO INÃCIO do prompt (se habilitado)
    let priorityInstruction = '';
    
    // âœ… CONTROLE: SÃ³ usar priorityInstruction se persona tiver use_priority_instructions=true
    const usePriorityInstructions = persona.use_priority_instructions === true;
    
    // ============================================================
    // ðŸ” DETECÃ‡ÃƒO AUTOMÃTICA DE CÃ“DIGO OTP (6 dÃ­gitos) - CONTEXTUAL
    // ============================================================
    // CORREÃ‡ÃƒO: SÃ³ valida OTP automaticamente se:
    // 1. Ã‰ um cÃ³digo de 6 dÃ­gitos
    // 2. Cliente tem email cadastrado
    // 3. Existe OTP pendente (awaiting_otp = true) OU OTP foi enviado recentemente
    // 
    // Isso evita tratar cÃ³digos de devoluÃ§Ã£o/rastreio como OTP
    // ============================================================
    // Aceitar OTP com/sem espaÃ§os (ex: "6 5 3 6 6 7").
    // A validaÃ§Ã£o sÃ³ ocorre quando houver contexto de OTP pendente.
    const otpDigitsOnly = customerMessage.replace(/\D/g, '');
    const isOTPCode = otpDigitsOnly.length === 6;
    const conversationMetadata = conversation.customer_metadata || {};
    
    // Verificar se hÃ¡ OTP pendente (flag explÃ­cita)
    const hasAwaitingOTP = conversationMetadata.awaiting_otp === true;
    
    // Verificar se OTP foi enviado recentemente (Ãºltimos 15 minutos)
    const otpExpiresAt = conversationMetadata.otp_expires_at;
    const hasRecentOTPPending = otpExpiresAt && new Date(otpExpiresAt) > new Date();
    
    // Verificar se primeiro contato enviou OTP (via IDENTITY WALL)
    const hasFirstContactOTPPending = !hasEverVerifiedOTP && contactHasEmail;
    
    // SÃ³ validar OTP se houver contexto de OTP pendente
    const shouldValidateOTP = isOTPCode && contactHasEmail && 
      (hasAwaitingOTP || hasRecentOTPPending || hasFirstContactOTPPending);
    
    console.log('[ai-autopilot-chat] ðŸ” OTP Detection Check:', {
      is_6_digit_code: isOTPCode,
      has_awaiting_otp_flag: hasAwaitingOTP,
      has_recent_otp_pending: hasRecentOTPPending,
      has_first_contact_otp: hasFirstContactOTPPending,
      will_validate: shouldValidateOTP,
      code_preview: otpDigitsOnly.substring(0, 3) + '***'
    });

    // Se existe contexto de OTP, mas o usuÃ¡rio enviou dÃ­gitos com tamanho invÃ¡lido,
    // responder determinÃ­stico e NÃƒO seguir para IA/handoff.
    const hasOTPPendingContext = contactHasEmail && (hasAwaitingOTP || hasRecentOTPPending || hasFirstContactOTPPending);
    if (!shouldValidateOTP && hasOTPPendingContext && otpDigitsOnly.length > 0 && otpDigitsOnly.length !== 6) {
      const otpFormatResponse = `**CÃ³digo invÃ¡lido**\n\nO cÃ³digo deve ter **6 dÃ­gitos**.\n\nPor favor, envie apenas os 6 nÃºmeros (pode ser com ou sem espaÃ§os).\n\nDigite **"reenviar"** se precisar de um novo cÃ³digo.`;

      const { data: savedMsg } = await supabaseClient
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: otpFormatResponse,
          sender_type: 'user',
          is_ai_generated: true,
          channel: responseChannel
        })
        .select()
        .single();

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
            otpFormatResponse,
            conversationId,
            contact.whatsapp_id
          );
        }
      }

      return new Response(JSON.stringify({
        response: otpFormatResponse,
        messageId: savedMsg?.id,
        otpValidated: false,
        debug: {
          reason: 'otp_invalid_format_bypass',
          digits_length: otpDigitsOnly.length,
          bypassed_ai: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (shouldValidateOTP) {
      console.log('[ai-autopilot-chat] ðŸ” DECISION POINT: AUTO_OTP_VALIDATION', {
        detected_otp_code: true,
        contact_has_email: contactHasEmail,
        otp_context: hasAwaitingOTP ? 'awaiting_otp_flag' : hasRecentOTPPending ? 'recent_otp_sent' : 'first_contact',
        will_bypass_ai: true
      });
      
      try {
        const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('verify-code', {
          body: { 
            email: contactEmail,
            code: otpDigitsOnly
          }
        });
        
        if (otpError) throw otpError;
        
        // CORREÃ‡ÃƒO: Usar otpData.error ao invÃ©s de otpData.message
        // A funÃ§Ã£o verify-code retorna { success: false, error: "mensagem" }
        const errorMessage = otpData?.error || 'O cÃ³digo nÃ£o Ã© vÃ¡lido. Verifique e tente novamente.';
        
        const directOTPSuccessResponse = otpData?.success 
          ? `**CÃ³digo validado com sucesso!**

OlÃ¡ ${contactName}! Sua identidade foi confirmada. 

Agora posso te ajudar com questÃµes financeiras. Como posso te ajudar?`
          : `**CÃ³digo invÃ¡lido**

${errorMessage}

Digite **"reenviar"** se precisar de um novo cÃ³digo.`;
        
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
          
          console.log('[ai-autopilot-chat] âœ… OTP validado - flags limpas');
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
        
        // Enviar via WhatsApp se necessÃ¡rio (Meta ou Evolution)
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
        
        console.log('[ai-autopilot-chat] âœ… OTP AUTO-VALIDATION COMPLETE:', {
          otp_success: otpData?.success,
          error_reason: otpData?.success ? null : errorMessage,
          response_sent: true
        });
        
        // âš¡ RETURN EARLY - OTP validado, nÃ£o chamar IA
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
        console.error('[ai-autopilot-chat] âŒ Erro ao validar OTP automaticamente:', error);
        // Se falhar, continua para IA tentar lidar
      }
    } else if (isOTPCode && contactHasEmail) {
      // Cliente enviou 6 dÃ­gitos mas nÃ£o hÃ¡ OTP pendente - perguntar se Ã© OTP ou outro cÃ³digo
      console.log('[ai-autopilot-chat] âš ï¸ 6-digit code received but NO OTP pending - will let AI handle naturally');
    }
    
    // ============================================================
    // ðŸ” GUARD CLAUSE: Cliente VERIFICADO (tem email + jÃ¡ fez OTP) â†’ BYPASS Identity Wall
    // Se cliente jÃ¡ tem email E jÃ¡ verificou OTP alguma vez E NÃƒO Ã© pedido financeiro:
    // â†’ Atendimento NORMAL direto, SEM pedir OTP novamente
    // ============================================================
    // ðŸ†• GUARD CLAUSE atualizada: Bypass para atendimento normal SE nÃ£o for SAQUE
    if (contactHasEmail && hasEverVerifiedOTP && !isWithdrawalRequest) {
      console.log('[ai-autopilot-chat] âœ… GUARD CLAUSE: Cliente verificado - BYPASS Identity Wall', {
        contact_email: maskEmail(contactEmail),
        contact_name: contactName,
        has_ever_verified_otp: true,
        is_withdrawal_request: false,
        is_refund_request: isRefundRequest,
        is_cancellation_request: isCancellationRequest,
        action: 'skip_identity_wall_go_to_normal_service'
      });
      
      // NÃƒO faz nada aqui - deixa o cÃ³digo continuar para atendimento normal pela IA
      // Apenas loga e segue para o prÃ³ximo bloco
    }
    
    // ============================================================
    // ðŸ” OTP APENAS PARA SAQUE DE SALDO/CARTEIRA
    // ============================================================
    // Regra simplificada:
    // - Cliente pede SAQUE de saldo â†’ OTP para seguranÃ§a
    // - Cancelamento de assinatura Kiwify â†’ Sem OTP
    // - Reembolso de pedido â†’ Sem OTP (explica processo)
    // - Qualquer outra coisa â†’ Conversa normal (sem OTP)
    // ============================================================
    if (contactHasEmail && isWithdrawalRequest && !hasRecentOTPVerification && !flow_context) {
      // ðŸ†• GUARD: Se existe flow_context (qualquer), PULAR o bloco OTP inteiro.
      // O fluxo visual Ã© soberano e tem seu prÃ³prio ramo financeiro com OTP nativo.
      // Ref: flow-sovereignty-principle
      
      const maskedEmail = maskEmail(contactEmail);
      
      console.log('[ai-autopilot-chat] ðŸ” OTP SAQUE - SolicitaÃ§Ã£o de saque detectada:', {
        is_withdrawal_request: isWithdrawalRequest,
        has_recent_otp: hasRecentOTPVerification,
        contact_email: maskedEmail,
        message_preview: customerMessage.substring(0, 50)
      });
      
      // Enviar OTP para verificaÃ§Ã£o de saque
      try {
        console.log('[ai-autopilot-chat] ðŸ” DECISION POINT: WITHDRAWAL_OTP_BARRIER', {
          is_withdrawal_context: true,
          has_ever_verified: hasEverVerifiedOTP,
          has_recent_otp: false,
          will_send_otp: true,
          current_channel: responseChannel
        });
        
        // Enviar OTP automaticamente
        await supabaseClient.functions.invoke('send-verification-code', {
          body: { email: contactEmail, type: 'customer' }
        });
        
        // ðŸ” MARCAR OTP PENDENTE NA METADATA (para validaÃ§Ã£o contextual)
        const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos
        await supabaseClient
          .from('conversations')
          .update({ 
            customer_metadata: {
              ...conversationMetadata,
              awaiting_otp: true,
              otp_expires_at: otpExpiresAt,
              claimant_email: contactEmail,
              otp_reason: 'withdrawal' // ðŸ†• Marcar motivo do OTP
            }
          })
          .eq('id', conversationId);
        
        console.log('[ai-autopilot-chat] ðŸ” OTP pendente marcado na metadata (withdrawal barrier)');
        
        // BYPASS DIRETO - NÃƒO CHAMAR A IA
        const directOTPResponse = `**Verificação de Segurança para Saque**

Olá ${contactName}! Para saques da carteira, preciso confirmar sua identidade.

Enviei um código de **6 dígitos** para **${maskedEmail}**.

Por favor, **digite o código** que você recebeu para continuar com o saque.`;

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
        
        // Enviar via WhatsApp se necessÃ¡rio (Meta ou Evolution)
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
        
        // âš¡ RETURN EARLY - NÃƒO CONTINUAR PARA A IA
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
        console.error('[ai-autopilot-chat] âŒ Erro ao disparar OTP financeiro:', error);
        // Se falhar, continua para IA tentar lidar
      }
      
    }
    
    // Cliente identificado sem solicitaÃ§Ã£o financeira - atendimento normal (nÃ£o precisa OTP)
    if (contactHasEmail && !isFinancialRequest) {
      console.log('[ai-autopilot-chat] âœ… Cliente identificado - Atendimento normal sem OTP');
    }
    
    // ðŸ†• CORREÃ‡ÃƒO: SÃ³ pedir email se NÃƒO for cliente conhecido pelo telefone
    console.log('[ai-autopilot-chat] ðŸ” Identity Wall gate:', {
      contactHasEmail,
      isPhoneVerified,
      isCustomerInDatabase,
      isKiwifyValidated,
      channel: responseChannel,
      hasFlowContext: !!flow_context,
      willBypass: !!flow_context,
    });
    if (!contactHasEmail && !isPhoneVerified && !isCustomerInDatabase && !isKiwifyValidated && responseChannel === 'whatsapp' && !flow_context) {
      // FASE 4: Lead NOVO (nÃ£o tem email E nÃ£o estÃ¡ no banco por telefone) - seguir Identity Wall
      priorityInstruction = `=== INSTRUÃ‡ÃƒO PRIORITÃRIA - IGNORE TUDO ABAIXO ATÃ‰ SEGUIR ISSO ===

Este contato NÃƒO tem email cadastrado. A PRIMEIRA coisa que vocÃª DEVE falar Ã©:
"OlÃ¡! Para garantir um atendimento personalizado e seguro, preciso que vocÃª me informe seu email."

â†’ PARE AQUI. AGUARDE o cliente fornecer o email.
â†’ NÃƒO responda dÃºvidas tÃ©cnicas atÃ© ter o email
=== FIM DA INSTRUÃ‡ÃƒO PRIORITÃRIA ===

`;
      
      identityWallNote = `\n\n**LEAD NOVO - IdentificaÃ§Ã£o por Email (SEM OTP):**
Este cliente NÃƒO tem email cadastrado no sistema.

**FLUXO DE IDENTIFICAÃ‡ÃƒO:**
1. PRIMEIRA MENSAGEM: Cumprimente "${contactName}" e solicite o email de forma educada e direta:
   "OlÃ¡ ${contactName}! Para garantir um atendimento personalizado, preciso que vocÃª me informe seu email."
   
2. AGUARDE o cliente fornecer o email

3. QUANDO cliente fornecer email: Use a ferramenta verify_customer_email para buscar na base

4. **SE EMAIL NÃƒO ENCONTRADO NA BASE:**
   - Sistema vai perguntar: "NÃ£o encontrei esse email na nossa base de clientes. Poderia confirmar se esse email estÃ¡ correto?"
   - Se cliente responder "SIM", "correto" â†’ Use confirm_email_not_found com confirmed=true (transfere para comercial)
   - Se cliente informar email DIFERENTE â†’ Use verify_customer_email com o novo email
   - Se cliente responder "nÃ£o", "errado" â†’ Use confirm_email_not_found com confirmed=false (pede novo email)

5. **SE EMAIL ENCONTRADO NA BASE:**
   - Cumprimente o cliente pelo nome e pergunte como pode ajudar
   - NÃƒO precisa de OTP para atendimento normal (rastreio, dÃºvidas, etc.)
   - OTP sÃ³ serÃ¡ pedido se cliente solicitar SAQUE DE SALDO

**IMPORTANTE:** NÃƒO atenda dÃºvidas tÃ©cnicas atÃ© o email ser verificado na base.`;
    } else if (isPhoneVerified && !contactHasEmail && !isKiwifyValidated) {
      // ðŸ†• Cliente identificado pelo telefone (sem email) - atendimento normal, sem pedir email
      console.log('[ai-autopilot-chat] âœ… Cliente identificado por telefone - bypass Identity Wall');
    }
    
    // ðŸ” PORTEIRO DE SAQUE ATIVADO (apenas para saque de saldo/carteira)
    if (financialBarrierActive) {
      // Verificar se cliente jÃ¡ foi identificado por email (novo fluxo)
      const hasEmailVerifiedInDb = conversation.customer_metadata?.email_verified_in_db === true;
      const verifiedEmail = conversation.customer_metadata?.verified_email;
      
      if (contactHasEmail || hasEmailVerifiedInDb) {
        const emailToUse = contactEmail || verifiedEmail;
        const maskedEmailForPrompt = emailToUse ? maskEmail(emailToUse) : 'seu email cadastrado';
        
        // CenÃ¡rio: Cliente identificado por email â†’ Precisa OTP para SAQUE
        identityWallNote += `\n\n**=== PORTEIRO DE SAQUE - VERIFICAÃ‡ÃƒO OTP OBRIGATÃ“RIA ===**
O cliente solicitou SAQUE DE SALDO (${customerMessage}).
Email verificado: ${maskedEmailForPrompt}

**RESPOSTA OBRIGATÃ“RIA:**
"Para sua seguranÃ§a, preciso confirmar sua identidade antes de prosseguir com o saque. 
Vou enviar um cÃ³digo de verificaÃ§Ã£o para ${maskedEmailForPrompt}."

â†’ Use a ferramenta send_financial_otp para disparar o OTP
â†’ NÃƒO mostre CPF, Nome, Saldo ou qualquer dado sensÃ­vel
â†’ NÃƒO permita criar ticket de saque
â†’ AGUARDE o cliente digitar o cÃ³digo de 6 dÃ­gitos`;
      } else {
        // CenÃ¡rio: NÃ£o tem email â†’ Pedir email primeiro
        identityWallNote += `\n\n**=== PORTEIRO DE SAQUE - IDENTIFICAÃ‡ÃƒO OBRIGATÃ“RIA ===**
O cliente solicitou SAQUE mas NÃƒO ESTÃ IDENTIFICADO.

**RESPOSTA OBRIGATÃ“RIA:**
"Para sua seguranÃ§a, preciso validar seu cadastro antes de prosseguir com o saque. 
Qual Ã© o seu **email de cadastro**?"

â†’ AGUARDE o cliente informar o email
â†’ NÃƒO fale de valores, prazos ou processos
â†’ NÃƒO crie ticket
â†’ PARE AQUI atÃ© identificaÃ§Ã£o completa`;
      }
    }
    
    // ðŸ†• HANDLER PARA REEMBOLSO (SEM OTP)
    if (isRefundRequest && !isWithdrawalRequest) {
      console.log('[ai-autopilot-chat] ðŸ“¦ Detectado pedido de REEMBOLSO - sem OTP necessÃ¡rio');
      
      identityWallNote += `\n\n**=== REEMBOLSO DE PEDIDO (SEM OTP) ===**
O cliente estÃ¡ perguntando sobre reembolso de um pedido Kiwify.

**EXPLICAÃ‡ÃƒO A DAR:**
- Reembolsos sÃ£o processados automaticamente quando o pedido retorna ao galpÃ£o
- O cliente NÃƒO precisa ficar cobrando, o processo Ã© automÃ¡tico
- Se o cliente INSISTIR que o reembolso nÃ£o foi feito, aÃ­ sim ofereÃ§a transferir para humano

**NÃƒO PEÃ‡A OTP** para esta situaÃ§Ã£o.`;
    }
    
    // ðŸ†• HANDLER PARA CANCELAMENTO (SEM OTP)
    if (isCancellationRequest && !isWithdrawalRequest) {
      console.log('[ai-autopilot-chat] âŒ Detectado pedido de CANCELAMENTO - sem OTP necessÃ¡rio');
      
      identityWallNote += `\n\n**=== CANCELAMENTO DE ASSINATURA (SEM OTP) ===**
O cliente quer cancelar a assinatura Kiwify.

**PROCESSO:**
- Oriente o cliente sobre como cancelar na plataforma Kiwify
- NÃƒO precisa de OTP para cancelamento
- Se precisar de ajuda adicional, ofereÃ§a transferir para humano

**NÃƒO PEÃ‡A OTP** para esta situaÃ§Ã£o.`;
    }
    
    if (!identityWallNote) {
      identityWallNote = `\n\n**IMPORTANTE:** Este Ã© um cliente jÃ¡ verificado. Cumprimente-o pelo nome (${contactName}) de forma calorosa. NÃƒO peÃ§a email ou validaÃ§Ã£o.

${isRecentlyVerified ? '**âš ï¸ CLIENTE RECÃ‰M-VERIFICADO:** Esta Ã© a primeira mensagem pÃ³s-verificaÃ§Ã£o. NÃ£o fazer handoff automÃ¡tico. Seja acolhedor e pergunte "Como posso te ajudar?".' : ''}`;
    }
    
    // ðŸ› DEBUG: Confirmar que priorityInstruction estÃ¡ sendo gerada
    console.log('[ai-autopilot-chat] ðŸ“£ Priority Instruction:', priorityInstruction ? 'SET âœ…' : 'EMPTY âŒ');
    
    // ðŸŽ¯ INSTRUÃ‡ÃƒO ANTI-ALUCINAÃ‡ÃƒO - IA SEMPRE tenta responder, NÃƒO transfere automaticamente
    const antiHallucinationInstruction = `

**ðŸš« REGRA CRÃTICA ANTI-TRANSFERÃŠNCIA AUTOMÃTICA:**
VocÃª NÃƒO PODE transferir para atendente humano automaticamente por "baixa confianÃ§a" ou "nÃ£o ter informaÃ§Ã£o".
SÃ“ transfira se o cliente PEDIR EXPLICITAMENTE com frases como:
- "Quero falar com um atendente"
- "Preciso de um humano"
- "Chama alguÃ©m para me ajudar"
- "Transferir para suporte"

SE vocÃª nÃ£o tiver informaÃ§Ã£o sobre o assunto:
1. TENTE responder com o que vocÃª sabe da base de conhecimento
2. Se nÃ£o tiver NADA, responda: "NÃ£o encontrei essa informaÃ§Ã£o especÃ­fica na minha base. Pode me dar mais detalhes sobre o que precisa?"
3. NUNCA diga "vou te transferir" ou "vou chamar um especialista" sem o cliente pedir
4. SEMPRE pergunte se pode ajudar de outra forma ANTES de sugerir transferÃªncia

**COMPORTAMENTO ESPERADO:**
- Cliente pergunta algo â†’ IA tenta responder com KB
- IA nÃ£o encontra na KB â†’ IA pede mais detalhes ou oferece outras opÃ§Ãµes
- Cliente INSISTE ou PEDE humano â†’ SÃ³ entÃ£o transfere

**PROIBIDO:**
- Transferir automaticamente por score baixo
- Dizer "vou chamar um especialista" sem cliente pedir
- Abandonar cliente sem tentar ajudar
`;

    // ðŸ†• INSTRUÃ‡ÃƒO ANTI-FABRICAÃ‡ÃƒO DE TRANSFERÃŠNCIA + TOKEN [[FLOW_EXIT]] (quando dentro de fluxo)
    const flowAntiTransferInstruction = flow_context ? `

**ðŸš« REGRA ABSOLUTA â€” VOCÃŠ ESTÃ DENTRO DE UM FLUXO AUTOMATIZADO:**
PROIBIDO dizer que vai transferir/direcionar/encaminhar/conectar/passar.
PROIBIDO mencionar atendente/especialista/consultor/menu/departamento/setor.
PROIBIDO criar opÃ§Ãµes numeradas (1ï¸âƒ£ 2ï¸âƒ£).
Se vocÃª conseguir resolver, responda normalmente com informaÃ§Ã£o da base de conhecimento.
Se NÃƒO conseguir resolver, responda SOMENTE: [[FLOW_EXIT]]
Nenhum texto antes ou depois de [[FLOW_EXIT]].
Quem decide transferÃªncias, menus e direcionamentos Ã© o FLUXO, nÃ£o vocÃª.

` : '';

    // ðŸ†• BUSINESS HOURS: Injetar consciÃªncia de horÃ¡rio no prompt
    const businessHoursPrompt = businessHoursInfo ? (
      businessHoursInfo.within_hours
        ? `\n**ðŸ• HORÃRIO COMERCIAL:** Aberto agora atÃ© ${businessHoursInfo.today_close_time}.\n`
        : `\n**ðŸ• HORÃRIO COMERCIAL:** Fora do expediente. PrÃ³xima abertura: ${businessHoursInfo.next_open_text}. HorÃ¡rio: ${businessHoursInfo.schedule_summary}.
REGRA: Tente resolver sozinha. Se nÃ£o conseguir e o cliente pedir humano, use request_human_agent â€” o sistema cuidarÃ¡ do restante (registrarÃ¡ a pendÃªncia para o prÃ³ximo expediente).\n`
    ) : '';

    // ðŸ”’ TRAVA FINANCEIRA: Injetar instruÃ§Ãµes diretamente no prompt da LLM
    const financialGuardInstruction = flowForbidFinancial ? `

ðŸ”’ TRAVA FINANCEIRA ATIVA â€” REGRAS OBRIGATÃ“RIAS:
- Responda perguntas INFORMATIVAS sobre finanÃ§as usando APENAS dados da base de conhecimento.
- Se o cliente pedir uma AÃ‡ÃƒO financeira (saque, reembolso, estorno, devoluÃ§Ã£o), responda: "Entendi sua solicitaÃ§Ã£o. Vou te encaminhar para o setor responsÃ¡vel." e retorne [[FLOW_EXIT:financeiro]].
- NUNCA cite valores monetÃ¡rios, prazos em dias ou percentuais sobre saques/reembolsos A MENOS que existam EXATAMENTE na base de conhecimento.
- Se nÃ£o encontrar a informaÃ§Ã£o na KB, responda: "NÃ£o tenho essa informaÃ§Ã£o no momento. O setor financeiro poderÃ¡ te orientar com detalhes."
- NUNCA invente, deduza ou estime valores financeiros.
${ambiguousFinancialDetected ? `
âš ï¸ DESAMBIGUAÃ‡ÃƒO OBRIGATÃ“RIA: O cliente mencionou um termo financeiro sem deixar claro se quer informaÃ§Ã£o ou realizar uma aÃ§Ã£o.
VocÃª DEVE perguntar de forma natural e empÃ¡tica: "Posso te ajudar com informaÃ§Ãµes sobre [tema] ou vocÃª gostaria de fazer uma solicitaÃ§Ã£o?"
Nunca assuma a intenÃ§Ã£o do cliente. Essa pergunta Ã© OBRIGATÃ“RIA antes de qualquer resposta.
Se o cliente confirmar que quer SOLICITAR/FAZER a aÃ§Ã£o (ex: "quero sacar", "sim, quero solicitar") â†’ responda com [[FLOW_EXIT:financeiro]]
Se for apenas dÃºvida â†’ responda normalmente usando a Base de Conhecimento.
` : ''}
` : '';

    // ðŸš« TRAVA CANCELAMENTO: Injetar instruÃ§Ãµes diretamente no prompt da LLM
    const cancellationGuardInstruction = flowForbidCancellation ? `

ðŸš« TRAVA CANCELAMENTO ATIVA â€” REGRAS OBRIGATÃ“RIAS:
- Responda perguntas INFORMATIVAS sobre cancelamento usando APENAS dados da base de conhecimento.
- Se o cliente pedir uma AÃ‡ÃƒO de cancelamento (cancelar plano, encerrar conta, desistir), responda: "Entendi sua solicitaÃ§Ã£o de cancelamento. Vou te encaminhar para o setor responsÃ¡vel." e retorne [[FLOW_EXIT:cancelamento]].
- Se nÃ£o encontrar a informaÃ§Ã£o na KB, responda: "NÃ£o tenho essa informaÃ§Ã£o no momento. O setor responsÃ¡vel poderÃ¡ te orientar."
${ambiguousCancellationDetected ? `
âš ï¸ DESAMBIGUAÃ‡ÃƒO OBRIGATÃ“RIA: O cliente mencionou um termo de cancelamento sem deixar claro se quer informaÃ§Ã£o ou realizar a aÃ§Ã£o.
VocÃª DEVE perguntar de forma natural e empÃ¡tica: "VocÃª tem dÃºvidas sobre cancelamento ou deseja cancelar um produto/serviÃ§o?"
Nunca assuma a intenÃ§Ã£o do cliente. Essa pergunta Ã© OBRIGATÃ“RIA antes de qualquer resposta.
Se o cliente confirmar que quer CANCELAR â†’ responda com [[FLOW_EXIT:cancelamento]]
Se for apenas dÃºvida â†’ responda normalmente usando a Base de Conhecimento.
` : ''}
` : '';

    // ðŸ›’ TRAVA COMERCIAL: Injetar instruÃ§Ãµes diretamente no prompt da LLM
    const commercialGuardInstruction = flowForbidCommercialPrompt ? `

ðŸ›’ TRAVA COMERCIAL ATIVA â€” REGRAS OBRIGATÃ“RIAS:
- Se o cliente quiser COMPRAR, ASSINAR, ver PREÃ‡OS ou fazer UPGRADE, responda: "Ã“timo! Vou te conectar com nosso time comercial para te ajudar com isso." e retorne [[FLOW_EXIT:comercial]].
- Responda perguntas INFORMATIVAS sobre produtos/serviÃ§os usando a base de conhecimento.
${ambiguousCommercialDetected ? `
âš ï¸ DESAMBIGUAÃ‡ÃƒO OBRIGATÃ“RIA: O cliente mencionou um termo comercial sem deixar claro se quer informaÃ§Ã£o ou realizar uma compra/assinatura.
VocÃª DEVE perguntar de forma natural e empÃ¡tica: "VocÃª gostaria de saber mais informaÃ§Ãµes sobre [tema] ou deseja falar com nosso time comercial?"
Nunca assuma a intenÃ§Ã£o do cliente. Essa pergunta Ã© OBRIGATÃ“RIA antes de qualquer resposta.
Se o cliente confirmar que quer COMPRAR/ASSINAR/VER PREÃ‡OS â†’ responda com [[FLOW_EXIT:comercial]]
Se for apenas dÃºvida â†’ responda normalmente usando a Base de Conhecimento.
` : ''}
` : '';

    // ðŸ’¼ TRAVA CONSULTOR: Injetar instruÃ§Ãµes diretamente no prompt da LLM
    const consultorGuardInstruction = flowForbidConsultantPrompt ? `

ðŸ’¼ TRAVA CONSULTOR ATIVA â€” REGRAS OBRIGATÃ“RIAS:
- Se o cliente pedir para FALAR COM SEU CONSULTOR/ASSESSOR/GERENTE, responda: "Entendi! Vou te conectar com seu consultor." e retorne [[FLOW_EXIT:consultor]].
- Responda perguntas gerais normalmente usando a base de conhecimento.
${ambiguousConsultorDetected ? `
âš ï¸ DESAMBIGUAÃ‡ÃƒO OBRIGATÃ“RIA: O cliente mencionou um termo relacionado a consultor sem deixar claro se quer falar com ele ou tem uma dÃºvida geral.
VocÃª DEVE perguntar de forma natural e empÃ¡tica: "VocÃª gostaria de falar diretamente com seu consultor ou posso te ajudar com sua dÃºvida?"
Nunca assuma a intenÃ§Ã£o do cliente. Essa pergunta Ã© OBRIGATÃ“RIA antes de qualquer resposta.
Se o cliente confirmar que quer FALAR COM O CONSULTOR â†’ responda com [[FLOW_EXIT:consultor]]
Se for apenas dÃºvida â†’ responda normalmente usando a Base de Conhecimento.
` : ''}
` : '';

    // FIX 2: Injetar agent_context (intent da triagem + contexto acumulado) no system prompt
    const agentContextBlock = flowContextPrompt
      ? `\n\n**CONTEXTO DO AGENTE (triagem anterior):**\n${flowContextPrompt}\n`
      : '';

    const contextualizedSystemPrompt = `${agentContextBlock}${priorityInstruction}${flowAntiTransferInstruction}${antiHallucinationInstruction}${businessHoursPrompt}${financialGuardInstruction}${cancellationGuardInstruction}${commercialGuardInstruction}${consultorGuardInstruction}

**🚫 REGRA DE HANDOFF (SÓ QUANDO CLIENTE PEDIR):**
Transferência para humano SÓ acontece quando:
- Cliente pedir EXPLICITAMENTE: "quero falar com humano", "atendente", "transferir"
- E cliente estiver IDENTIFICADO (tem email verificado)

SE cliente pedir atendente mas NÃO está identificado:
→ Responda: "Claro! Para conectar você com um atendente, preciso primeiro confirmar sua identidade. Qual é o seu email de cadastro?"
→ AGUARDE o email
→ Use verify_customer_email para validar
→ SÓ ENTÃO pode usar request_human_agent

**⚠️ ANTI-ALUCINAÇÃO - MAS NÃO TRANSFERIR:**
Se você NÃO encontrar informação na BASE DE CONHECIMENTO:
1. NÃO INVENTE informações
2. NÃO transfira automaticamente
3. Responda: "Não encontrei informação sobre isso na minha base. Pode me dar mais detalhes ou perguntar de outra forma?"
4. SÓ ofereça transferência se cliente pedir ou insistir muito

É MELHOR admitir que não sabe e perguntar mais do que TRANSFERIR sem necessidade.

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

**CENÃRIO B: SAQUE DE SALDO (Carteira Interna - Seu ArmazÃ©m Drop)**

${canShowFinancialData 
  ? `Cliente VERIFICADO via OTP - Pode prosseguir com saque
     CPF cadastrado: ${maskedCPF}
     
     ATENÃ‡ÃƒO: Use EXATAMENTE o CPF fornecido acima: "${maskedCPF}"
     NUNCA escreva "NÃ£o cadastrado" se o CPF foi fornecido.`
  : !canAccessFinancialData
    ? `BLOQUEIO: Esta IA NÃƒO tem permissÃ£o para acessar dados financeiros.
       â†’ Transfira para um agente humano imediatamente com: request_human_agent
       â†’ Motivo: "SolicitaÃ§Ã£o de dados financeiros requer assistÃªncia humana"`
    : `BLOQUEIO: Cliente NÃƒO verificou identidade via OTP nesta sessÃ£o.
       â†’ NÃƒO mostre CPF ou Nome completo
       â†’ NÃƒO permita criar ticket de saque
       â†’ Informe: "Para sua seguranÃ§a, preciso verificar sua identidade primeiro. Qual seu email de compra?"`}

**SE CLIENTE VERIFICADO via OTP, seguir passos:**

    1. **CONFIRMAÃ‡ÃƒO OBRIGATÃ“RIA DE DADOS:**
   Apresente os dados do cliente e peÃ§a confirmaÃ§Ã£o:
   
   "Vou confirmar seus dados para o saque:
   
   **Nome:** ${canAccessCustomerData ? contactName : '[Dados Protegidos]'}
   **CPF:** ${maskedCPF}
   
   **Regra de SeguranÃ§a:** O saque sÃ³ pode ser feito via PIX para uma chave vinculada a este CPF cadastrado. NÃ£o Ã© possÃ­vel enviar para conta de terceiros.
   
   Os dados estÃ£o corretos?"

2. **SE CLIENTE CONFIRMAR (SIM):**
   - Pergunte sobre a chave PIX de forma inteligente (sem pedir dados jÃ¡ confirmados):
   
   "Perfeito! Posso fazer o PIX diretamente para seu CPF (${maskedCPF}) como chave?
   
   Ou, se preferir, envie outra chave PIX (email, telefone ou chave aleatÃ³ria) - lembrando que precisa estar vinculada a este mesmo CPF.
   
   Qual opÃ§Ã£o prefere?"

   - SE cliente aceitar usar o CPF como chave (ex: "sim", "pode usar CPF", "usa o CPF", "pode ser"):
     - Chave PIX = CPF do cliente (use o CPF completo do cadastro, nÃ£o o mascarado)
     - Tipo = "cpf"
     - Pergunte APENAS: "Certo! Qual valor vocÃª deseja sacar?"
   
   - SE cliente enviar outra chave (email, telefone, chave aleatÃ³ria):
     - Identifique o tipo automaticamente
     - Confirme: "Vou usar a chave [CHAVE]. Qual valor vocÃª deseja sacar?"
   
   - APÃ“S receber o VALOR, execute create_ticket com:
     - issue_type: "saque"
     - subject: "SolicitaÃ§Ã£o de Saque - R$ [VALOR]"
     - description: "Cliente ${contactName} solicita saque de R$ [VALOR]. Tipo PIX: [TIPO]. Chave PIX: [CHAVE]. CPF: ${maskedCPF}"
     - pix_key: [CHAVE - seja CPF ou outra informada]
     - pix_key_type: [TIPO - cpf/email/telefone/chave_aleatoria]
     - withdrawal_amount: [VALOR]
     - customer_confirmation: true
     - ticket_type: "saque_carteira"
   - Responda: "SolicitaÃ§Ã£o de saque registrada! Protocolo: #[ID]. O financeiro vai processar o PIX em atÃ© 7 dias Ãºteis."

3. **SE CLIENTE DISSER NÃƒO (dados incorretos):**
   - Execute a tool request_human_agent com:
     - reason: "dados_financeiros_incorretos"
     - internal_note: "Cliente informou que dados cadastrais (Nome/CPF) estÃ£o incorretos durante solicitaÃ§Ã£o de saque. Requer correÃ§Ã£o manual."
   - A ferramenta vai responder automaticamente e transferir para um atendente.

---

**CENÃRIO C: REEMBOLSO/DEVOLUÃ‡ÃƒO (Produto Errado, Defeito, Troca)**

Quando cliente mencionar "envio errado", "produto errado", "veio diferente", "veio outra cor", "veio errado", "defeito", "quebrado", "danificado", "trocar", "quero trocar", "quero devolver":

**PASSO 1: PERGUNTAR TIPO DE RESOLUÃ‡ÃƒO PRIMEIRO**
"Entendi que houve um problema com seu pedido. VocÃª prefere:

**A)** Reembolso do valor pago?
**B)** Reenvio do produto correto?
**C)** Troca por outro item?"

â†’ AGUARDE resposta antes de prosseguir

**PASSO 2: COLETAR DADOS DO PROBLEMA**
ApÃ³s cliente escolher A, B ou C:

"Para resolver, preciso de algumas informaÃ§Ãµes:

1ï¸âƒ£ **NÃºmero do pedido:** (ex: #12345 ou cÃ³digo de rastreio)
2ï¸âƒ£ **Qual produto veio errado/com defeito?** (nome ou descriÃ§Ã£o)
3ï¸âƒ£ **O que vocÃª esperava receber?** (ou qual era o correto)"

â†’ AGUARDE respostas antes de prosseguir

**PASSO 3: SOLICITAR EVIDÃŠNCIAS**
"Para agilizar a anÃ¡lise da equipe, vocÃª consegue enviar uma foto do produto que recebeu? ðŸ“·

Isso ajuda muito a resolver mais rÃ¡pido!"

â†’ AGUARDE cliente enviar foto OU dizer que nÃ£o consegue

**PASSO 4: CRIAR TICKET COM DADOS COMPLETOS**
SOMENTE apÃ³s coletar TODOS os dados acima (tipo de resoluÃ§Ã£o, nÃºmero pedido, problema, produto esperado), execute create_ticket com:
- issue_type: "reembolso" ou "troca" ou "devolucao" (conforme opÃ§Ã£o escolhida)
- subject: "[Tipo] Pedido #[NÃšMERO] - [Resumo do problema]"
- description: Incluir TODOS os dados coletados:
  â€¢ NÃºmero do pedido
  â€¢ Produto recebido (errado/com defeito)
  â€¢ Produto esperado (correto)
  â€¢ ResoluÃ§Ã£o desejada (reembolso/troca/reenvio)
  â€¢ Se foto foi enviada (sim/nÃ£o)
- order_id: [NÃšMERO DO PEDIDO se fornecido]

**EXEMPLO DE TICKET BEM PREENCHIDO:**
subject: "Reembolso Pedido #12345 - Cor Errada"
description: "Cliente Maria recebeu camiseta preta quando pediu branca.
Pedido: #12345
Produto recebido: Camiseta preta M
Produto esperado: Camiseta branca M  
Foto enviada: Sim
ResoluÃ§Ã£o desejada: Reembolso integral"

**REGRAS DO CENÃRIO C:**
- NUNCA crie ticket sem saber tipo de resoluÃ§Ã£o (A, B ou C)
- NUNCA crie ticket sem nÃºmero do pedido (se cliente nÃ£o souber, pergunte: "Qual email usou na compra? Vou buscar para vocÃª.")
- NUNCA crie ticket sem saber o que veio errado vs o que era esperado
- SEMPRE peÃ§a foto para evidÃªncia (mas prossiga se cliente nÃ£o puder enviar)
- Se cliente mencionar "envio errado" mas jÃ¡ escolheu resoluÃ§Ã£o, pule direto para PASSO 2

---

**REGRAS CRÃTICAS GERAIS:**
- NUNCA crie ticket para cancelamento Kiwify (Ã© self-service)
- NUNCA fale de valores com cliente nÃ£o identificado
- NUNCA pule a confirmaÃ§Ã£o de dados
- SEMPRE pergunte qual tipo (A, B ou C) antes de prosseguir em saques e reembolsos
- SEMPRE mostre os dados e peÃ§a confirmaÃ§Ã£o para saque
- SEMPRE envie o link da Kiwify para cancelamentos
- SEMPRE colete dados completos antes de criar ticket de reembolso/devoluÃ§Ã£o

---

**VocÃª tem acesso Ã s seguintes ferramentas:**
- create_ticket: Use APENAS quando cliente pedir explicitamente ajuda humana OU problema financeiro concreto OU vocÃª nÃ£o conseguir responder apÃ³s tentar. Para SAQUE, use SOMENTE apÃ³s OTP validado e dados confirmados.
- verify_customer_email: Use quando cliente FORNECER email para identificaÃ§Ã£o. Verifica se existe na base. Se existir, cliente Ã© identificado SEM OTP. OTP sÃ³ Ã© necessÃ¡rio para operaÃ§Ãµes financeiras.
- send_financial_otp: Use quando cliente JÃ IDENTIFICADO por email solicitar operaÃ§Ã£o FINANCEIRA (saque, reembolso). Envia OTP para confirmar identidade antes de prosseguir.
- resend_otp: Use quando cliente disser "nÃ£o recebi email" ou pedir reenvio. Reenvia cÃ³digo para email JÃ cadastrado.
- verify_otp_code: Valide cÃ³digos OTP de 6 dÃ­gitos
- request_human_agent: Transfira para atendente humano quando: 1) Cliente disser que dados estÃ£o INCORRETOS, 2) Cliente pedir explicitamente atendente humano, 3) SituaÃ§Ã£o muito complexa que vocÃª nÃ£o consegue resolver.
- check_tracking: Consulta rastreio de pedidos. Use quando cliente perguntar sobre entrega ou status de envio.
- close_conversation: Encerre SOMENTE quando o cliente indicar CLARAMENTE que nÃ£o tem mais dÃºvidas (ex: "era sÃ³ isso", "nÃ£o tenho mais dÃºvidas", "Ã© isso", "pode encerrar"). NÃƒO interprete agradecimentos ("obrigado", "valeu", "muito obrigado") como sinal de encerramento â€” agradecer Ã© educaÃ§Ã£o, nÃ£o significa que acabou. SEMPRE pergunte antes (customer_confirmed=false). SÃ³ use customer_confirmed=true apÃ³s cliente confirmar "sim". Se cliente disser "nÃ£o" ou tiver mais dÃºvidas, continue normalmente.
- classify_and_resolve_ticket: ApÃ³s encerrar conversa (close_conversation confirmado), classifique e registre a resoluÃ§Ã£o. Use a categoria mais adequada do enum. Escreva summary curto e resolution_notes objetivo.

${knowledgeContext}${sandboxTrainingContext}${identityWallNote}

**Contexto do Cliente:**
- Nome: ${contactName}${contactCompany}
- Status: ${contactStatus}
- Canal: ${responseChannel}
${contactEmail ? `- Email: ${safeEmail}` : (flow_context ? '- Email: NÃ£o identificado (a IA pode ajudar sem email)' : '- Email: NÃƒO CADASTRADO - SOLICITAR')}
${contact.phone ? `- Telefone: ${safePhone}` : ''}
- CPF: ${maskedCPF}
${contactOrgName ? `- OrganizaÃ§Ã£o: ${contactOrgName}` : ''}
${contactConsultantName ? `- Consultor responsÃ¡vel: ${contactConsultantName}` : ''}
${contactSellerName ? `- Vendedor responsÃ¡vel: ${contactSellerName}` : ''}
${contactTagsList.length > 0 ? `- Tags: ${contactTagsList.join(', ')}` : ''}
${customerProducts.length > 0 ? `- Produtos/ServiÃ§os contratados: ${customerProducts.join(', ')}` : '- Produtos/ServiÃ§os contratados: Nenhum identificado'}

Os "Produtos/ServiÃ§os contratados" sÃ£o produtos DIGITAIS (cursos online, mentorias, assinaturas, comunidades) que o cliente COMPROU na plataforma. Use essa informaÃ§Ã£o para personalizar o atendimento e contextualizar respostas sobre acesso, conteÃºdo e suporte dos produtos especÃ­ficos do cliente. NÃ£o confunda com produtos fÃ­sicos.
${crossSessionContext}${personaToneInstruction}

Seja inteligente. Converse. O ticket Ã© o ÃšLTIMO recurso.`;

    // 6. Gerar resposta final
    const aiPayload: any = {
      messages: [
        { role: 'system', content: contextualizedSystemPrompt },
        ...fewShotMessages,  // âœ¨ Injetar exemplos de treinamento (Few-Shot Learning)
        ...messageHistory.slice(-6), // 🔧 TOKEN OPT: limitar a últimas 6 msgs (3 turnos)
        { role: 'user', content: customerMessage }
      ],
      temperature: persona.temperature ?? 0.7,  // CORRIGIDO: ?? ao invÃ©s de || (temperatura 0 Ã© vÃ¡lida)
      max_tokens: persona.max_tokens ?? 500    // CORRIGIDO: ?? ao invÃ©s de || (consistÃªncia)
    };

    console.log('[ai-autopilot-chat] Messages structure:', {
      system: 1,
      fewShot: fewShotMessages.length,
      history: messageHistory.length,
      current: 1,
      total: aiPayload.messages.length
    });

    // Add built-in tools + persona tools (FILTRADO por data_access)
    // ðŸ” Ferramentas CORE (sempre disponÃ­veis)
    const coreTools = [
      {
        type: 'function',
        function: {
          name: 'create_ticket',
          description: 'Cria um ticket de suporte. USE APENAS quando: (1) Cliente PEDIR explicitamente ajuda humana, (2) Problema financeiro CONCRETO com intenÃ§Ã£o de aÃ§Ã£o (reembolso, saque real), (3) VocÃª NÃƒO conseguir responder APÃ“S tentar. Para SAQUE: use SOMENTE apÃ³s seguir o FLUXO ESPECIAL no system prompt (informar regras, confirmar dados, obter confirmaÃ§Ã£o). NÃƒO use para dÃºvidas informativas.',
          parameters: {
            type: 'object',
            properties: {
              issue_type: { 
                type: 'string', 
                enum: ['financeiro', 'devolucao', 'reembolso', 'troca', 'defeito', 'saque', 'outro'],
                description: 'O tipo de solicitaÃ§Ã£o. Use "saque" APENAS apÃ³s coletar todos os dados no FLUXO ESPECIAL. Use "financeiro" para outras questÃµes de pagamento/pix/comissÃ£o.' 
              },
              subject: { 
                type: 'string', 
                description: 'Resumo breve da solicitaÃ§Ã£o (mÃ¡ximo 100 caracteres).' 
              },
              description: { 
                type: 'string', 
                description: 'DescriÃ§Ã£o detalhada do problema ou solicitaÃ§Ã£o.' 
              },
              order_id: { 
                type: 'string', 
                description: 'O nÃºmero do pedido, se aplicÃ¡vel. Deixe vazio se nÃ£o houver pedido.' 
              },
              withdrawal_amount: {
                type: 'number',
                description: '[APENAS PARA SAQUE] Valor numÃ©rico solicitado pelo cliente apÃ³s confirmaÃ§Ã£o.'
              },
              confirmed_cpf_last4: {
                type: 'string',
                description: '[APENAS PARA SAQUE] Ãšltimos 4 dÃ­gitos do CPF confirmados pelo cliente.'
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
          description: 'APENAS use quando cliente FORNECER email novo pela PRIMEIRA VEZ. Verifica se email existe na base e envia OTP. âš ï¸ NÃƒO use se cliente reclamar "nÃ£o recebi email" - nesse caso use resend_otp.',
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
          description: 'Verifica o cÃ³digo de 6 dÃ­gitos enviado por email ao cliente.',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'O cÃ³digo de 6 dÃ­gitos fornecido pelo cliente.' }
            },
            required: ['code']
          }
        }
      },
      // FASE 2: Resend OTP Tool - Reenvia cÃ³digo para email JÃ CADASTRADO
      {
        type: 'function',
        function: {
          name: 'resend_otp',
          description: 'Reenvia cÃ³digo OTP para o email JÃ CADASTRADO do cliente. Use quando cliente disser "nÃ£o recebi email", "nÃ£o chegou cÃ³digo", "reenviar cÃ³digo". NÃƒO pede email novamente.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      // TOOL: Confirmar email nÃ£o encontrado na base
      {
        type: 'function',
        function: {
          name: 'confirm_email_not_found',
          description: 'Usar quando o email nÃ£o foi encontrado na base e o cliente CONFIRMA que o email estÃ¡ correto (responde "sim", "correto", "estÃ¡ certo"). Se cliente disser que email estÃ¡ ERRADO ou enviar outro email, NÃƒO use esta tool - use verify_customer_email com o novo email.',
          parameters: {
            type: 'object',
            properties: {
              confirmed: { 
                type: 'boolean', 
                description: 'true se cliente confirmou que o email estÃ¡ correto, false se cliente disse que digitou errado' 
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
          description: 'Transfere a conversa para um atendente humano. âš ï¸ PRÃ‰-REQUISITO OBRIGATÃ“RIO: Cliente DEVE estar identificado por email (email_verified_in_db=true) OU ter email cadastrado no contato. NÃƒO use esta ferramenta se cliente ainda nÃ£o forneceu email - nesse caso, PEÃ‡A O EMAIL PRIMEIRO usando verify_customer_email. Use apenas quando: 1) Cliente JÃ IDENTIFICADO pedir explicitamente atendimento humano, 2) Dados estiverem incorretos APÃ“S identificaÃ§Ã£o por email, 3) Caso complexo APÃ“S identificaÃ§Ã£o.',
          parameters: {
            type: 'object',
            properties: {
              reason: { 
                type: 'string', 
                description: 'Motivo da transferÃªncia (ex: "dados_incorretos", "solicitacao_cliente", "caso_complexo", "dados_financeiros_incorretos")' 
              },
              internal_note: { 
                type: 'string', 
                description: 'Nota interna explicando o contexto da transferÃªncia para o atendente' 
              }
            },
            required: ['reason']
          }
        }
      },
      // ðŸ†• Tool: close_conversation - Encerramento autÃ´nomo com confirmaÃ§Ã£o do cliente
      {
        type: 'function',
        function: {
          name: 'close_conversation',
          description: 'Encerra a conversa. Use em 2 etapas: (1) Pergunte ao cliente se pode encerrar (customer_confirmed=false), (2) ApÃ³s cliente confirmar "sim", execute com customer_confirmed=true. NUNCA encerre sem confirmaÃ§Ã£o explÃ­cita.',
          parameters: {
            type: 'object',
            properties: {
              reason: { type: 'string', description: 'Motivo do encerramento (ex: "assunto_resolvido", "duvida_esclarecida")' },
              customer_confirmed: { type: 'boolean', description: 'true SOMENTE apÃ³s cliente confirmar explicitamente que pode encerrar' }
            },
            required: ['reason', 'customer_confirmed']
          }
        }
      },
      // ðŸ†• Tool: classify_and_resolve_ticket - ClassificaÃ§Ã£o e registro de resoluÃ§Ã£o pÃ³s-encerramento
      {
        type: 'function',
        function: {
          name: 'classify_and_resolve_ticket',
          description: 'Classifica e registra resoluÃ§Ã£o apÃ³s encerramento confirmado. Use APÃ“S close_conversation com customer_confirmed=true. Cria ticket resolvido ou atualiza existente.',
          parameters: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['financeiro','tecnico','bug','outro','devolucao','reclamacao','saque'], description: 'Categoria do atendimento' },
              summary: { type: 'string', description: 'Resumo curto da resoluÃ§Ã£o (mÃ¡x 200 chars)' },
              resolution_notes: { type: 'string', description: 'Detalhes de como foi resolvido' },
              severity: { type: 'string', enum: ['low','medium','high'], description: 'Gravidade do problema' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags descritivas' }
            },
            required: ['category', 'summary', 'resolution_notes']
          }
        }
      }
    ];
    
    // ðŸ” Ferramentas CONDICIONAIS (baseadas em data_access)
    const conditionalTools: any[] = [];
    
    // check_tracking - sÃ³ se tiver permissÃ£o de rastreio ou histÃ³rico de pedidos
    if (canAccessTracking) {
      conditionalTools.push({
        type: 'function',
        function: {
          name: 'check_tracking',
          description: 'Consulta status de rastreio de pedidos no sistema de romaneio. Use quando cliente perguntar sobre entrega, rastreio ou status, ou quando enviar um nÃºmero de pedido/cÃ³digo de rastreio. IMPORTANTE: Se cliente enviar mÃºltiplos cÃ³digos, extraia TODOS em um array. NÃºmeros como "16315521" tambÃ©m podem ser cÃ³digos de pedido - consulte mesmo assim.',
          parameters: {
            type: 'object',
            properties: {
              tracking_codes: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Lista de cÃ³digos de rastreio ou nÃºmeros de pedido (ex: ["BR123456789BR", "MS-12345", "16315521"]). Aceita um ou vÃ¡rios cÃ³digos.'
              },
              customer_email: { 
                type: 'string', 
                description: 'Email do cliente para buscar pedidos com rastreio cadastrado.' 
              }
            },
            required: []
          }
        }
      });
      console.log('[ai-autopilot-chat] âœ… check_tracking HABILITADO (tracking_data ou order_history)');
    } else {
      console.log('[ai-autopilot-chat] âŒ check_tracking DESABILITADO (sem permissÃ£o de rastreio)');
    }
    
    // send_financial_otp - sÃ³ se tiver permissÃ£o financeira
    if (canAccessFinancialData) {
      conditionalTools.push({
        type: 'function',
        function: {
          name: 'send_financial_otp',
          description: 'Envia cÃ³digo OTP para email JÃ VERIFICADO quando cliente solicita operaÃ§Ã£o FINANCEIRA (saque, reembolso, etc). Use apenas apÃ³s cliente jÃ¡ ter sido identificado por email na base. NÃƒO use para identificaÃ§Ã£o inicial - para isso use verify_customer_email.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      });
      console.log('[ai-autopilot-chat] âœ… send_financial_otp HABILITADO (financial_data)');
    } else {
      console.log('[ai-autopilot-chat] âŒ send_financial_otp DESABILITADO (sem permissÃ£o financeira)');
    }
    
    const allTools = [
      ...coreTools,
      ...conditionalTools,
      ...enabledTools.map((tool: any) => ({
        type: 'function',
        function: tool.function_schema
      }))
    ];
    
    console.log('[ai-autopilot-chat] ðŸ› ï¸ Total de ferramentas disponÃ­veis:', allTools.length, '| Core:', coreTools.length, '| Condicionais:', conditionalTools.length, '| Custom:', enabledTools.length);

    if (allTools.length > 0) {
      aiPayload.tools = allTools;
    }

    const aiData = await callAIWithFallback(aiPayload);
    // âœ… FIX 2: Fallback nÃ£o usa 'Desculpe' que estÃ¡ na lista de frases proibidas (auto-loop).
    let rawAIContent = aiData.choices?.[0]?.message?.content;
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls || [];

    // ðŸ†• FIX B: RETRY â€” Se IA retornou vazio sem tool_calls, tentar com prompt reduzido
    if (!rawAIContent && !toolCalls.length) {
      console.warn('[ai-autopilot-chat] âš ï¸ IA retornou vazio â€” tentando retry com prompt reduzido');
      try {
        const retryMessages = [
          { role: 'system' as const, content: contextualizedSystemPrompt.substring(0, 4000) },
          ...aiPayload.messages.slice(-5),
          { role: 'user' as const, content: customerMessage }
        ];
        const retryPayload: any = {
          model: selectedModel,
          messages: retryMessages,
          temperature: 0.7,
          max_tokens: 300,
        };
        const retryData = await callAIWithFallback(retryPayload);
        rawAIContent = retryData.choices?.[0]?.message?.content;
        if (rawAIContent) {
          console.log('[ai-autopilot-chat] âœ… Retry bem-sucedido â€” resposta recuperada');
        } else {
          console.error('[ai-autopilot-chat] âŒ Retry tambÃ©m retornou vazio');
        }
      } catch (retryErr) {
        console.error('[ai-autopilot-chat] âŒ Retry falhou:', retryErr);
      }
    }

    // ðŸ†• FIX C: Se AINDA vazio + intent financeiro + flow_context â†’ FLOW_EXIT:financeiro
    if (!rawAIContent && !toolCalls.length && flow_context) {
      const financialTerms = /\b(saque|sacar|reembolso|estorno|devolução|dinheiro|pix|saldo|transferir|transferência|retirar|retirada)\b/i;
      const cancellationTerms = /\b(cancelar|cancelamento|cancela|desistir|desistência)\b/i;
      const commercialTerms = /\b(comprar|contratar|assinar|upgrade|plano|preço|valor)\b/i;

      let autoExitIntent: string | null = null;
      if (financialTerms.test(customerMessage) && flowForbidFinancial) {
        autoExitIntent = 'financeiro';
      } else if (cancellationTerms.test(customerMessage) && flowForbidCancellation) {
        autoExitIntent = 'cancelamento';
      } else if (commercialTerms.test(customerMessage) && flowForbidCommercialPrompt) {
        autoExitIntent = 'comercial';
      }

      if (autoExitIntent) {
        console.log(`[ai-autopilot-chat] ðŸŽ¯ Fallback vazio + intent ${autoExitIntent} â†’ FLOW_EXIT:${autoExitIntent}`);
        return new Response(JSON.stringify({
          flowExit: true,
          reason: `ai_empty_response_${autoExitIntent}_intent`,
          ai_exit_intent: autoExitIntent,
          hasFlowContext: true,
          flow_context: { flow_id: flow_context.flow_id, node_id: flow_context.node_id }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!rawAIContent && !toolCalls.length) {
      console.error('[ai-autopilot-chat] âŒ AI returned empty content after all retries, no tool calls');
    }

    // 🔧 FIX 3: Guard de resposta vazia — normalizar antes de usar
    const rawAIContentNormalized = (rawAIContent || '').trim();
    if (rawAIContentNormalized.length === 0 && rawAIContent) {
      console.warn('[ai-autopilot-chat] ⚠️ FIX 3: AI retornou apenas whitespace, tratando como vazio');
    }

    let assistantMessage: string;
    if (rawAIContentNormalized) {
      assistantMessage = rawAIContentNormalized;
    } else if (isWithdrawalRequest) {
      assistantMessage = 'Para solicitar o saque, preciso primeiro confirmar sua identidade. Qual é o seu e-mail de cadastro?';
    } else if (isFinancialRequest) {
      assistantMessage = 'Entendi sua solicitação financeira. Para prosseguir com segurança, qual é o seu e-mail de cadastro?';
    } else {
      assistantMessage = 'Pode repetir sua mensagem? Não consegui processar corretamente.';
    }
    const isEmptyAIResponse = !rawAIContent;

    // Prefixo cauteloso removido - vazava metadados internos para o cliente


    // ============================================================
    // FASE 3: TOOL CALLING - Execute first to prevent duplicates
    // ============================================================
    // Handle tool calls (Function Calling)
    let ticketCreatedSuccessfully = false; // ðŸ”’ Flag: true apenas se ticket foi criado COM SUCESSO
    
    if (toolCalls.length > 0) {
      console.log('[ai-autopilot-chat] ðŸ› ï¸ AI solicitou execuÃ§Ã£o de ferramenta:', toolCalls);
      
      for (const toolCall of toolCalls) {
        // FASE 2: Handle email verification and send OTP
        if (toolCall.function.name === 'verify_customer_email' || toolCall.function.name === 'update_customer_email') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            const emailInformado = args.email.toLowerCase().trim();
            console.log('[ai-autopilot-chat] ðŸ“§ Verificando email na base:', emailInformado);

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

            // CENÃRIO A: EMAIL NÃƒO ENCONTRADO - PERGUNTAR SE ESTÃ CORRETO ANTES DE TRANSFERIR
            if (searchError || !existingCustomer) {
              console.log('[ai-autopilot-chat] âŒ FASE 2: Email nÃ£o encontrado - Perguntando confirmaÃ§Ã£o');
              
              // Salvar email pendente para confirmaÃ§Ã£o na metadata da conversa
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
              
              console.log('[ai-autopilot-chat] ðŸ“§ Email salvo para confirmaÃ§Ã£o:', emailInformado);
              
              assistantMessage = `Não encontrei o email **${emailInformado}** na nossa base de clientes.

Poderia confirmar se esse email está correto?

Se estiver correto, vou te transferir para nosso time comercial. Se digitou errado, me informe o email correto.`;
              continue;
            }

            // CENÃRIO B: EMAIL ENCONTRADO (Ã‰ cliente)
            console.log('[ai-autopilot-chat] âœ… Cliente encontrado:', existingCustomer.first_name);

            // Vincular ao contato atual (se for diferente)
            if (existingCustomer.id !== contact.id) {
              // Atualizar o contato da conversa para o cliente real
              await supabaseClient
                .from('conversations')
                .update({ contact_id: existingCustomer.id })
                .eq('id', conversationId);
            }

            // ðŸ†• NOVO FLUXO: Email encontrado = Cliente identificado SEM OTP
            // OTP serÃ¡ pedido APENAS quando cliente solicitar operaÃ§Ã£o financeira
            console.log('[ai-autopilot-chat] âœ… Cliente identificado por email - SEM OTP (novo fluxo)');
            
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
                  // NÃƒO definimos awaiting_otp aqui - sÃ³ quando for financeiro
                }
              })
              .eq('id', conversationId);
            
            console.log('[ai-autopilot-chat] âœ… Cliente marcado como verificado (email_verified_in_db)');
            
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
            console.error('[ai-autopilot-chat] âŒ Erro ao processar email:', error);
            assistantMessage = 'Ocorreu um erro. Poderia me enviar o email novamente?';
          }
        }
        // FASE 2.5: Handle Resend OTP (reenvio seguro para email cadastrado)
        else if (toolCall.function.name === 'resend_otp') {
          try {
            console.log('[ai-autopilot-chat] ðŸ”„ Reenviando OTP para email cadastrado');
            
            const contactEmail = contact.email;
            if (!contactEmail) {
              assistantMessage = 'Não encontrei seu email cadastrado. Por favor, informe seu email para que eu possa enviar o código.';
              continue;
            }

            // Reenviar OTP para o email JÃ CADASTRADO
            const { data: otpData, error: otpError } = await supabaseClient.functions.invoke('send-verification-code', {
              body: { email: contactEmail, type: 'customer' }
            });

            if (otpError || !otpData?.success) {
              console.error('[ai-autopilot-chat] âŒ Erro ao reenviar OTP:', otpError);
              assistantMessage = 'Não consegui reenviar o código. Por favor, tente novamente em alguns instantes.';
              continue;
            }

            // ðŸ” ATUALIZAR OTP PENDENTE NA METADATA (novo cÃ³digo, novo timer)
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
            
            console.log('[ai-autopilot-chat] ðŸ” OTP pendente atualizado na metadata (resend_otp tool)');

            // Build response message usando template do banco (NEVER show code to client)
            const safeEmail = maskEmail(contactEmail);
            assistantMessage = await getMessageTemplate(
              supabaseClient,
              'otp_reenvio',
              { masked_email: safeEmail }
            ) || `Código reenviado com sucesso!

Enviei um novo código de 6 dígitos para **${safeEmail}**.

Por favor, verifique sua caixa de entrada (e spam) e digite o código que você recebeu.`;

            // Log dev mode internally (never show code to client)
            if (otpData.dev_mode) {
              console.log('[ai-autopilot-chat] âš ï¸ DEV MODE: CÃ³digo OTP nÃ£o enviado - verifique configuraÃ§Ã£o do Resend');
            }

            console.log('[ai-autopilot-chat] âœ… OTP reenviado para email cadastrado:', safeEmail);
            
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'note',
              content: `OTP reenviado para email cadastrado (${safeEmail})`,
              channel: responseChannel,
              metadata: { source: 'resend_otp', email_masked: safeEmail }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro ao reenviar OTP:', error);
            assistantMessage = 'Ocorreu um erro ao reenviar o código. Por favor, tente novamente.';
          }
        }
        // ðŸ†• TOOL HANDLER: Enviar OTP para operaÃ§Ãµes financeiras
        else if (toolCall.function.name === 'send_financial_otp') {
          try {
            console.log('[ai-autopilot-chat] ðŸ” Enviando OTP financeiro...');
            
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
              console.error('[ai-autopilot-chat] âŒ Erro ao enviar OTP financeiro:', otpError);
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
                  financial_otp_requested: true // Marca que Ã© OTP financeiro
                }
              })
              .eq('id', conversationId);
            
            console.log('[ai-autopilot-chat] ðŸ” OTP financeiro enviado e marcado na metadata');

            // Resposta
            const safeEmail = maskEmail(emailToUse);
            assistantMessage = `Para sua segurança, enviei um código de 6 dígitos para **${safeEmail}**.

Por favor, digite o código que você recebeu para confirmar sua identidade.`;

            // Log dev mode internally
            if (otpData.dev_mode) {
              console.log('[ai-autopilot-chat] âš ï¸ DEV MODE: CÃ³digo OTP financeiro nÃ£o enviado - verifique configuraÃ§Ã£o do Resend');
            }
            
            await supabaseClient.from('interactions').insert({
              customer_id: contact.id,
              type: 'note',
              content: `Verificacao financeira iniciada - OTP enviado para ${safeEmail}`,
              channel: responseChannel,
              metadata: { source: 'financial_otp', email_masked: safeEmail }
            });
          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro ao enviar OTP financeiro:', error);
            assistantMessage = 'Ocorreu um erro ao enviar o código. Por favor, tente novamente.';
          }
        }
        // TOOL: Confirmar email nÃ£o encontrado - transferir para comercial ou pedir novo email
        else if (toolCall.function.name === 'confirm_email_not_found') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            const confirmed = args.confirmed;
            const currentMetadata = conversation.customer_metadata || {};
            const pendingEmail = currentMetadata.pending_email_confirmation;
            
            console.log('[ai-autopilot-chat] ðŸ“§ ConfirmaÃ§Ã£o de email nÃ£o encontrado:', { confirmed, pendingEmail });
            
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
            
            // Cliente CONFIRMOU que email estÃ¡ correto - TRANSFERIR PARA COMERCIAL
            console.log('[ai-autopilot-chat] âœ… Email confirmado pelo cliente, transferindo para comercial');
            
            const emailInformado = pendingEmail || 'não informado';
            
            // âœ… CRIAR DEAL COM DADOS DO LEAD (contact_id = NULL)
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
              console.log('[ai-autopilot-chat] ðŸ’° Deal (Lead) criado:', dealId);
            } else {
              console.error('[ai-autopilot-chat] âŒ Erro ao criar deal:', dealError);
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
              console.error('[ai-autopilot-chat] âŒ Departamento Comercial nÃ£o encontrado');
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
                
                console.log('[ai-autopilot-chat] ðŸ’¼ Deal atribuÃ­do ao vendedor:', routeResult.assigned_to);
              }
              
              // NOTIFICAR VENDEDOR VIA REALTIME
              await supabaseClient.from('notifications').insert({
                user_id: routeResult.assigned_to,
                type: 'new_lead',
                title: 'Nova oportunidade no chat!',
                message: `Lead ${emailInformado} estÃ¡ aguardando atendimento`,
                metadata: {
                  conversation_id: conversationId,
                  deal_id: dealId,
                  email: emailInformado,
                  source: responseChannel,
                  action_url: `/inbox?conversation=${conversationId}`,
                },
                read: false
              });
              
              console.log('[ai-autopilot-chat] ðŸ”” NotificaÃ§Ã£o enviada ao vendedor');
              
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
                      email: emailInformado,
                      action_url: `/inbox?conversation=${conversationId}`,
                    },
                    read: false
                  });
                }
                console.log('[ai-autopilot-chat] ðŸ”” NotificaÃ§Ãµes broadcast enviadas');
              }
              
              assistantMessage = `Entendi! Como não localizei uma assinatura ativa com seu e-mail, vou te transferir para nosso time comercial.

Nosso **time de vendas** está offline no momento.
**Horário:** Segunda a Sexta, 09h às 18h.

Assim que retornarmos, um consultor vai te ajudar!`;
            }
          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro ao processar confirmaÃ§Ã£o de email:', error);
            assistantMessage = 'Ocorreu um erro. Poderia me informar seu email novamente?';
          }
        }
        // FASE 2: Handle OTP verification
        else if (toolCall.function.name === 'verify_otp_code') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] ðŸ” Verificando cÃ³digo OTP:', args.code);

            // Buscar email do contato
            const contactEmail = contact.email;
            if (!contactEmail) {
              assistantMessage = 'Por favor, primeiro me informe seu email.';
              continue;
            }

            // Buscar cÃ³digo mais recente nÃ£o expirado
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
              console.error('[ai-autopilot-chat] âŒ CÃ³digo invÃ¡lido ou expirado');
              
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

            console.log('[ai-autopilot-chat] âœ… OTP verificado com sucesso');

            // FASE 4: Verificar se cliente tem CPF cadastrado
            const { data: verifiedContact } = await supabaseClient
              .from('contacts')
              .select('id, first_name, document, status, account_balance')
              .eq('email', contactEmail)
              .single();

            if (!verifiedContact?.document) {
              // CPF NULL - NÃ£o permitir saque, transferir para humano
              console.log('[ai-autopilot-chat] âš ï¸ Cliente verificado mas sem CPF');
              
              assistantMessage = `Sua identidade foi confirmada, ${verifiedContact?.first_name || contactName}!

Porém, seu cadastro está **incompleto** (CPF não cadastrado).

Para liberar operações financeiras como saque, preciso transferir você para um especialista que vai atualizar seus dados. Aguarde um momento!`;

              // Handoff para humano
              await supabaseClient
                .from('conversations')
                .update({ ai_mode: 'copilot', department: conversation.department || '36ce66cd-7414-4fc8-bd4a-268fecc3f01a' })
                .eq('id', conversationId);

              await supabaseClient.functions.invoke('route-conversation', {
                body: { conversationId }
              });

              await supabaseClient.from('interactions').insert({
                customer_id: verifiedContact?.id || contact.id,
                type: 'internal_note',
                content: `Cliente verificado via OTP mas SEM CPF cadastrado. Requer atualizaÃ§Ã£o cadastral antes de operaÃ§Ãµes financeiras.`,
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
            console.error('[ai-autopilot-chat] âŒ Erro ao verificar OTP:', error);
            assistantMessage = 'Ocorreu um erro ao verificar o código. Por favor, tente novamente.';
          }
        }
        else if (toolCall.function.name === 'create_ticket') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] ðŸŽ« Criando ticket automaticamente:', args);

            // ðŸ”’ HARD GUARD: Bloquear criaÃ§Ã£o de ticket financeiro quando forbidFinancial ativo
            const financialIssueTypes = ['saque', 'reembolso', 'estorno', 'devolucao', 'devoluÃ§Ã£o', 'financeiro', 'cobranÃ§a', 'cobranca', 'cancelamento'];
            const isFinancialTicket = financialIssueTypes.includes((args.issue_type || '').toLowerCase());
            
            if (flow_context?.forbidFinancial && isFinancialTicket) {
              console.warn('[ai-autopilot-chat] ðŸ”’ HARD GUARD: Bloqueando create_ticket financeiro com forbidFinancial=true. issue_type:', args.issue_type);
              
              // Registrar bloqueio em ai_events
              try {
                await supabaseClient.from('ai_events').insert({
                  entity_type: 'conversation',
                  entity_id: conversationId,
                  event_type: 'ai_blocked_financial_tool_call',
                  model: 'ai-autopilot-chat',
                  output_json: {
                    phase: 'tool_call_guard',
                    tool: 'create_ticket',
                    issue_type: args.issue_type,
                    subject: args.subject,
                    forbid_financial: true,
                    blocked: true,
                  },
                  input_summary: (customerMessage || '').substring(0, 200),
                });
              } catch (logErr) {
                console.error('[ai-autopilot-chat] âš ï¸ Failed to log financial tool-call block:', logErr);
              }

              // Transferir para humano
              try {
                await supabaseClient
                  .from('conversations')
                  .update({ ai_mode: 'waiting_human', assigned_to: null })
                  .eq('id', conversationId);
              } catch {}

              // Finalizar flow state
              try {
                const { data: activeFS } = await supabaseClient
                  .from('chat_flow_states')
                  .select('id')
                  .eq('conversation_id', conversationId)
                  .in('status', ['active', 'waiting_input', 'in_progress'])
                  .order('started_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (activeFS) {
                  await supabaseClient
                    .from('chat_flow_states')
                    .update({ status: 'transferred', completed_at: new Date().toISOString() })
                    .eq('id', activeFS.id);
                }
              } catch {}

              assistantMessage = 'Entendi. Para assuntos financeiros, vou te encaminhar para um atendente humano agora.';
              // Skip ticket creation entirely - jump to after ticket block
              throw { __financialGuardSkip: true, message: assistantMessage };
            }

            // ðŸ” SECURITY NOTE: Rate limiting is handled at conversation level (AI autopilot only runs for authenticated conversations)
            // Public ticket creation via forms should implement rate limiting separately

            // Create ticket in database
            const ticketCategory = args.issue_type === 'defeito' ? 'tecnico' : 
                                   (args.issue_type === 'financeiro' || args.issue_type === 'saque') ? 'financeiro' : 
                                   'financeiro';
            
            const ticketSubject = args.subject || 
                                  (args.order_id ? `${args.issue_type.toUpperCase()} - Pedido ${args.order_id}` : 
                                   `${args.issue_type.toUpperCase()} - ${args.description.substring(0, 50)}`);

            // FASE 4: AnotaÃ§Ã£o estruturada para TODOS os tickets da IA
            const ticketType = args.ticket_type || 'outro';
            const createdAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            
            // Base estruturada para TODOS os tickets
            let internalNote = `**TICKET CRIADO VIA IA**

**RESUMO DA SOLICITAÃ‡ÃƒO:**
${args.description}

**CLIENTE:**
- Nome: ${contactName}
- CPF: ${maskedCPF || 'NÃ£o cadastrado'}
- Email: ${contact?.email || 'NÃ£o informado'}
- Telefone: ${contact?.phone || 'NÃ£o informado'}

**CLASSIFICAÃ‡ÃƒO:**
- Tipo: ${args.issue_type || 'NÃ£o especificado'}
- Categoria: ${ticketCategory}
${args.order_id ? `- Pedido: ${args.order_id}` : ''}

Criado em: ${createdAt}
Via: Atendimento Automatizado (IA)`;
            
            // Enriquecimento especÃ­fico para SAQUE
            if (args.issue_type === 'saque' && args.withdrawal_amount) {
              internalNote += `

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

**DADOS DO SAQUE:**
- Valor Solicitado: R$ ${args.withdrawal_amount.toFixed(2)}
- Tipo da Chave PIX: ${args.pix_key_type || 'NÃ£o especificado'}
- Chave PIX: ${args.pix_key || 'NÃ£o informada'}
- ConfirmaÃ§Ã£o do Cliente: ${args.customer_confirmation ? 'Dados conferidos pelo cliente' : 'Aguardando confirmaÃ§Ã£o'}

**REGRAS (atÃ© 7 dias Ãºteis):**
- Destino: APENAS conta do titular (CPF do cliente)
- PIX de terceiros: CANCELAR solicitaÃ§Ã£o

**CHECKLIST FINANCEIRO:**
- [ ] Verificar saldo disponÃ­vel
- [ ] Confirmar titularidade da chave PIX
- [ ] Processar transferÃªncia
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
              console.error('[ai-autopilot-chat] âŒ Erro ao criar ticket (ignorando):', ticketError);
              // âš ï¸ NÃƒO sobrescrever assistantMessage aqui
              // Deixar que o detector de fallback (linhas 886-979) lide com o handoff
              // se a resposta da IA for uma frase de fallback
            } else {
              console.log('[ai-autopilot-chat] âœ… Ticket criado com sucesso:', ticket.id);
              
              ticketCreatedSuccessfully = true; // ðŸ”’ Marcar sucesso (previne duplicaÃ§Ã£o no fallback)
              
              // âœ… ENVIAR EMAIL DE CONFIRMAÃ‡ÃƒO
              try {
                console.log('[ai-autopilot-chat] ðŸ“§ Enviando email de confirmaÃ§Ã£o do ticket...');
                
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
                  console.log('[ai-autopilot-chat] âœ… Email de confirmaÃ§Ã£o enviado com sucesso');
                } else {
                  const errorText = await notificationResponse.text();
                  console.error('[ai-autopilot-chat] âš ï¸ Falha ao enviar email:', errorText);
                }
              } catch (emailError) {
                console.error('[ai-autopilot-chat] âš ï¸ Erro ao enviar email de confirmaÃ§Ã£o:', emailError);
                // NÃ£o falhar o fluxo por causa de email
              }
              
              // Link conversation to ticket
              await supabaseClient
                .from('conversations')
                .update({ related_ticket_id: ticket.id })
                .eq('id', conversationId);

              // FASE 5: Mensagem especÃ­fica para SAQUE com dados coletados
              const withdrawalData = args.issue_type === 'saque' && args.withdrawal_amount ? {
                amount: args.withdrawal_amount,
                cpf_last4: args.confirmed_cpf_last4
              } : undefined;

              // ðŸŽ¯ SUBSTITUIR COMPLETAMENTE - Ticket criado = Problema resolvido = NÃ£o precisa desculpa
              assistantMessage = await createTicketSuccessMessage(
                supabaseClient,
                ticket.id,
                args.issue_type,
                args.order_id,
                withdrawalData,
                ticket.ticket_number
              );
            }
          } catch (error: any) {
            // ðŸ”’ Financial guard skip - not a real error
            if (error?.__financialGuardSkip) {
              assistantMessage = error.message;
              console.log('[ai-autopilot-chat] ðŸ”’ create_ticket blocked by financial guard');
            } else {
              console.error('[ai-autopilot-chat] âŒ Erro ao processar tool call (ignorando):', error);
              // âš ï¸ NÃƒO sobrescrever assistantMessage aqui
              // Deixar que o detector de fallback lide com o handoff se necessÃ¡rio
            }
          }
        }
        // TOOL: check_order_status - Consultar pedidos do cliente
        else if (toolCall.function.name === 'check_order_status') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            const customerEmail = args.customer_email?.toLowerCase().trim();
            console.log('[ai-autopilot-chat] ðŸ“¦ Consultando pedidos para:', customerEmail);

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
                : productData?.name || 'Produto nÃ£o especificado';
              
              const statusLabels: Record<string, string> = {
                'open': 'Em andamento',
                'won': 'Concluído',
                'lost': 'Cancelado'
              };
              const statusLabel = statusLabels[d.status] || d.status;
              
              const value = d.value ? `R$ ${d.value.toFixed(2)}` : 'R$ 0.00';
              
              return `â€¢ **${product}** - ${statusLabel}\n  Valor: ${value}`;
            }).join('\n\n');

            assistantMessage = `Olá ${customerContact.first_name}! 

Encontrei os seguintes pedidos vinculados ao seu email:

${dealsFormatted}

Sobre qual pedido você gostaria de saber mais?`;

          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro ao consultar pedidos:', error);
            assistantMessage = 'Ocorreu um erro ao consultar seus pedidos. Poderia tentar novamente?';
          }
        }
        // TOOL: check_tracking - Consultar rastreio via MySQL externo (suporta mÃºltiplos cÃ³digos)
        else if (toolCall.function.name === 'check_tracking') {
          console.log('[ai-autopilot-chat] ðŸšš CHECK_TRACKING INVOCADO');
          console.log('[ai-autopilot-chat] ðŸšš Argumentos brutos:', toolCall.function.arguments);
          
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] ðŸšš Argumentos parseados:', args);
            
            // Suporta tanto tracking_codes (array) quanto tracking_code (string legado)
            let trackingCodes: string[] = [];
            if (args.tracking_codes && Array.isArray(args.tracking_codes)) {
              trackingCodes = args.tracking_codes.map((c: string) => c.trim()).filter(Boolean);
            } else if (args.tracking_code) {
              trackingCodes = [args.tracking_code.trim()];
            }
            const customerEmail = args.customer_email?.toLowerCase().trim();
            
            console.log('[ai-autopilot-chat] ðŸ“¦ Consultando rastreio:', { trackingCodes, customerEmail, numCodes: trackingCodes.length });

            let codesToQuery: string[] = [];

            // Se tem cÃ³digos de rastreio diretos, usa eles
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

            // Buscar cÃ³digos nÃ£o cacheados no MySQL externo
            if (uncachedCodes.length > 0) {
              console.log('[ai-autopilot-chat] ðŸ” Buscando no MySQL:', { 
                codes: uncachedCodes,
                totalCodesToQuery: codesToQuery.length,
                cachedCount: cachedCodes.length,
                uncachedCount: uncachedCodes.length
              });
              
              try {
                console.log('[ai-autopilot-chat] ðŸ” Chamando fetch-tracking edge function...');
                const { data: fetchResult, error: fetchError } = await supabaseClient.functions.invoke('fetch-tracking', {
                  body: { tracking_codes: uncachedCodes }
                });

                console.log('[ai-autopilot-chat] ðŸ” fetch-tracking resultado:', {
                  success: fetchResult?.success,
                  found: fetchResult?.found,
                  total_requested: fetchResult?.total_requested,
                  hasData: !!fetchResult?.data,
                  error: fetchError?.message
                });

                if (fetchError) {
                  console.error('[ai-autopilot-chat] âŒ Erro fetch-tracking:', fetchError);
                } else if (fetchResult?.success && fetchResult?.data) {
                  console.log('[ai-autopilot-chat] âœ… fetch-tracking sucesso, processando resultados...');
                  // Atualizar cache e agregar resultados
                  for (const [code, info] of Object.entries(fetchResult.data)) {
                    if (info) {
                      const trackingInfo = info as any;
                      console.log('[ai-autopilot-chat] ðŸ“¦ CÃ³digo encontrado:', code, trackingInfo);
                      
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
                        // fetch-tracking retorna express_time / express_time_formatted (horÃ¡rio de embalagem/romaneio)
                        // Mantemos o nome packed_* aqui por compatibilidade com o restante do cÃ³digo.
                        packed_at: trackingInfo.packed_at ?? trackingInfo.express_time,
                        packed_at_formatted: trackingInfo.packed_at_formatted ?? trackingInfo.express_time_formatted,
                        is_packed: trackingInfo.is_packed,
                        external_updated_at: trackingInfo.updated_at
                      });
                    } else {
                      console.log('[ai-autopilot-chat] âš ï¸ CÃ³digo nÃ£o encontrado no MySQL:', code);
                    }
                  }
                } else {
                  console.log('[ai-autopilot-chat] âš ï¸ fetch-tracking sem sucesso ou sem dados:', fetchResult);
                }
              } catch (fetchErr) {
                console.error('[ai-autopilot-chat] âŒ Erro ao chamar fetch-tracking:', fetchErr);
              }
            }

            // === NOVA LÃ“GICA DE RESPOSTA COM REGRAS DE NEGÃ“CIO ===
            const codesFound = trackingResults.map(t => t.tracking_code);
            const codesNotFound = codesToQuery.filter(c => !codesFound.includes(c));

            let responseText = '';

            // CÃ³digos ENCONTRADOS = Pedido jÃ¡ saiu do galpÃ£o (tem romaneio)
            if (codesFound.length > 0) {
              const foundFormatted = trackingResults.map(t => {
                const platform = t.platform || 'Transportadora';
                // Usar packed_at_formatted (horÃ¡rio de embalagem) que vem do fetch-tracking
                const packedAt = t.packed_at_formatted 
                  || (t.packed_at 
                      ? new Date(t.packed_at).toLocaleDateString('pt-BR', { 
                          day: '2-digit', month: '2-digit', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit' 
                        })
                      : 'Recentemente');

                return `**${t.tracking_code}**
ðŸ“¦ Embalado em: ${packedAt}
ðŸšš Transportadora: ${platform}
âœ… Status: Pedido pronto e em transporte!`;
              }).join('\n\n');

              if (codesFound.length === 1) {
                responseText += `Ã“tima notÃ­cia! Seu pedido jÃ¡ foi embalado e saiu do galpÃ£o. EstÃ¡ em transporte!\n\n${foundFormatted}`;
              } else {
                responseText += `Ã“tima notÃ­cia! Seus pedidos jÃ¡ foram embalados e saÃ­ram do galpÃ£o. EstÃ£o em transporte!\n\n${foundFormatted}`;
              }
            }

            // CÃ³digos NÃƒO ENCONTRADOS = Ainda em preparaÃ§Ã£o
            if (codesNotFound.length > 0) {
              if (responseText) responseText += '\n\n---\n\n';
              
              const notFoundList = codesNotFound.map(c => `â€¢ ${c}`).join('\n');
              
              if (codesNotFound.length === 1) {
                responseText += `O cÃ³digo **${codesNotFound[0]}** ainda nÃ£o consta no sistema de romaneio.

**O que isso significa?**
Se o pedido foi pago **atÃ© 13h**, ele ainda estÃ¡ sendo preparado no galpÃ£o e serÃ¡ enviado atÃ© o fim do dia.

Por favor, volte a consultar no **fim do dia** ou amanhÃ£ pela manhÃ£ para verificar se jÃ¡ foi despachado.`;
              } else {
                responseText += `Os seguintes cÃ³digos ainda nÃ£o constam no sistema de romaneio:

${notFoundList}

**O que isso significa?**
Se os pedidos foram pagos **atÃ© 13h**, eles ainda estÃ£o sendo preparados no galpÃ£o e serÃ£o enviados atÃ© o fim do dia.

Por favor, volte a consultar no **fim do dia** ou amanhÃ£ pela manhÃ£ para verificar se jÃ¡ foram despachados.`;
              }
            }

            assistantMessage = responseText + '\n\nPosso ajudar com mais alguma coisa?';

          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro ao consultar rastreio:', error);
            assistantMessage = 'Ocorreu um erro ao consultar o rastreio. Poderia tentar novamente?';
          }
        }
        // TOOL: request_human_agent - Handoff manual
        else if (toolCall.function.name === 'request_human_agent') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] ðŸ‘¤ Executando handoff manual:', args);

            // ðŸ†• VALIDAÃ‡ÃƒO: Bloquear handoff se cliente nÃ£o estÃ¡ identificado por email
            const hasEmailInContact = contact.email && contact.email.length > 0;
            const hasEmailVerifiedInDb = conversation.customer_metadata?.email_verified_in_db === true;
            const isIdentified = hasEmailInContact || hasEmailVerifiedInDb;

            if (!isIdentified) {
              console.log('[ai-autopilot-chat] â›” Handoff BLOQUEADO - Cliente nÃ£o identificado por email');
              console.log('[ai-autopilot-chat] ðŸ“§ contact.email:', contact.email);
              console.log('[ai-autopilot-chat] ðŸ“§ email_verified_in_db:', conversation.customer_metadata?.email_verified_in_db);
              
              // Retornar mensagem instruindo a pedir email primeiro
              assistantMessage = 'Para poder te conectar com um atendente, preciso primeiro confirmar sua identidade. Qual Ã© o seu email de cadastro?';
              
              // NÃ£o executa o handoff - forÃ§a a IA a pedir email
              continue;
            }

            const handoffReason = args.reason || 'solicitacao_cliente';
            const handoffNote = args.internal_note || 'TransferÃªncia solicitada pela IA';

            // ðŸ†• BUSINESS HOURS CHECK: Comportamento diferente dentro/fora do horÃ¡rio
            const isWithinHours = businessHoursInfo?.within_hours ?? true; // Default: dentro do horÃ¡rio (seguro)

            if (isWithinHours) {
              // âœ… DENTRO DO HORÃRIO: Comportamento padrÃ£o (intacto)
              console.log('[ai-autopilot-chat] â˜€ï¸ Dentro do horÃ¡rio - handoff padrÃ£o');

              // 1. MUDAR O MODO (Desligar IA) â€” apenas se NÃƒO estiver dentro de um fluxo ativo
              if (!flow_context) {
                await supabaseClient
                  .from('conversations')
                  .update({ ai_mode: 'copilot', department: conversation.department || '36ce66cd-7414-4fc8-bd4a-268fecc3f01a' })
                  .eq('id', conversationId);
                console.log('[ai-autopilot-chat] âœ… ai_mode mudado para copilot');
              } else {
                console.log('[ai-autopilot-chat] âš ï¸ flow_context ativo â€” NÃƒO mudando ai_mode para copilot (soberania do fluxo)');
              }

              // 2. CHAMAR O ROTEADOR (Buscar agente disponÃ­vel)
              const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
                body: { conversationId }
              });
              
              if (routeError) {
                console.error('[ai-autopilot-chat] âŒ Erro ao rotear conversa:', routeError);
              } else {
                console.log('[ai-autopilot-chat] âœ… Conversa roteada:', routeResult);
              }

              // 3. REGISTRAR NOTA INTERNA
              const reasonLabels: Record<string, string> = {
                dados_incorretos: 'Dados Cadastrais Incorretos',
                solicitacao_cliente: 'SolicitaÃ§Ã£o do Cliente',
                caso_complexo: 'Caso Complexo',
                dados_financeiros_incorretos: 'Dados Financeiros Incorretos'
              };

              await supabaseClient.from('interactions').insert({
                customer_id: contact.id,
                type: 'internal_note',
                content: `**Handoff Manual Executado**

**Motivo:** ${reasonLabels[handoffReason] || handoffReason}
**Contexto:** ${handoffNote}
**Ãšltima Mensagem do Cliente:** "${customerMessage}"

**AÃ§Ã£o:** Conversa transferida para atendimento humano.`,
                channel: responseChannel,
                metadata: {
                  source: 'ai_autopilot_manual_handoff',
                  reason: handoffReason,
                  original_message: customerMessage
                }
              });

              console.log('[ai-autopilot-chat] âœ… Nota interna de handoff registrada');

              // 4. DEFINIR MENSAGEM APROPRIADA PARA O CLIENTE
              const reasonMessages: Record<string, string> = {
                dados_incorretos: 'Entendi! Vou transferir vocÃª para um atendente que vai ajudar a atualizar seus dados cadastrais. Aguarde um momento, por favor.',
                dados_financeiros_incorretos: 'Por seguranÃ§a, vou transferir vocÃª para um atendente humano que vai ajudar a corrigir seus dados. Aguarde um momento!',
                solicitacao_cliente: 'Sem problemas! Estou transferindo vocÃª para um atendente humano. Aguarde um momento, por favor.',
                caso_complexo: 'Vou transferir vocÃª para um especialista que pode te ajudar melhor com essa situaÃ§Ã£o. Aguarde um momento!'
              };

              assistantMessage = reasonMessages[handoffReason] || 
                'Estou transferindo vocÃª para um atendente humano. Aguarde um momento, por favor.';

            } else {
              // ðŸŒ™ FORA DO HORÃRIO: Fallback inteligente (sem falso SLA)
              console.log('[ai-autopilot-chat] ðŸŒ™ Fora do horÃ¡rio - registrando pendÃªncia sem route-conversation');

              const scheduleSummary = businessHoursInfo?.schedule_summary || 'horÃ¡rio comercial';
              const nextOpenText = businessHoursInfo?.next_open_text || 'no prÃ³ximo dia Ãºtil';

              // 1. NÃƒO chamar route-conversation
              // 2. NÃƒO mudar ai_mode (mantÃ©m autopilot)

              // 3. Mensagem ao cliente (template configurÃ¡vel com fallback)
              const defaultAfterHoursMsg = `Nosso atendimento humano funciona ${scheduleSummary}. ${nextOpenText} um atendente poderÃ¡ te ajudar. Enquanto isso, posso continuar tentando por aqui! ðŸ˜Š`;
              try {
                const { data: msgRow } = await supabaseClient
                  .from('business_messages_config')
                  .select('message_template')
                  .eq('message_key', 'after_hours_handoff')
                  .maybeSingle();
                if (msgRow?.message_template) {
                  assistantMessage = msgRow.message_template
                    .replace(/\{schedule\}/g, scheduleSummary)
                    .replace(/\{next_open\}/g, nextOpenText);
                } else {
                  assistantMessage = defaultAfterHoursMsg;
                }
              } catch (_) {
                assistantMessage = defaultAfterHoursMsg;
              }

              // 4. Adicionar tag "pendente_retorno" na conversation_tags
              try {
                const { data: tagRow } = await supabaseClient
                  .from('tags')
                  .select('id')
                  .eq('name', 'pendente_retorno')
                  .maybeSingle();

                if (tagRow) {
                  // Upsert para evitar duplicata
                  await supabaseClient
                    .from('conversation_tags')
                    .upsert({
                      conversation_id: conversationId,
                      tag_id: tagRow.id,
                    }, { onConflict: 'conversation_id,tag_id' });
                  console.log('[ai-autopilot-chat] ðŸ·ï¸ Tag pendente_retorno aplicada');
                } else {
                  console.warn('[ai-autopilot-chat] âš ï¸ Tag pendente_retorno nÃ£o encontrada no banco');
                }
              } catch (tagErr) {
                console.error('[ai-autopilot-chat] âš ï¸ Erro ao aplicar tag pendente_retorno:', tagErr);
              }

              // 5. Salvar metadata na conversa
              const existingMeta = conversation.customer_metadata || {};
              await supabaseClient
                .from('conversations')
                .update({
                  customer_metadata: {
                    ...existingMeta,
                    after_hours_handoff_requested_at: new Date().toISOString(),
                    after_hours_next_open_text: nextOpenText,
                    pending_department_id: conversation.department || null,
                    handoff_reason: handoffReason,
                  }
                })
                .eq('id', conversationId);

              // 6. Registrar nota interna
              await supabaseClient.from('interactions').insert({
                customer_id: contact.id,
                type: 'internal_note',
                content: `**Handoff Fora do Horário (Pendente Retorno)**

**Motivo:** ${handoffReason}
**Contexto:** ${handoffNote}
**Horário:** ${businessHoursInfo?.current_time || 'N/A'}
**Próxima abertura:** ${nextOpenText}

**Ação:** Conversa marcada com pendente_retorno. Será redistribuída automaticamente no próximo expediente.`,
                channel: responseChannel,
                metadata: {
                  source: 'ai_autopilot_after_hours_handoff',
                  reason: handoffReason,
                  after_hours: true,
                  next_open: nextOpenText,
                  original_message: customerMessage
                }
              });

              console.log('[ai-autopilot-chat] âœ… PendÃªncia fora do horÃ¡rio registrada');
            }

          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro ao executar handoff manual:', error);
            assistantMessage = 'Vou transferir você para um atendente humano. Por favor, aguarde um momento.';
          }
        }
        // TOOL: close_conversation - Encerramento autÃ´nomo com confirmaÃ§Ã£o
        else if (toolCall.function.name === 'close_conversation') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] ðŸ”’ close_conversation chamado:', args);
            
            const currentMeta = conversation.customer_metadata || {};
            
            if (args.customer_confirmed === false || !currentMeta.awaiting_close_confirmation) {
              // ETAPA 1: Perguntar confirmaÃ§Ã£o (anti-pulo: sempre pedir se flag nÃ£o existe)
              await supabaseClient.from('conversations')
                .update({
                  customer_metadata: {
                    ...currentMeta,
                    awaiting_close_confirmation: true,
                    close_reason: args.reason || 'assunto_resolvido'
                  }
                })
                .eq('id', conversationId);
              
              assistantMessage = 'Fico feliz em ter ajudado! 😊 Posso encerrar seu atendimento?';
              console.log('[ai-autopilot-chat] â³ Aguardando confirmaÃ§Ã£o do cliente para encerrar');
            }
            // Se customer_confirmed=true, o detector de confirmaÃ§Ã£o cuida na prÃ³xima mensagem
            
          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro em close_conversation:', error);
            assistantMessage = 'Ocorreu um erro. Posso ajudar com mais alguma coisa?';
          }
        }
        // TOOL: classify_and_resolve_ticket - ClassificaÃ§Ã£o pÃ³s-encerramento
        else if (toolCall.function.name === 'classify_and_resolve_ticket') {
          try {
            const args = safeParseToolArgs(toolCall.function.arguments);
            console.log('[ai-autopilot-chat] ðŸ“‹ classify_and_resolve_ticket chamado:', args);

            // 1. Buscar configs globais
            const { data: configs } = await supabaseClient
              .from('system_configurations')
              .select('key, value')
              .in('key', ['ai_global_enabled', 'ai_shadow_mode']);
            
            const configMap = new Map<string, string>();
            if (configs) for (const c of configs) configMap.set(c.key, c.value);
            
            const aiEnabled = configMap.get('ai_global_enabled') !== 'false';
            const shadowMode = configMap.get('ai_shadow_mode') === 'true';

            // 2. Kill switch guard
            if (!aiEnabled) {
              console.log('[ai-autopilot-chat] ðŸš« classify_and_resolve_ticket BLOQUEADO (kill switch)');
              await supabaseClient.from('ai_events').insert({
                entity_id: conversationId,
                entity_type: 'conversation',
                event_type: 'ai_ticket_classification',
                model: ragConfig.model,
                output_json: { category: args.category, summary: args.summary, blocked: true, reason: 'kill_switch' }
              });
              assistantMessage = 'ClassificaÃ§Ã£o nÃ£o executada (sistema em manutenÃ§Ã£o).';
              break;
            }

            // 3. Flow ativo guard â€” soberania do fluxo
            const { data: activeFlowState } = await supabaseClient
              .from('chat_flow_states')
              .select('id')
              .eq('conversation_id', conversationId)
              .in('status', ['in_progress', 'active', 'waiting_input'])
              .limit(1)
              .maybeSingle();

            if (activeFlowState) {
              console.log('[ai-autopilot-chat] ðŸš« classify_and_resolve_ticket BLOQUEADO (flow ativo):', activeFlowState.id);
              await supabaseClient.from('ai_events').insert({
                entity_id: conversationId,
                entity_type: 'conversation',
                event_type: 'ai_ticket_classification',
                model: ragConfig.model,
                output_json: { category: args.category, summary: args.summary, blocked: true, reason: 'active_flow', flow_state_id: activeFlowState.id }
              });
              assistantMessage = 'ClassificaÃ§Ã£o bloqueada: fluxo ativo gerencia tickets.';
              break;
            }

            // 4. Flag guard - sÃ³ executa se close jÃ¡ aconteceu
            const { data: convData } = await supabaseClient
              .from('conversations')
              .select('related_ticket_id, customer_id, contact_id, customer_metadata, department, status')
              .eq('id', conversationId)
              .single();

            const convMeta = convData?.customer_metadata || {};
            if (!convMeta.ai_can_classify_ticket) {
              console.log('[ai-autopilot-chat] âš ï¸ classify_and_resolve_ticket: flag ai_can_classify_ticket nÃ£o ativa');
              assistantMessage = 'ClassificaÃ§Ã£o disponÃ­vel apenas apÃ³s encerramento confirmado.';
              break;
            }

            // 4. Formatar internal_note
            const internalNote = `[AI RESOLVED]
Categoria: ${args.category}
Resumo: ${args.summary}
ResoluÃ§Ã£o: ${args.resolution_notes}
Severidade: ${args.severity || 'N/A'}
Tags: ${args.tags?.join(', ') || 'N/A'}
Conversa: ${conversationId}`;

            // 5. Shadow mode â†’ sÃ³ loga, nÃ£o altera DB
            if (shadowMode) {
              console.log('[ai-autopilot-chat] ðŸ‘ï¸ classify_and_resolve_ticket em SHADOW MODE');
              await supabaseClient.from('ai_events').insert({
                entity_id: conversationId,
                entity_type: 'conversation',
                event_type: 'ai_ticket_classification',
                model: ragConfig.model,
                output_json: { category: args.category, summary: args.summary, severity: args.severity, tags: args.tags, shadow_mode: true, action: 'suggested_only' }
              });
              await supabaseClient.from('ai_suggestions').insert({
                conversation_id: conversationId,
                suggested_reply: internalNote,
                suggestion_type: 'ticket_classification',
                confidence_score: 1.0,
                context: { category: args.category, summary: args.summary, resolution_notes: args.resolution_notes, severity: args.severity, tags: args.tags }
              });
              assistantMessage = `ClassificaÃ§Ã£o sugerida: ${args.category} (shadow mode - nÃ£o aplicada).`;
              break;
            }

            // 6. Anti-duplicaÃ§Ã£o: buscar ticket existente
            let ticketId = convData?.related_ticket_id;
            let ticketAction = 'updated';

            if (!ticketId) {
              // Buscar por source_conversation_id
              const { data: existingTicket } = await supabaseClient
                .from('tickets')
                .select('id')
                .eq('source_conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              ticketId = existingTicket?.id;
            }

            if (ticketId) {
              // UPDATE ticket existente
              const { error: updateErr } = await supabaseClient.from('tickets')
                .update({
                  status: 'resolved',
                  category: args.category,
                  internal_note: internalNote,
                  resolved_at: new Date().toISOString()
                })
                .eq('id', ticketId);
              if (updateErr) console.error('[ai-autopilot-chat] âŒ Erro ao atualizar ticket:', updateErr);
              else console.log('[ai-autopilot-chat] âœ… Ticket atualizado:', ticketId);
            } else {
              // INSERT novo ticket resolvido
              ticketAction = 'created';
              const { data: newTicket, error: insertErr } = await supabaseClient.from('tickets')
                .insert({
                  subject: `[AI] ${args.summary.substring(0, 100)}`,
                  description: args.resolution_notes,
                  status: 'resolved',
                  category: args.category,
                  internal_note: internalNote,
                  source_conversation_id: conversationId,
                  customer_id: convData?.contact_id || null,
                  department_id: convData?.department || null,
                  resolved_at: new Date().toISOString()
                })
                .select('id')
                .single();
              
              if (insertErr) {
                console.error('[ai-autopilot-chat] âŒ Erro ao criar ticket:', insertErr);
              } else {
                ticketId = newTicket?.id;
                console.log('[ai-autopilot-chat] âœ… Ticket criado:', ticketId);
              }
            }

            // 7. Vincular ticket Ã  conversa se necessÃ¡rio
            if (ticketId && !convData?.related_ticket_id) {
              await supabaseClient.from('conversations')
                .update({ related_ticket_id: ticketId })
                .eq('id', conversationId);
            }

            // 8. Limpar flag (anti re-classificaÃ§Ã£o)
            const cleanMetaClassify = { ...convMeta };
            delete cleanMetaClassify.ai_can_classify_ticket;
            await supabaseClient.from('conversations')
              .update({ customer_metadata: cleanMetaClassify })
              .eq('id', conversationId);

            // 9. Auditoria
            await supabaseClient.from('ai_events').insert({
              entity_id: conversationId,
              entity_type: 'conversation',
              event_type: 'ai_ticket_classification',
              model: ragConfig.model,
              output_json: { category: args.category, summary: args.summary, severity: args.severity, tags: args.tags, ticket_id: ticketId, action: ticketAction, shadow_mode: false }
            });

            assistantMessage = `Ticket classificado como "${args.category}" e registrado como resolvido.`;
            console.log('[ai-autopilot-chat] âœ… classify_and_resolve_ticket concluÃ­do:', { ticketId, action: ticketAction, category: args.category });

          } catch (error) {
            console.error('[ai-autopilot-chat] âŒ Erro em classify_and_resolve_ticket:', error);
            assistantMessage = 'Ocorreu um erro ao classificar o ticket. O atendimento jÃ¡ foi encerrado normalmente.';
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

    // ðŸ†• FIX LOOP: Detectar fallback configurado no nÃ³ comparando com fallbackMessage
    if (!isFallbackResponse && flow_context?.fallbackMessage) {
      const fallbackPrefix = flow_context.fallbackMessage.substring(0, 30).toLowerCase();
      if (fallbackPrefix.length > 5 && assistantMessage.toLowerCase().includes(fallbackPrefix)) {
        console.log('[ai-autopilot-chat] ðŸš¨ FALLBACK DETECTADO via fallbackMessage do nÃ³:', fallbackPrefix);
        isFallbackResponse = true;
      }
    }

    // ðŸ†• FIX LOOP: Anti-loop counter - mÃ¡ximo 5 fallbacks consecutivos no mesmo nÃ³ AI
    if (!isFallbackResponse && flow_context) {
      const existingMetadata = conversation.customer_metadata || {};
      const aiNodeFallbackCount = existingMetadata.ai_node_fallback_count || 0;
      const aiNodeId = existingMetadata.ai_node_current_id || null;
      
      // Se mudou de nÃ³, resetar contador
      if (aiNodeId !== flow_context.node_id) {
        // Novo nÃ³, resetar
      } else if (aiNodeFallbackCount >= 5) {
        console.log('[ai-autopilot-chat] ðŸš¨ ANTI-LOOP: MÃ¡ximo de 5 fallbacks atingido no nÃ³ AI â†’ forÃ§ando flow_advance_needed', {
          node_id: flow_context.node_id,
          fallback_count: aiNodeFallbackCount
        });
        // ðŸ“Š FIX 4: Telemetria anti-alucinaÃ§Ã£o â€” Anti-loop
        console.log(JSON.stringify({
          event: 'ai_decision',
          conversation_id: conversationId,
          reason: 'anti_loop_max_fallbacks',
          score: 0,
          hasFlowContext: true,
          exitType: 'flow_advance_needed',
          fallback_used: true,
          articles_found: 0,
          timestamp: new Date().toISOString()
        }));
        Promise.resolve(supabaseClient.from('ai_events').insert({
          entity_type: 'conversation',
          entity_id: conversationId,
          event_type: 'ai_decision_anti_loop_max_fallbacks',
          model: 'system',
          score: 0,
          output_json: { reason: 'anti_loop_max_fallbacks', exitType: 'flow_advance_needed', fallback_used: true, articles_found: 0, hasFlowContext: true },
        })).catch(() => {});
        isFallbackResponse = true;
      }
    }

    // ðŸ†• FIX LOOP: Atualizar contador de fallbacks no customer_metadata
    if (flow_context) {
      const existingMetadata = conversation.customer_metadata || {};
      const aiNodeId = existingMetadata.ai_node_current_id || null;
      let newCount = 0;
      
      if (isFallbackResponse) {
        newCount = (aiNodeId === flow_context.node_id) ? ((existingMetadata.ai_node_fallback_count || 0) + 1) : 1;
      }
      // Sempre atualizar o nÃ³ atual e o contador
      await supabaseClient
        .from('conversations')
        .update({
          customer_metadata: {
            ...existingMetadata,
            ai_node_current_id: flow_context.node_id,
            ai_node_fallback_count: isFallbackResponse ? newCount : 0
          }
        })
        .eq('id', conversationId);
    }

    if (isFallbackResponse) {
      console.log('[ai-autopilot-chat] ðŸš¨ FALLBACK DETECTADO');
      // ðŸ“Š FIX 4: Telemetria anti-alucinaÃ§Ã£o â€” Fallback phrase detection
      console.log(JSON.stringify({
        event: 'ai_decision',
        conversation_id: conversationId,
        reason: 'fallback_phrase_detected',
        score: 0,
        hasFlowContext: !!flow_context,
        exitType: flow_context ? 'stay_in_node' : 'handoff',
        fallback_used: true,
        articles_found: 0,
        timestamp: new Date().toISOString()
      }));
      Promise.resolve(supabaseClient.from('ai_events').insert({
        entity_type: 'conversation',
        entity_id: conversationId,
        event_type: 'ai_decision_fallback_phrase_detected',
        model: 'system',
        score: 0,
        output_json: { reason: 'fallback_phrase_detected', exitType: flow_context ? 'stay_in_node' : 'handoff', fallback_used: true, articles_found: 0, hasFlowContext: !!flow_context },
      })).catch(() => {});

      // ðŸ†• FIX: Se flow_context existe, NÃƒO sair do nÃ³ â€” limpar fallback phrases e continuar
      if (flow_context) {
        console.log('[ai-autopilot-chat] âš ï¸ FALLBACK + flow_context â†’ limpando fallback phrases e permanecendo no nÃ³');

        // Strip fallback phrases da resposta
        // âœ… FIX 5: Detectar [[FLOW_EXIT]] ANTES de stripar â€” Ã© sinal INTENCIONAL da persona
        const hasIntentionalExit = /\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]/.test(assistantMessage);
        if (hasIntentionalExit) {
          console.log('[ai-autopilot-chat] ðŸŽ¯ [[FLOW_EXIT]] detectado na resposta da IA â€” tratando como transferÃªncia intencional');
          const exitMatch = assistantMessage.match(/\[\[FLOW_EXIT:?([a-zA-Z_]*)\]\]/);
          const exitDestination = exitMatch?.[1] || null;
          console.log('[ai-autopilot-chat] ðŸŽ¯ Destino do exit:', exitDestination || 'padrÃ£o');
          // Limpar o token da mensagem visÃ­vel e deixar o flow avanÃ§ar normalmente abaixo
          assistantMessage = assistantMessage.replace(/\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]/gi, '').trim();
        }

        const FALLBACK_STRIP_PATTERNS = [
          /vou\s+(te\s+)?transferir\s+(para|a)\s+\w+/gi,
          /encaminh(ar|ando|o)\s+(para|a|vocÃª)\s+\w+/gi,
          /passar\s+(para|a)\s+um\s+(especialista|atendente|humano|agente)/gi,
          /um\s+(especialista|atendente|humano|agente)\s+(vai|irÃ¡|poderÃ¡)\s+(te\s+)?(atender|ajudar)/gi,
          /(vou|irei|posso)\s+(te\s+)?(conectar|direcionar|redirecionar)\s+(com|a)\s+\w+/gi,
          // [[FLOW_EXIT]] removido aqui â€” jÃ¡ tratado acima como sinal intencional
        ];
        
        let cleanedMessage = assistantMessage;
        for (const pattern of FALLBACK_STRIP_PATTERNS) {
          cleanedMessage = cleanedMessage.replace(pattern, '').trim();
        }
        
        // Se a mensagem ficou vazia apÃ³s limpeza, usar fallback genÃ©rico
        if (!cleanedMessage || cleanedMessage.length < 5) {
          cleanedMessage = 'Entendi! Poderia me dar mais detalhes sobre o que precisa? Estou aqui para ajudar.';
        }
        
        if (cleanedMessage !== assistantMessage) {
          console.log('[ai-autopilot-chat] ðŸ§¹ Mensagem limpa de fallback phrases:', { original: assistantMessage.substring(0, 100), cleaned: cleanedMessage.substring(0, 100) });
        }
        
        // Atualizar assistantMessage com versÃ£o limpa â€” serÃ¡ persistida e enviada pelo pipeline normal abaixo
        assistantMessage = cleanedMessage;
        
        // Log de qualidade (sem sair do nÃ³)
        Promise.resolve(supabaseClient.from('ai_quality_logs').insert({
          conversation_id: conversationId,
          contact_id: contact.id,
          customer_message: customerMessage,
          ai_response: cleanedMessage,
          action_taken: 'fallback_cleaned_stay_in_node',
          handoff_reason: 'fallback_stripped_flow_context',
          confidence_score: 0,
          articles_count: knowledgeArticles.length
        })).catch((e: any) => console.error('[ai-autopilot-chat] âš ï¸ Falha ao logar fallback_cleaned:', e));
        
        // Resetar flag â€” NÃƒO Ã© mais fallback apÃ³s limpeza
        isFallbackResponse = false;
        
        // ðŸ†• FIX: NÃƒO return â€” deixa cair no pipeline normal de persistÃªncia + envio WhatsApp
      } else {
      console.log('[ai-autopilot-chat] ðŸš¨ Sem flow_context - Executando handoff REAL');
      
      // ðŸ›¡ï¸ ANTI-RACE-CONDITION: Marcar handoff executado PRIMEIRO
      const handoffTimestamp = new Date().toISOString();
      
      // ðŸ†• VERIFICAÃ‡ÃƒO DE LEAD: Se nÃ£o tem email E nÃ£o Ã© cliente â†’ Comercial
      const isLeadWithoutEmail = !contactHasEmail && !isCustomerInDatabase && !isKiwifyValidated;
      const DEPT_COMERCIAL_ID = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c';
      const DEPT_SUPORTE_ID = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
      
      // âœ… Respeitar departamento definido pelo fluxo (nunca sobrescrever)
      const handoffDepartment = conversation.department || 
                               (isLeadWithoutEmail ? DEPT_COMERCIAL_ID : DEPT_SUPORTE_ID);
      
      console.log('[ai-autopilot-chat] ðŸ”„ Departamento de handoff (fallback):', {
        flowDepartment: conversation.department,
        isLeadWithoutEmail,
        contactHasEmail,
        isCustomerInDatabase,
        contactStatus: contact.status,
        finalDepartment: handoffDepartment,
        reason: conversation.department ? 'RESPEITANDO FLUXO' : (isLeadWithoutEmail ? 'LEADâ†’COMERCIAL' : 'SUPORTE')
      });
      
      // 1. MUDAR O MODO para waiting_human (NÃƒO copilot!) e marcar timestamp + departamento
      await supabaseClient
        .from('conversations')
        .update({ 
          ai_mode: 'waiting_human', // ðŸ†• waiting_human para ficar na fila atÃ© agente responder
          handoff_executed_at: handoffTimestamp, // ðŸ†• Anti-race-condition flag
          needs_human_review: true,
          department: handoffDepartment, // ðŸ†• Definir departamento correto (Comercial para leads)
          customer_metadata: {
            ...(conversation.customer_metadata || {}),
            ...(isLeadWithoutEmail && {
              lead_routed_to_comercial_reason: 'fallback_handoff',
              lead_routed_at: handoffTimestamp
            })
          }
        })
        .eq('id', conversationId);
      
      console.log('[ai-autopilot-chat] âœ… ai_mode mudado para waiting_human, handoff_executed_at:', handoffTimestamp);
      
      // 2. CHAMAR O ROTEADOR COM DEPARTAMENTO EXPLÃCITO
      const { data: routeResult, error: routeError } = await supabaseClient.functions.invoke('route-conversation', {
        body: { 
          conversationId,
          department_id: handoffDepartment // ðŸ†• Passar departamento explÃ­cito
        }
      });
      
      if (routeError) {
        console.error('[ai-autopilot-chat] âŒ Erro ao rotear conversa:', routeError);
      } else {
        console.log('[ai-autopilot-chat] âœ… Conversa roteada:', routeResult);
        
        // ðŸ†• Mensagem diferenciada para leads
        if (isLeadWithoutEmail && routeResult?.assigned) {
          assistantMessage = 'Obrigado pelo seu interesse! Vou te direcionar para nosso time Comercial que poderÃ¡ te apresentar nossas soluÃ§Ãµes. ðŸ¤\n\nAguarde um momento que logo um de nossos consultores irÃ¡ te atender!';
        }
        
        // ðŸ†• Se ninguÃ©m online, MANTER waiting_human - cliente fica na fila aguardando
        if (routeResult?.no_agents_available) {
          console.log('[ai-autopilot-chat] âš ï¸ Sem agentes online - Cliente ficarÃ¡ na FILA aguardando');
          
          // ðŸ›¡ï¸ NÃƒO REVERTER para autopilot! Manter em waiting_human na fila
          await supabaseClient
            .from('conversations')
            .update({ 
              needs_human_review: true,  // Flag para quando agente ficar online
              // NÃƒO mudar ai_mode - MANTÃ‰M waiting_human
            })
            .eq('id', conversationId);
          
          // Mensagem diferenciada para leads vs clientes
          if (isLeadWithoutEmail) {
            assistantMessage = `Obrigado pelo contato! Nosso time Comercial estÃ¡ ocupado no momento, mas vocÃª estÃ¡ na fila e serÃ¡ atendido em breve. ðŸ¤

â° HorÃ¡rio de atendimento: Segunda a Sexta, das 09h Ã s 18h.`;
          } else {
            assistantMessage = `Vou te conectar com um de nossos especialistas! 

Nossa equipe estÃ¡ ocupada no momento, mas vocÃª estÃ¡ na fila e serÃ¡ atendido assim que um atendente ficar disponÃ­vel. 

â° HorÃ¡rio de atendimento: Segunda a Sexta, das 09h Ã s 18h.`;
          }
          
          console.log('[ai-autopilot-chat] âœ… Cliente mantido em waiting_human - na fila para atendimento');
        }
      }
      
      // 3. CRIAR TICKET AUTOMÃTICO PARA CASOS FINANCEIROS (apenas se nÃ£o criado por tool call)
      
      // ðŸš¨ Detectar se Ã© pedido financeiro COM INTENÃ‡ÃƒO DE AÃ‡ÃƒO (usa constante global)
      const isInformationalQuestion = INFORMATIONAL_PATTERNS.some(pattern => 
        pattern.test(customerMessage)
      );

      // SÃ³ Ã© request financeiro se tiver padrÃ£o de aÃ§Ã£o E nÃ£o for dÃºvida informativa
      let isFinancialRequest = FINANCIAL_ACTION_PATTERNS.some(pattern => 
        pattern.test(customerMessage)
      );

      if (isInformationalQuestion) {
        isFinancialRequest = false; // Anular se for dÃºvida
        console.log('[ai-autopilot-chat] â„¹ï¸ Pergunta informativa detectada - NÃƒO criar ticket');
      }
      
      // ðŸ”’ SÃ³ criar ticket automÃ¡tico se nÃ£o foi criado COM SUCESSO pelo tool call
      // Se o tool call falhou, permitir que o fallback detector crie como backup
      if (isFinancialRequest && !ticketCreatedSuccessfully) {
        console.log('[ai-autopilot-chat] ðŸ’° SolicitaÃ§Ã£o financeira detectada - Criando ticket de seguranÃ§a');
        
        const { data: ticket, error: ticketError } = await supabaseClient
          .from('tickets')
          .insert({
            customer_id: contact.id,
            subject: `ðŸ’° SolicitaÃ§Ã£o Financeira - ${customerMessage.substring(0, 50)}...`,
            description: `**Mensagem Original:**\n${customerMessage}\n\n**Motivo do Ticket:**\nCriado automaticamente por handoff de IA - solicitaÃ§Ã£o financeira detectada.`,
            priority: 'high',
            status: 'open',
            category: 'financeiro',
            source_conversation_id: conversationId,
            internal_note: 'ðŸ¤– Ticket criado automaticamente pela IA - Assunto financeiro requer atenÃ§Ã£o humana'
          })
          .select()
          .single();
        
        if (ticketError) {
          console.error('[ai-autopilot-chat] âŒ Erro ao criar ticket financeiro:', ticketError);
        } else {
          console.log('[ai-autopilot-chat] âœ… Ticket financeiro criado:', ticket?.id);
          
          // Vincular ticket Ã  conversa
          await supabaseClient
            .from('conversations')
            .update({ related_ticket_id: ticket?.id })
            .eq('id', conversationId);
          
          // ðŸŽ¯ SUBSTITUIR COMPLETAMENTE - Ticket criado = Mensagem limpa e profissional
          assistantMessage = await createTicketSuccessMessage(
            supabaseClient,
            ticket?.id || '',
            'financeiro',
            undefined,
            undefined,
            ticket?.ticket_number
          );
          
          ticketCreatedSuccessfully = true; // ðŸ”’ Atualizar flag DEPOIS de enriquecer
        }
      }
      
      // 4. REGISTRAR NOTA INTERNA (Auditoria)
      await supabaseClient.from('interactions').insert({
        customer_id: contact.id,
        type: 'internal_note',
        content: `ðŸ¤–â†’ðŸ‘¤ **Handoff AutomÃ¡tico Executado**\n\n**Pergunta do Cliente:** "${customerMessage}"\n**Motivo:** IA nÃ£o encontrou resposta adequada na base de conhecimento.\n**Departamento:** ${isLeadWithoutEmail ? 'ðŸ›’ Comercial (Lead sem identificaÃ§Ã£o)' : 'ðŸŽ§ Suporte'}\n**AÃ§Ã£o:** ${isLeadWithoutEmail ? 'Lead novo roteado para equipe Comercial.' : 'Conversa transferida para atendimento humano.'}${isFinancialRequest ? '\n**Ticket Financeiro:** Criado automaticamente' : ''}`,
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
      
      console.log('[ai-autopilot-chat] âœ… Nota interna de handoff registrada');
      } // end else (no flow_context â€” handoff real)
    }
    // ========== FIM DETECTOR DE FALLBACK ==========

    // ============================================================
    // FASE 5: VerificaÃ§Ã£o de duplicata JÃ REALIZADA no inÃ­cio (linha ~325)
    // ============================================================

    // ============================================================
    // ðŸ†• VALIDAÃ‡ÃƒO ANTI-ESCAPE: ANTES de salvar/enviar
    // Se flow_context existe, IA sÃ³ pode retornar texto puro
    // Detectar escape ANTES do banco + WhatsApp = zero vazamento
    // ============================================================

    // ðŸ†• [INTENT:X] TAG DETECTION: Detectar e remover intent tags ANTES do escape check
    const intentTagMatch = assistantMessage.match(/\[INTENT:([a-zA-Z_]+)\]/i);
    let detectedIntentTag: string | null = null;
    if (intentTagMatch) {
      detectedIntentTag = intentTagMatch[1].toLowerCase();
      assistantMessage = assistantMessage.replace(/\s*\[INTENT:[a-zA-Z_]+\]\s*/gi, '').trim();
      console.log(`[ai-autopilot-chat] ðŸŽ¯ [INTENT:${detectedIntentTag}] detectado e removido da mensagem`);
    }

    if (flow_context && flow_context.response_format === 'text_only') {
      const escapeAttempt = ESCAPE_PATTERNS.some(pattern => pattern.test(assistantMessage));
      
      if (escapeAttempt) {
        const isCleanExit = /^\s*\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]\s*$/.test(assistantMessage);
        
        if (isCleanExit) {
          // ðŸ†• Extrair intent do token [[FLOW_EXIT:financeiro]] â†’ "financeiro"
          const exitIntentMatch = assistantMessage.match(/\[\[FLOW_EXIT:([a-zA-Z_]+)\]\]/i);
          const aiExitIntent = exitIntentMatch ? exitIntentMatch[1].toLowerCase() : undefined;
          
          console.log('[ai-autopilot-chat] âœ… [[FLOW_EXIT]] detectado ANTES de salvar â€” saÃ­da limpa', {
            ai_exit_intent: aiExitIntent || 'none',
          });
          // Log auditoria non-blocking
          Promise.resolve(supabaseClient.from('ai_events').insert({
            entity_type: 'conversation',
            entity_id: conversationId,
            event_type: 'flow_exit_clean',
            model: configuredAIModel || 'gpt-5-mini',
            output_json: {
              blocked_preview: assistantMessage.substring(0, 150),
              flow_id: flow_context.flow_id,
              node_id: flow_context.node_id,
              reason: 'ai_requested_exit',
              ai_exit_intent: aiExitIntent,
            },
            input_summary: customerMessage?.substring(0, 200) || '',
          })).catch((err: any) => console.error('[ai-autopilot-chat] âš ï¸ Failed to log escape event:', err));
          return new Response(JSON.stringify({
            flowExit: true,
            reason: 'ai_requested_exit',
            hasFlowContext: true,
            ...(aiExitIntent ? { ai_exit_intent: aiExitIntent } : {}),
            flow_context: {
              flow_id: flow_context.flow_id,
              node_id: flow_context.node_id
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.warn('[ai-autopilot-chat] âš ï¸ ESCAPE DETECTADO ANTES de salvar! IA tentou fabricar transferÃªncia');
          console.warn('[ai-autopilot-chat] Resposta bloqueada:', assistantMessage.substring(0, 100));
          // Log auditoria non-blocking
          Promise.resolve(supabaseClient.from('ai_events').insert({
            entity_type: 'conversation',
            entity_id: conversationId,
            event_type: 'contract_violation_blocked',
            model: configuredAIModel || 'gpt-5-mini',
            output_json: {
              blocked_preview: assistantMessage.substring(0, 150),
              flow_id: flow_context.flow_id,
              node_id: flow_context.node_id,
              reason: 'ai_contract_violation',
            },
            input_summary: customerMessage?.substring(0, 200) || '',
          })).catch((err: any) => console.error('[ai-autopilot-chat] âš ï¸ Failed to log escape event:', err));
          
          // ðŸ†• FIX: Substituir mensagem e FICAR no nÃ³ (nÃ£o retornar flowExit)
          console.log('[ai-autopilot-chat] ðŸ”„ Contract violation + flow_context â†’ substituindo mensagem e permanecendo no nÃ³');
          assistantMessage = 'Entendi! Poderia me dar mais detalhes sobre o que precisa? Estou aqui para ajudar.';
          // Continua execuÃ§Ã£o normal â€” mensagem serÃ¡ persistida abaixo
        }
      }
      
      // ValidaÃ§Ã£o de restriÃ§Ãµes (forbidQuestions, forbidOptions, forbidFinancial)
      const forbidQuestions = flow_context.forbidQuestions ?? true;
      const forbidOptions = flow_context.forbidOptions ?? true;
      const forbidFinancial = flow_context.forbidFinancial ?? false;
      const restrictionCheck = validateResponseRestrictions(assistantMessage, forbidQuestions, forbidOptions, flow_context); // FIX LOOP: passa contexto para detectar triagem
      
      if (!restrictionCheck.valid) {
        console.warn('[ai-autopilot-chat] âš ï¸ VIOLAÃ‡ÃƒO DE RESTRIÃ‡ÃƒO (prÃ©-save):', restrictionCheck.violation);

        // FIX LOOP: No de triagem PRECISA fazer perguntas para identificar intencao
        // Nao substituir pelo fallbackMessage (que pode ser a mensagem de boas-vindas)
        const isTriageNode = (flow_context.objective || '').toLowerCase().includes('triag') ||
          (flow_context.contextPrompt || '').toLowerCase().includes('triag') ||
          (flow_context.contextPrompt || '').toLowerCase().includes('inten');
        if (restrictionCheck.violation === 'question_detected' && isTriageNode) {
          console.log('[ai-autopilot-chat] FIX LOOP: No de triagem pode perguntar - ignorando forbidQuestions');
          // Deixar assistantMessage original passar sem substituir
        } else {

        const fallbackMessage = flow_context.fallbackMessage || 'No momento nÃ£o tenho essa informaÃ§Ã£o.';
        
        // ðŸ“Š FIX 4: Telemetria anti-alucinaÃ§Ã£o â€” Restriction violation
        console.log(JSON.stringify({
          event: 'ai_decision',
          conversation_id: conversationId,
          reason: 'restriction_violation_' + restrictionCheck.violation,
          score: 0,
          hasFlowContext: true,
          exitType: 'stay_in_node',
          fallback_used: true,
          articles_found: 0,
          timestamp: new Date().toISOString()
        }));
        Promise.resolve(supabaseClient.from('ai_events').insert({
          entity_type: 'conversation',
          entity_id: conversationId,
          event_type: 'ai_decision_restriction_violation_' + restrictionCheck.violation,
          model: 'system',
          score: 0,
          output_json: { reason: 'restriction_violation_' + restrictionCheck.violation, exitType: 'stay_in_node', fallback_used: true, articles_found: 0, hasFlowContext: true },
        })).catch(() => {});
        
        // ðŸ†• FIX: Substituir mensagem pelo fallback e FICAR no nÃ³ (nÃ£o retornar flow_advance_needed)
        console.log('[ai-autopilot-chat] ðŸ”„ VIOLAÃ‡ÃƒO DE RESTRIÃ‡ÃƒO + flow_context â†’ substituindo mensagem e permanecendo no nÃ³');
        assistantMessage = fallbackMessage;
        
        Promise.resolve(supabaseClient.from('ai_quality_logs').insert({
          conversation_id: conversationId,
          contact_id: contact.id,
          customer_message: customerMessage,
          ai_response: fallbackMessage,
          action_taken: 'restriction_cleaned_stay_in_node',
          handoff_reason: `restriction_violation_${restrictionCheck.violation}`,
          confidence_score: 0,
          articles_count: knowledgeArticles.length
        })).catch((e: any) => console.error('[ai-autopilot-chat] âš ï¸ Falha ao logar restriction_violation:', e));
        
        // Continua execuÃ§Ã£o â€” mensagem serÃ¡ persistida abaixo
        }
      } else if (forbidFinancial) {
        // ðŸ†• Apenas bloquear se a IA tentou EXECUTAR uma aÃ§Ã£o financeira (nÃ£o informaÃ§Ãµes)
        const financialResolutionPattern = /(j[Ã¡a] processei|foi estornado|solicitei reembolso|vou reembolsar|pode sacar|liberei o saque|reembolso aprovado|estorno realizado|cancelamento confirmado|pagamento devolvido|jÃ¡ estornei|processando.*reembolso|aprovei.*devolu[Ã§c][Ã£a]o|sacar.*saldo|saque.*(realizado|solicitado)|para\s+prosseguir\s+com\s+o\s+(saque|reembolso|estorno)|confirmar.*dados.*(saque|reembolso|estorno)|devolver.*dinheiro)/i;
        if (financialResolutionPattern.test(assistantMessage)) {
          console.warn('[ai-autopilot-chat] ðŸ”’ TRAVA FINANCEIRA (prÃ©-save): IA tentou EXECUTAR aÃ§Ã£o financeira');
          assistantMessage = 'Entendi sua solicitaÃ§Ã£o. Vou te encaminhar para o setor responsÃ¡vel que poderÃ¡ te ajudar com isso.';
          
          // Sinalizar flow_advance_needed para que o webhook avance no fluxo financeiro
          return new Response(JSON.stringify({
            ok: true,
            financialBlocked: true,
            exitKeywordDetected: true,
            flow_advance_needed: true,
            hasFlowContext: true,
            response: assistantMessage,
            message: assistantMessage,
            aiResponse: assistantMessage,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Se nÃ£o tentou executar aÃ§Ã£o, aplicar limitaÃ§Ã£o de frases normalmente
        const maxSentences = flow_context.maxSentences ?? 3;
        assistantMessage = limitSentences(assistantMessage, maxSentences);
        console.log('[ai-autopilot-chat] âœ… forbidFinancial ativo mas resposta Ã© informativa â€” permitida');
      } else {
        const maxSentences = flow_context.maxSentences ?? 3;
        assistantMessage = limitSentences(assistantMessage, maxSentences);
        
        const kbUsed = knowledgeArticles && knowledgeArticles.length > 0;
        const crmUsed = false;
        const trackingUsed = false;
        logSourceViolationIfAny(
          assistantMessage, 
          flow_context.allowed_sources || ['kb', 'crm', 'tracking'],
          kbUsed,
          crmUsed,
          trackingUsed,
          false, // kiwifyUsed
          sandboxUsedFlag
        );
        
        console.log('[ai-autopilot-chat] âœ… Resposta passou validaÃ§Ã£o anti-escape (prÃ©-save)');
      }
    }

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
        channel: responseChannel, // âœ… FASE 4: Adicionar canal
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
      console.log('[ai-autopilot-chat] ðŸ“§ Enviando resposta por email:', {
        contactEmail: contact.email,
        messageId
      });

      try {
        const { data: emailResult, error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            to: contact.email,
            to_name: `${contact.first_name} ${contact.last_name}`.trim(),
            subject: `Re: ${conversation.subject || 'Seu ArmazÃ©m Drop - Resposta do Suporte'}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563EB;">OlÃ¡, ${contact.first_name}!</h2>
                <div style="margin: 20px 0; line-height: 1.6;">
                  ${assistantMessage.replace(/\n/g, '<br>')}
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
                <p style="color: #6b7280; font-size: 12px;">
                  Esta Ã© uma resposta automÃ¡tica do nosso assistente inteligente.<br>
                  Se precisar de mais ajuda, basta responder este email.
                </p>
              </div>
            `,
            customer_id: contact.id
          }
        });

        if (emailError) {
          console.error('[ai-autopilot-chat] âŒ Erro ao enviar email:', emailError);
          // Atualizar status para failed
          await supabaseClient
            .from('messages')
            .update({ 
              status: 'failed',
              delivery_error: emailError.message || 'Failed to send email'
            })
            .eq('id', messageId);
        } else {
          console.log('[ai-autopilot-chat] âœ… Email enviado com sucesso');
          // Atualizar status para delivered
          await supabaseClient
            .from('messages')
            .update({ status: 'delivered' })
            .eq('id', messageId);
        }
      } catch (emailError) {
        console.error('[ai-autopilot-chat] âŒ Exception ao enviar email:', emailError);
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
      console.log('[ai-autopilot-chat] ðŸ“± Tentando enviar WhatsApp:', {
        contactPhone: contact.phone,
        contactWhatsappId: contact.whatsapp_id,
        messageId,
        whatsappProvider: conversation.whatsapp_provider,
        whatsappMetaInstanceId: conversation.whatsapp_meta_instance_id,
        whatsappEvolutionInstanceId: conversation.whatsapp_instance_id
      });

      try {
        // ðŸ”’ USAR HELPER MULTI-PROVIDER
        const whatsappResult = await getWhatsAppInstanceWithProvider(
          supabaseClient, 
          conversationId, 
          conversation.whatsapp_instance_id,
          conversation.whatsapp_provider,
          conversation.whatsapp_meta_instance_id
        );
        
        // Validar se instÃ¢ncia foi encontrada
        if (!whatsappResult) {
          console.error('[ai-autopilot-chat] âš ï¸ NENHUMA instÃ¢ncia WhatsApp disponÃ­vel');
          
          // Salvar mensagem como 'failed' com motivo
          await supabaseClient
            .from('messages')
            .update({ 
              status: 'failed',
              delivery_error: 'Nenhuma instÃ¢ncia WhatsApp conectada disponÃ­vel'
            })
            .eq('id', messageId);
          
          throw new Error('Nenhuma instÃ¢ncia WhatsApp disponÃ­vel');
        }
        
        const { instance: whatsappInstance, provider } = whatsappResult;
        
        // ========== META WHATSAPP CLOUD API ==========
        if (provider === 'meta') {
          // ðŸ†• CORREÃ‡ÃƒO: Priorizar whatsapp_id sobre phone
          const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
          
          console.log('[ai-autopilot-chat] ðŸ“¤ Invocando send-meta-whatsapp:', {
            instanceId: whatsappInstance.id,
            phoneNumberId: whatsappInstance.phone_number_id,
            targetNumber: targetNumber?.slice(-4),
            source: extractWhatsAppNumber(contact.whatsapp_id) ? 'whatsapp_id' : 'phone',
            contactPhone: contact.phone?.slice(-4),
            contactWhatsappId: contact.whatsapp_id?.slice(-20)
          });

          const { data: metaResponse, error: metaError } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
            body: {
              instance_id: whatsappInstance.id,
              phone_number: targetNumber, // ðŸ†• Usa whatsapp_id se disponÃ­vel
              message: assistantMessage,
              conversation_id: conversationId,
              skip_db_save: true, // ðŸ†• CRÃTICO: JÃ¡ salvamos na linha 7193
              sender_name: persona?.name || undefined, // ðŸ†• Nome da persona para prefixar mensagem
              is_bot_message: true // ðŸ†• Mensagem de IA = bot message
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

          console.log('[ai-autopilot-chat] âœ… Resposta enviada via Meta WhatsApp API');
        }
        // ========== EVOLUTION API (Legacy) ==========
        else {
          // Log de aviso se instÃ¢ncia nÃ£o estÃ¡ conectada
          if (whatsappInstance.status !== 'connected') {
            console.warn('[ai-autopilot-chat] âš ï¸ Tentando enviar com instÃ¢ncia Evolution nÃ£o-conectada:', whatsappInstance.status);
          }

          console.log('[ai-autopilot-chat] ðŸ“¤ Invocando send-whatsapp-message (Evolution):', {
            instanceId: whatsappInstance.id,
            instanceStatus: whatsappInstance.status,
            phoneNumber: contact.phone,
            whatsappId: contact.whatsapp_id
          });

          // ðŸ†• Para Evolution, prefixar manualmente a mensagem com nome da persona
          const formattedMessageEvolution = persona?.name ? `*${persona.name}*\n${assistantMessage}` : assistantMessage;
          
          const { data: whatsappResponse, error: whatsappError } = await supabaseClient.functions.invoke('send-whatsapp-message', {
            body: {
              instance_id: whatsappInstance.id,
              phone_number: contact.phone,
              whatsapp_id: contact.whatsapp_id,
              message: formattedMessageEvolution,
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

          console.log('[ai-autopilot-chat] âœ… Resposta enviada via Evolution API');
        }
      } catch (whatsappError) {
        console.error('[ai-autopilot-chat] âŒ WhatsApp send failed:', whatsappError);
        
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

    // 9. Registrar uso de IA nos logs (nÃ£o-bloqueante)
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
      console.log('ðŸ“Š [USAGE LOG] Uso da IA registrado com sucesso');
    } catch (logError) {
      console.error('âš ï¸ [USAGE LOG ERROR] Erro ao registrar uso (nÃ£o bloqueante):', logError);
    }

    // ðŸ†• UPGRADE 1: Telemetria real em ai_events (confianÃ§a, artigos, latÃªncia)
    try {
      const telemetryEndTime = Date.now();
      const interactionCount = flow_context?.collectedData?.__ai?.interaction_count || 1;
      const maxInteractions = flow_context?.collectedData?.__ai?.max_ai_interactions || 0;
      const isPersistent = !!flow_context?.collectedData?.__ai;

      await supabaseClient
        .from('ai_events')
        .insert({
          entity_type: 'conversation',
          entity_id: conversationId,
          event_type: 'ai_response',
          model: configuredAIModel || 'gpt-5-mini',
          output_json: {
            confidence_score: confidenceResult?.score ?? null,
            confidence_action: confidenceResult?.action ?? null,
            articles_used: knowledgeArticles.map((a: any) => a.title),
            articles_count: knowledgeArticles.length,
            interaction_number: interactionCount,
            max_interactions: maxInteractions,
            exit_reason: null,
            query_preview: customerMessage.substring(0, 120),
            persistent_mode: isPersistent,
            persona_id: persona?.id,
            persona_name: persona?.name,
          },
          score: confidenceResult?.score ?? null,
          tokens_used: null,
          department_id: conversation?.department || null,
          input_summary: customerMessage.substring(0, 200),
        });
      console.log('ðŸ“Š [AI_EVENTS] Telemetria registrada em ai_events');
    } catch (telemetryError) {
      console.error('âš ï¸ [AI_EVENTS ERROR] Erro ao registrar telemetria (nÃ£o bloqueante):', telemetryError);
    }

    console.log('[ai-autopilot-chat] âœ… Resposta processada com sucesso!');

    // FASE 2: Salvar resposta no cache para futuras consultas (TTL 1h)
    // (Escape detection jÃ¡ foi movido para ANTES do save/send â€” linhas ~7842)

    const shouldSkipCache = FALLBACK_PHRASES.some(phrase => 
      assistantMessage.toLowerCase().includes(phrase)
    );
    
    if (shouldSkipCache) {
      console.log('âš ï¸ [CACHE SKIP] Resposta de fallback detectada - NÃƒO cacheando');
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
        console.log('ðŸ’¾ [CACHE SAVED] Resposta salva no cache para reutilizaÃ§Ã£o');
      } catch (cacheError) {
        console.error('âš ï¸ [CACHE ERROR] Erro ao salvar no cache (nÃ£o bloqueante):', cacheError);
        // NÃ£o bloqueia a resposta se falhar o cache
      }
    }

    return new Response(JSON.stringify({ 
      status: 'success',
      message: assistantMessage,
      from_cache: false,
      // ðŸ†• INTENT EXIT: Sinalizar intent detectado para o webhook
      ...(detectedIntentTag ? { intentExit: true, intentType: detectedIntentTag, hasFlowContext: !!flow_context, flow_context: flow_context ? { flow_id: flow_context.flow_id, node_id: flow_context.node_id } : undefined } : {}),
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
      // ðŸš¨ FASE 3: IA FALHOU - Executar protocolo de emergÃªncia
      console.error('[ai-autopilot-chat] ðŸ”¥ FALHA CRÃTICA DA IA:', aiError);
      
      const errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      const errorStack = aiError instanceof Error ? aiError.stack : undefined;
      
      // ðŸ†• Detectar erro de quota vs erro tÃ©cnico real
      const isQuotaError = errorMessage.includes('QUOTA_ERROR') || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate_limit');
      
      if (isQuotaError) {
        // QUOTA ERROR: NÃƒO transferir, apenas avisar o cliente e manter na IA
        console.warn('[ai-autopilot-chat] âš ï¸ QUOTA_ERROR detectado â€” NÃƒO transferir, apenas avisar cliente');
        
        const quotaMessage = "Estou com alta demanda no momento. Por favor, tente novamente em alguns instantes. ðŸ™";
        
        // Salvar mensagem de aviso
        await supabaseClient.from('messages').insert({
          conversation_id: conversationId,
          content: quotaMessage,
          sender_type: 'user',
          sender_id: null,
          is_ai_generated: true,
          channel: responseChannel,
          status: 'sent'
        });
        
        // Se WhatsApp, enviar via Meta
        if (responseChannel === 'whatsapp' && contact?.phone && conversation) {
          try {
            const whatsappResult = await getWhatsAppInstanceWithProvider(
              supabaseClient,
              conversationId,
              conversation.whatsapp_instance_id,
              conversation.whatsapp_provider,
              conversation.whatsapp_meta_instance_id
            );
            if (whatsappResult && whatsappResult.provider === 'meta') {
              const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
              await supabaseClient.functions.invoke('send-meta-whatsapp', {
                body: {
                  instance_id: whatsappResult.instance.id,
                  phone_number: targetNumber,
                  message: quotaMessage,
                  conversation_id: conversationId,
                  skip_db_save: true,
                  is_bot_message: true
                }
              });
              console.log('[ai-autopilot-chat] âœ… Quota warning sent via Meta WhatsApp');
            }
          } catch (waErr) {
            console.error('[ai-autopilot-chat] âŒ Erro ao enviar aviso de quota via WhatsApp:', waErr);
          }
        }
        
        // Registrar no failure log mas SEM handoff
        await supabaseClient.from('ai_failure_logs').insert({
          conversation_id: conversationId,
          error_message: `QUOTA_ERROR: ${errorMessage}`,
          customer_message: customerMessage,
          contact_id: conversation?.contacts?.id,
          notified_admin: true
        });
        
        // Notificar admin sobre quota
        await supabaseClient.functions.invoke('send-admin-alert', {
          body: {
            type: 'ai_quota_warning',
            message: `âš ï¸ IA sem cota/saldo. Verifique o faturamento da API.`,
            error: errorMessage,
            conversationId
          }
        });
        
        return new Response(JSON.stringify({ 
          status: 'quota_error',
          message: quotaMessage,
          handoff_triggered: false,
          retry_suggested: true
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // ERRO TÃ‰CNICO REAL: protocolo de emergÃªncia
      // ðŸ›¡ï¸ FLOW SOVEREIGNTY: se hÃ¡ fluxo ativo, NÃƒO forÃ§ar copilot
      const hasActiveFlow = !!flow_context;
      
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
        
        console.log('[ai-autopilot-chat] ðŸ“ Falha registrada no log:', failureLog?.id);
        
        // 2. Escolher mensagem de fallback baseada no contexto
        const fallbackMessage = hasActiveFlow
          ? "Entendi! Poderia me dar mais detalhes sobre o que precisa? Estou aqui para ajudar."
          // âœ… FIX 2b: Removido 'Desculpe' que acionava o prÃ³prio detector de fallback
          : "Estou com instabilidade no momento. Pode tentar novamente em alguns instantes?";
        
        console.log(`[ai-autopilot-chat] ðŸ›¡ï¸ Flow sovereignty check: hasActiveFlow=${hasActiveFlow}, message=${hasActiveFlow ? 'retry' : 'handoff'}`);
        
        const { data: fallbackMsgData, error: fallbackSaveError } = await supabaseClient
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: fallbackMessage,
            sender_type: 'user',
            sender_id: null,
            is_ai_generated: true,
            channel: responseChannel,
            status: 'sending',
            is_bot_message: true
          })
          .select('id')
          .single();
        
        if (fallbackSaveError) {
          console.error('[ai-autopilot-chat] âŒ Falha ao salvar fallback no banco:', fallbackSaveError);
        } else {
          console.log('[ai-autopilot-chat] ðŸ’¬ Mensagem de fallback salva no banco:', fallbackMsgData?.id);
        }

        // 2b. Se WhatsApp, enviar via send-meta-whatsapp
        if (responseChannel === 'whatsapp' && contact?.phone && conversation) {
          try {
            const whatsappResult = await getWhatsAppInstanceWithProvider(
              supabaseClient,
              conversationId,
              conversation.whatsapp_instance_id,
              conversation.whatsapp_provider,
              conversation.whatsapp_meta_instance_id
            );

            if (whatsappResult && whatsappResult.provider === 'meta') {
              const targetNumber = extractWhatsAppNumber(contact.whatsapp_id) || contact.phone?.replace(/\D/g, '');
              
              await supabaseClient.functions.invoke('send-meta-whatsapp', {
                body: {
                  instance_id: whatsappResult.instance.id,
                  phone_number: targetNumber,
                  message: fallbackMessage,
                  conversation_id: conversationId,
                  skip_db_save: true,
                  is_bot_message: true
                }
              });

              if (fallbackMsgData?.id) {
                await supabaseClient
                  .from('messages')
                  .update({ status: 'sent' })
                  .eq('id', fallbackMsgData.id);
              }

              console.log('[ai-autopilot-chat] âœ… Fallback enviado via Meta WhatsApp');
            } else {
              console.warn('[ai-autopilot-chat] âš ï¸ Sem instÃ¢ncia Meta para enviar fallback');
            }
          } catch (waFallbackErr) {
            console.error('[ai-autopilot-chat] âŒ Erro ao enviar fallback via WhatsApp:', waFallbackErr);
          }
        }
        
        // 3. Handoff: SOMENTE se NÃƒO hÃ¡ fluxo ativo
        if (hasActiveFlow) {
          // ðŸ›¡ï¸ FLOW SOVEREIGNTY: manter autopilot, apenas atualizar last_message_at
          await supabaseClient
            .from('conversations')
            .update({ 
              last_message_at: new Date().toISOString()
            })
            .eq('id', conversationId);
          
          console.log('[ai-autopilot-chat] ðŸ›¡ï¸ Flow ativo preservado â€” ai_mode mantido como autopilot, sem handoff');
        } else {
          // Comportamento original: copilot + handoff para fila humana
          await supabaseClient
            .from('conversations')
            .update({ 
              ai_mode: 'copilot',
              department: conversation.department || '36ce66cd-7414-4fc8-bd4a-268fecc3f01a',
              last_message_at: new Date().toISOString()
            })
            .eq('id', conversationId);
          
          console.log('[ai-autopilot-chat] ðŸ¤ Handoff automÃ¡tico executado (ai_mode â†’ copilot)');
          
          // 4. Rotear conversa para departamento apropriado
          await supabaseClient.functions.invoke('route-conversation', {
            body: { conversationId }
          });
          
          console.log('[ai-autopilot-chat] ðŸ“® Conversa roteada para fila humana');
        }
        
        // 5. Notificar admin sobre a falha crÃ­tica
        const contactName = conversation?.contacts 
          ? `${conversation.contacts.first_name} ${conversation.contacts.last_name}`
          : 'Cliente nÃ£o identificado';
        
        await supabaseClient.functions.invoke('send-admin-alert', {
          body: {
            type: 'ai_failure',
            message: `IA falhou ao responder cliente ${contactName}${hasActiveFlow ? ' (fluxo preservado)' : ''}`,
            error: errorMessage,
            conversationId: conversationId,
            contactName: contactName
          }
        });
        
        console.log('[ai-autopilot-chat] ðŸ“§ Admin notificado sobre falha crÃ­tica');
        
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
        console.error('[ai-autopilot-chat] âŒ Erro no protocolo de recuperaÃ§Ã£o:', recoveryError);
      }
      
      // Retornar resposta indicando que houve fallback
      return new Response(JSON.stringify({ 
        status: 'fallback',
        message: hasActiveFlow 
          ? "Entendi! Poderia me dar mais detalhes sobre o que precisa? Estou aqui para ajudar."
          // âœ… FIX 2c: Removido 'Desculpe' que acionava o prÃ³prio detector de fallback
          : "Estou com instabilidade no momento. Pode tentar novamente em alguns instantes?",
        handoff_triggered: !hasActiveFlow,
        flow_context_preserved: hasActiveFlow,
        admin_notified: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[ai-autopilot-chat] Erro geral:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Detectar erro de quota e retornar mensagem especÃ­fica
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
  }; // fim rawHandler

  // Interceptor: garante Content-Type com charset=utf-8 em toda response
  const response = await rawHandler();
  const ct = response.headers.get('Content-Type') || '';
  if (ct.includes('application/json') && !ct.includes('charset')) {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  }
  return response;
});