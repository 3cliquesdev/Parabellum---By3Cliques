// ... keep existing code

// Helper: Buscar TODAS as configurações RAG do banco
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
    
    console.log('[getRAGConfig] ✅ Configuração RAG carregada:', {
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

// ... keep existing code

// ============================================================
// 🔧 HELPER: Extrair número limpo do whatsapp_id
// Prioriza whatsapp_id sobre phone para envio Meta API
// Formatos suportados:
//   - 5511999999999@s.whatsapp.net
//   - 5511999999999@c.us
//   - 5511999999999
// ============================================================
function extractWhatsAppNumber(whatsappId: string | null | undefined): string | null {
  if (!whatsappId) return null;
  
  // Se for número @lid (lead ID do Meta), retornar null - não é um número válido
  if (whatsappId.includes('@lid')) {
    console.log('[extractWhatsAppNumber] ⚠️ Lead ID detectado, ignorando:', whatsappId);
    return null;
  }
  
  // Remove sufixos do WhatsApp e caracteres não numéricos
  const cleaned = whatsappId
    .replace('@s.whatsapp.net', '')
    .replace('@c.us', '')
    .replace(/\D/g, '');
  
  // Validar se tem pelo menos 10 dígitos (número válido)
  if (cleaned.length >= 10) {
    return cleaned;
  }
  
  console.log('[extractWhatsAppNumber] ⚠️ Número inválido após limpeza:', { original: whatsappId, cleaned });
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

// ... keep existing code

// ============================================================
// 🆕 FASE 1: Truncar resposta ao máximo de frases permitido
// Enforce pós-processamento para garantir verbosidade controlada
// ============================================================
function limitSentences(text: string, maxSentences: number): string {
  // Separar por pontuação final (. ! ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length <= maxSentences) {
    return text;
  }
  
  // Truncar ao máximo permitido
  const truncated = sentences.slice(0, maxSentences).join(' ').trim();
  console.log(`[ai-autopilot-chat] ✂️ Resposta truncada de ${sentences.length} para ${maxSentences} frases`);
  
  return truncated;
}

// ============================================================
// 🆕 FASE 1: Log de violação de allowed_sources (não bloqueante)
// Registra quando a IA usa fontes não autorizadas para auditoria
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
    console.warn('[ai-autopilot-chat] ⚠️ SOURCE VIOLATION (não bloqueante):', {
      violations,
      allowedSources,
      responsePreview: response.substring(0, 100)
    });
  }
}

// ============================================================
// 🛡️ HELPER: Safe JSON parse para argumentos de tool calls do LLM
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
    // continuar para correções
  }
  
  // 4. Corrigir trailing commas antes de } ou ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  
  // 5. Tentar novamente
  try {
    return JSON.parse(cleaned);
  } catch (finalErr) {
    console.error('[safeParseToolArgs] ❌ Parse falhou mesmo após limpeza:', {
      original: rawArgs.substring(0, 200),
      cleaned: cleaned.substring(0, 200),
      error: finalErr instanceof Error ? finalErr.message : String(finalErr)
    });
    throw new Error(`Failed to parse tool arguments: ${finalErr instanceof Error ? finalErr.message : 'unknown'}`);
  }
}

// ============================================================
// 📢 HELPER: Formatar opções de múltipla escolha como texto
// Transforma array de opções em lista numerada com emojis
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
// 🆕 DETECTOR DE INTENÇÃO PARA PRESERVAÇÃO DE CONTEXTO
// Identifica a categoria da intenção original do cliente
// para recuperar contexto após verificação de email
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
  
  // Problema técnico
  if (/erro|bug|nao funciona|problema|travou|nao consigo|travar/.test(msgLower)) return 'technical';
  
  // Acesso/Login
  if (/senha|login|acesso|entrar|area.*membro|acessar/.test(msgLower)) return 'access';
  
  // Cobrança/Pagamento
  if (/cobranca|cobraram|pagamento|pagar|boleto|fatura/.test(msgLower)) return 'billing';
  
  return null; // Intenção genérica
}

// Helper: Traduzir categoria de intenção para texto amigável
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
// 🆕 EXTRATOR DE EMAIL TOLERANTE (WhatsApp-safe)
// Reconhece emails mesmo quando quebrados por newline/espaços
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
    console.log('[extractEmailTolerant] ✅ Email encontrado no texto ORIGINAL:', originalMatch[0]);
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
  
  // 2. Se não encontrou, tentar com texto COMPACTADO (remove espaços, newlines, tabs)
  const compactText = text.replace(/[\s\n\r\t]+/g, '');
  const compactMatch = compactText.match(emailRegex);
  
  if (compactMatch && compactMatch[0]) {
    console.log('[extractEmailTolerant] ✅ Email encontrado no texto COMPACTADO:', compactMatch[0]);
    console.log('[extractEmailTolerant] 🔍 Texto original tinha quebras:', text.substring(0, 100));
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
  console.log('[extractEmailTolerant] ❌ Nenhum email encontrado no texto:', text.substring(0, 100));
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
  useQueue: boolean = false,
  senderName?: string | null // 🆕 Nome do remetente para prefixar mensagem
): Promise<{ success: boolean; error?: any }> {
  try {
    if (whatsappResult.provider === 'meta') {
      // 🆕 CORREÇÃO: Priorizar whatsapp_id sobre phone
      const targetNumber = extractWhatsAppNumber(whatsappId) || phoneNumber?.replace(/\D/g, '');
      
      console.log('[sendWhatsAppMessage] 📤 Enviando via Meta WhatsApp API:', {
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
          phone_number: targetNumber, // 🆕 Usa whatsapp_id se disponível
          message,
          conversation_id: conversationId,
          skip_db_save: true, // 🆕 CRÍTICO: Quem chama já salvou a mensagem
          sender_name: senderName || undefined, // 🆕 Nome da persona/agente
          is_bot_message: true // 🆕 Mensagem de IA = bot message (não muda ai_mode)
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
      
      // 🆕 Para Evolution, prefixar manualmente a mensagem com nome em negrito
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
// ✅ FIX 1: FALLBACK_PHRASES reconstruída para NÃO conflitar com system prompt da persona.
// Removidas frases legítimas que a IA é instruída a dizer (ex: 'preciso verificar', 'não tenho certeza').
// Mantidas APENAS frases que indicam transferência real ou incapacidade total de ajudar.

// ... keep existing code

// 🔐 BARREIRA FINANCEIRA - Palavras que identificam contexto FINANCEIRO (sem OTP obrigatório)
// Estas palavras detectam intenção financeira mas NÃO exigem OTP

// ... keep existing code

// 🔐 OPERAÇÕES QUE EXIGEM OTP OBRIGATÓRIO (APENAS SAQUE DE SALDO/CARTEIRA)
// OTP é necessário APENAS quando cliente quer SACAR dinheiro da carteira
// Cancelamentos, reembolsos de pedidos Kiwify NÃO precisam de OTP
const OTP_REQUIRED_KEYWORDS = [
  // 🆕 Removidos 'saque' e 'sacar' isolados — termos ambíguos devem ser desambiguados pela IA
  // A detecção de saque composto já é coberta por WITHDRAWAL_ACTION_PATTERNS
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
// 🎯 SISTEMA ANTI-ALUCINAÇÃO - SCORE DE CONFIANÇA (Sprint 2)
// ============================================================

// ... keep existing code

// Thresholds - AGORA DINÂMICOS via getRAGConfig()
// Valores abaixo são FALLBACK apenas - a função calculateConfidenceScore usa config dinâmica

// ... keep existing code

// 🆕 Thresholds do MODO RAG ESTRITO (Anti-Alucinação) - mais conservador

// ... keep existing code

// 🆕 PADRÕES DE PEDIDO EXPLÍCITO DE ATENDENTE HUMANO
// SÓ fazer handoff automático se cliente usar essas frases

// ... keep existing code

// 🆕 Indicadores de incerteza/alucinação para validação pós-resposta

// ... keep existing code

// 🆕 Helper: Verificar handoff imediato - DESABILITADO
// IA NÃO faz mais handoff automático por keywords
function checkImmediateHandoff(query: string): { triggered: boolean; dept?: string; reason?: string } {
  // REMOVIDO: Handoff automático por keywords
  // Agora retorna sempre false - handoff só acontece se cliente PEDIR EXPLICITAMENTE
  return { triggered: false };
}

// Helper: Determinar departamento por keywords (OTIMIZADO com regex e prioridade)
// 🆕 ATUALIZADO: Retorna slugs que mapeiam para sub-departamentos específicos
function pickDepartment(question: string): string {
  // Normalizar: lowercase + remover acentos para matching consistente
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Ordem de prioridade: Financeiro > Técnico/Sistema > Pedidos/Logística > Comercial > Suporte Geral
  const rules: Array<{ dept: string; patterns: RegExp }> = [
    // Financeiro - maior prioridade
    { dept: 'financeiro', patterns: /saque|sacar|pix|reembolso|estorno|comiss[aã]o|pagamento|carteira|boleto|fatura|cobran[cç]a|saldo|recarga|transfer[eê]ncia.*banc|transf.*banc|valor de volta|dinheiro devolvido|reembolsado/ },
    // Suporte Sistema (técnico) - segunda maior prioridade
    { dept: 'suporte_sistema', patterns: /erro|bug|login|senha|acesso|n[aã]o funciona|travou|caiu|site fora|api|integra[cç][aã]o|token|sistema|nao funciona|num funciona|tela branca|pagina nao carrega|problema tecnico|suporte tecnico/ },
    // Suporte Pedidos (logística/rastreio) - terceira prioridade
    { dept: 'suporte_pedidos', patterns: /envio|entrega|rastreio|transportadora|correios|prazo|encomenda|coleta|endereco|cep|frete|pedido|onde.*pedido|status.*pedido|rastrear|devolu[cç][aã]o|devolver.*pedido|devolvido|devolvi|problema.*envio|envio incorreto|produto errado|cancelar.*pedido|transfer[eê]ncia.*endereco|transfer.*pedido/ },
    // Comercial - quarta prioridade
    { dept: 'comercial', patterns: /pre[cç]o|proposta|plano|quanto custa|comprar|assinar|desconto|trial|teste|orcamento|catalogo|tabela|upgrade|downgrade|mudar plano|conhecer|demonstra[cç][aã]o|demo/ },
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

// 🎯 FUNÇÃO PRINCIPAL: Calcular Score de Confiança (ATUALIZADA para thresholds dinâmicos)

// ... keep existing code

// Helper: Gerar prefixo de resposta baseado na confiança
function generateResponsePrefix(action: 'direct' | 'cautious' | 'handoff'): string {
  switch (action) {
    case 'direct':
      return ''; // Sem prefixo para respostas diretas
    case 'cautious':
      return ''; // Removido: prefixo cauteloso vazava metadados internos
    case 'handoff':
      return ''; // Handoff usa mensagem própria
  }
}

// Estrutura de log para métricas

// ... keep existing code

// 🆕 CONTRATO ANTI-ALUCINAÇÃO: flow_context obrigatório
// ============================================================
interface FlowContext {
  flow_id: string;
  node_id: string;
  node_type: 'ai_response';
  allowed_sources: ('kb' | 'crm' | 'tracking' | 'kiwify' | 'sandbox')[];
  response_format: 'text_only';
  personaId?: string;
  kbCategories?: string[];
  kbProductFilter?: string[];
  contextPrompt?: string;
  fallbackMessage?: string;
  // 🆕 FASE 1: Campos de Controle de Comportamento Anti-Alucinação
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

// 🆕 FASE 1: Função para gerar prompt RESTRITIVO baseado no flow_context
// Substitui o prompt extenso quando flow_context tem controles ativos
function generateRestrictedPrompt(flowContext: FlowContext, contactName: string, contactStatus: string, enrichment?: { orgName?: string | null; consultantName?: string | null; sellerName?: string | null; tags?: string[] }): string {
  const maxSentences = flowContext.maxSentences ?? 3;
  const objective = flowContext.objective || 'Responder a dúvida do cliente';

// ... keep existing code

// 🆕 ESCAPE PATTERNS: Detectar quando IA tenta sair do contrato (semântico, agrupado por intenção)
const ESCAPE_PATTERNS = [
  // Token explícito de saída (IA pediu exit limpo)
  /\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]/i,
  // Promessa de ação de transferência (vou/irei/posso + verbo)
  /(vou|irei|posso)\s+(te\s+)?(direcionar|redirecionar|transferir|encaminhar|conectar|passar)/i,
  // Ação em andamento (estou/estarei + gerúndio)
  /(estou|estarei)\s+(te\s+)?(direcionando|redirecionando|transferindo|encaminhando|conectando)/i,
  // Menção a humano/atendente com contexto de espera
  /\b(aguarde|só um instante).*(atendente|especialista|consultor)\b/i,
  // Chamar/acionar humano
  /\b(chamar|acionar).*(atendente|especialista|consultor)\b/i,
  // Menu de atendimento (caso específico)
  /menu\s+de\s+atendimento/i,
  // Opções numeradas (2+ emojis para evitar falso positivo com emoji isolado)
  /[1-9]️⃣.*[1-9]️⃣/s,
  // Menus textuais
  /escolha uma das opções/i,
  /selecione uma opção/i,
  // Menus textuais com numeração (1) ... 2) ...)
  /\b1[\)\.\-][\s\S]*?\b2[\)\.\-]/i,
];

// ... keep existing code

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
3. NUNCA mencione o titulo do documento nem diga "De acordo com o artigo".
4. Responda de forma NATURAL e AMIGÁVEL, como se estivesse conversando no WhatsApp.
5. Se houver passo a passo, simplifique com tópicos ou emojis.
6. Mantenha respostas concisas (máximo 150 palavras)
7. Seja direto e objetivo

DOCUMENTOS DISPONÍVEIS:
${highConfidenceArticles.map((a: any) => `### Referencia Base
${a.content}`).join('\n\n---\n\n')}`;

// ... keep existing code

    // FASE 3 & 4: Identity Wall + Diferenciação Cliente vs Lead
    let identityWallNote = '';
    
    // Detectar se é a primeira mensagem pós-verificação (FASE 3)
    const isRecentlyVerified = customer_context?.isVerified === true;
    
    // Detectar se é contexto financeiro na mensagem atual
    const isFinancialContext = FINANCIAL_ACTION_PATTERNS.some(p => p.test(customerMessage));
    
    // ============================================================
    // 🎯 TRIAGEM VIA MASTER FLOW
    // A triagem (saudação, menu, coleta de email) é feita 100% pelo 
    // Master Flow visual processado via process-chat-flow
    // Código de triagem legada foi REMOVIDO - não duplicar aqui!
    // ============================================================
    
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

// ... keep existing code

    // 🆕 CORREÇÃO: Só pedir email se NÃO for cliente conhecido pelo telefone
    console.log('[ai-autopilot-chat] 🔍 Identity Wall gate:', {
      contactHasEmail,
      isPhoneVerified,
      isCustomerInDatabase,
      isKiwifyValidated,
      channel: responseChannel,
      hasFlowContext: !!flow_context,
      willBypass: !!flow_context,
    });
    if (!contactHasEmail && !isPhoneVerified && !isCustomerInDatabase && !isKiwifyValidated && responseChannel === 'whatsapp' && !flow_context) {
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
   - OTP só será pedido se cliente solicitar SAQUE DE SALDO

**IMPORTANTE:** NÃO atenda dúvidas técnicas até o email ser verificado na base.`;
    } else if (isPhoneVerified && !contactHasEmail && !isKiwifyValidated) {
      // 🆕 Cliente identificado pelo telefone (sem email) - atendimento normal, sem pedir email
      console.log('[ai-autopilot-chat] ✅ Cliente identificado por telefone - bypass Identity Wall');
    }
    
    // 🔐 PORTEIRO DE SAQUE ATIVADO (apenas para saque de saldo/carteira)
    if (financialBarrierActive) {
      // Verificar se cliente já foi identificado por email (novo fluxo)
      const hasEmailVerifiedInDb = conversation.customer_metadata?.email_verified_in_db === true;
      const verifiedEmail = conversation.customer_metadata?.verified_email;
      
      if (contactHasEmail || hasEmailVerifiedInDb) {
        const emailToUse = contactEmail || verifiedEmail;
        const maskedEmailForPrompt = emailToUse ? maskEmail(emailToUse) : 'seu email cadastrado';
        
        // Cenário: Cliente identificado por email → Precisa OTP para SAQUE
        identityWallNote += `\n\n**=== PORTEIRO DE SAQUE - VERIFICAÇÃO OTP OBRIGATÓRIA ===**
O cliente solicitou SAQUE DE SALDO (${customerMessage}).
Email verificado: ${maskedEmailForPrompt}

**RESPOSTA OBRIGATÓRIA:**
"Para sua segurança, preciso confirmar sua identidade antes de prosseguir com o saque. 
Vou enviar um código de verificação para ${maskedEmailForPrompt}."

→ Use a ferramenta send_financial_otp para disparar o OTP
→ NÃO mostre CPF, Nome, Saldo ou qualquer dado sensível
→ NÃO permita criar ticket de saque
→ AGUARDE o cliente digitar o código de 6 dígitos`;
      } else {
        // Cenário: Não tem email → Pedir email primeiro
        identityWallNote += `\n\n**=== PORTEIRO DE SAQUE - IDENTIFICAÇÃO OBRIGATÓRIA ===**
O cliente solicitou SAQUE mas NÃO ESTÁ IDENTIFICADO.

**RESPOSTA OBRIGATÓRIA:**
"Para sua segurança, preciso validar seu cadastro antes de prosseguir com o saque. 
Qual é o seu **email de cadastro**?"

→ AGUARDE o cliente informar o email
→ NÃO fale de valores, prazos ou processos
→ NÃO crie ticket
→ PARE AQUI até identificação completa`;
      }
    }
    
    // 🆕 HANDLER PARA REEMBOLSO (SEM OTP)
    // NÃO injetar quando já está no nó financeiro (o objetivo do nó já cuida da coleta de dados e criação de ticket)
    const isInFinanceiroNode = flow_context?.currentNodeId?.includes('financeiro');
    if (isRefundRequest && !isWithdrawalRequest && !isInFinanceiroNode) {
      console.log('[ai-autopilot-chat] 📦 Detectado pedido de REEMBOLSO - sem OTP necessário');
      
      identityWallNote += `\n\n**=== REEMBOLSO DE PEDIDO (SEM OTP) ===**
O cliente está perguntando sobre reembolso de um pedido Kiwify.

**EXPLICAÇÃO A DAR:**
- Reembolsos são processados automaticamente quando o pedido retorna ao galpão
- O cliente NÃO precisa ficar cobrando, o processo é automático
- Se o cliente INSISTIR que o reembolso não foi feito, aí sim ofereça transferir para humano

**NÃO PEÇA OTP** para esta situação.`;
    }
    
    // 🆕 HANDLER PARA CANCELAMENTO (SEM OTP)
    if (isCancellationRequest && !isWithdrawalRequest) {
      console.log('[ai-autopilot-chat] ❌ Detectado pedido de CANCELAMENTO - sem OTP necessário');
      
      identityWallNote += `\n\n**=== CANCELAMENTO DE ASSINATURA (SEM OTP) ===**
O cliente quer cancelar a assinatura Kiwify.

**PROCESSO:**
- Oriente o cliente sobre como cancelar na plataforma Kiwify
- NÃO precisa de OTP para cancelamento
- Se precisar de ajuda adicional, ofereça transferir para humano

**NÃO PEÇA OTP** para esta situação.`;
    }
    
    if (!identityWallNote) {
      identityWallNote = `\n\n**IMPORTANTE:** Este é um cliente já verificado. Cumprimente-o pelo nome (${contactName}) de forma calorosa. NÃO peça email ou validação.

${isRecentlyVerified ? '**⚠️ CLIENTE RECÉM-VERIFICADO:** Esta é a primeira mensagem pós-verificação. Não fazer handoff automático. Seja acolhedor e pergunte "Como posso te ajudar?".' : ''}`;
    }
    
    // 🛈 DEBUG: Confirmar que priorityInstruction está sendo gerada
    console.log('[ai-autopilot-chat] 📣 Priority Instruction:', priorityInstruction ? 'SET ✅' : 'EMPTY ❌');
    
    // 🎯 INSTRUÇÃO ANTI-ALUCINAÇÃO - IA SEMPRE tenta responder, NÃO transfere automaticamente
    const antiHallucinationInstruction = `

**🚫 REGRA CRÍTICA ANTI-TRANSFERÊNCIA AUTOMÁTICA:**
Você NÃO PODE transferir para atendente humano automaticamente por "baixa confiança" ou "não ter informação".
SÓ transfira se o cliente PEDIR EXPLICITAMENTE com frases como:
- "Quero falar com um atendente"
- "Preciso de um humano"
- "Chama alguém para me ajudar"
- "Transferir para suporte"

SE você não tiver informação sobre o assunto:
1. TENTE responder com o que você sabe da base de conhecimento
2. Se não tiver NADA, responda: "Não encontrei essa informação específica na minha base. Pode me dar mais detalhes sobre o que precisa?"
3. NUNCA diga "vou te transferir" ou "vou chamar um especialista" sem o cliente pedir
4. SEMPRE pergunte se pode ajudar de outra forma ANTES de sugerir transferência

**COMPORTAMENTO ESPERADO:**
- Cliente pergunta algo → IA tenta responder com KB
- IA não encontra na KB → IA pede mais detalhes ou oferece outras opções
- Cliente INSISTE ou PEDE humano → Só então transfere

**PROIBIDO:**
- Transferir automaticamente por score baixo
- Dizer "vou chamar um especialista" sem cliente pedir
- Abandonar cliente sem tentar ajudar
`;

// ... keep existing code

    // 🆕 BUSINESS HOURS: Injetar consciência de horário no prompt
    const businessHoursPrompt = businessHoursInfo ? (
      businessHoursInfo.within_hours
        ? `\n**🕐 HORÁRIO COMERCIAL:** Aberto agora até ${businessHoursInfo.today_close_time}.\n`
        : `\n**🕐 HORÁRIO COMERCIAL:** Fora do expediente. Próxima abertura: ${businessHoursInfo.next_open_text}. Horário: ${businessHoursInfo.schedule_summary}.\nREGRA: Tente resolver sozinha. Se não conseguir e o cliente pedir humano, use request_human_agent — o sistema cuidará do restante (registrará a pendência para o próximo expediente).\n`
    ) : '';

    // 🔒 TRAVA FINANCEIRA: Injetar instruções diretamente no prompt da LLM

// ... keep existing code

    // 🚫 TRAVA CANCELAMENTO: Injetar instruções diretamente no prompt da LLM

// ... keep existing code

    // 🛒 TRAVA COMERCIAL: Injetar instruções diretamente no prompt da LLM

// ... keep existing code

    // 💼 TRAVA CONSULTOR: Injetar instruções diretamente no prompt da LLM

// ... keep existing code
