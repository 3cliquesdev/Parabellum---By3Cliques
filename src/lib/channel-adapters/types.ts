/**
 * Sprint 5: Channel Adapters - Tipos e Interfaces
 * Sistema unificado de normalização de eventos de múltiplos canais
 */

// Evento normalizado de entrada de qualquer canal
export interface ChannelAdapterEvent {
  provider: 'whatsapp' | 'web_chat' | 'email' | 'instagram';
  externalMsgId: string;
  direction: 'inbound' | 'outbound';
  payload: ChannelPayload;
  receivedAt: string;
  rawEvent?: unknown; // Evento original para debug
}

export interface ChannelPayload {
  // Conteúdo
  text?: string;
  html?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  
  // Identificadores de origem
  from?: IdentityHints;
  to?: IdentityHints;
  
  // Metadados específicos de canal
  subject?: string; // Email
  threadKey?: string; // Para agrupar em conversas
  replyTo?: string; // ID da mensagem sendo respondida
  
  // Status
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  
  // Metadados adicionais
  metadata?: Record<string, unknown>;
}

// Dicas para resolução de identidade
export interface IdentityHints {
  phoneE164?: string; // +5511999999999
  email?: string;
  socialId?: string; // ID do Instagram, etc.
  name?: string;
  avatarUrl?: string;
}

// Mensagem normalizada para armazenamento
export interface NormalizedMessage {
  conversationId: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  externalMsgId?: string;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'file' | 'system';
  content: MessageContent;
  isInternal: boolean;
  isAiGenerated: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  timestamp: string;
}

export interface MessageContent {
  text?: string;
  html?: string;
  mediaId?: string;
  subject?: string;
  note?: string;
}

// Resultado da resolução de identidade
export interface IdentityResolution {
  contactId: string;
  isNewContact: boolean;
  matchedBy: 'phone' | 'email' | 'socialId' | 'created';
  confidence: number;
}

// Resultado da resolução de conversa
export interface ConversationResolution {
  conversationId: string;
  isNewConversation: boolean;
  topic?: string;
}

// Interface do Adapter
export interface ChannelAdapter {
  provider: string;
  
  // Parsear evento raw do webhook
  parseInbound(rawEvent: unknown): ChannelAdapterEvent | null;
  
  // Formatar mensagem para envio
  formatOutbound(message: NormalizedMessage): unknown;
  
  // Verificar assinatura do webhook
  verifySignature?(headers: Record<string, string>, body: string): boolean;
}

// Configuração do adapter
export interface AdapterConfig {
  provider: string;
  apiKey?: string;
  webhookSecret?: string;
  baseUrl?: string;
  instanceId?: string;
}

// Evento de status de entrega
export interface DeliveryStatusEvent {
  provider: string;
  externalMsgId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  error?: string;
}

// Pipeline de processamento
export interface ProcessingPipeline {
  // Etapas do pipeline
  normalize(event: ChannelAdapterEvent): NormalizedMessage;
  resolveIdentity(hints: IdentityHints): Promise<IdentityResolution>;
  resolveConversation(contactId: string, topic?: string): Promise<ConversationResolution>;
  storeMessage(message: NormalizedMessage): Promise<string>;
  updateInboxView(conversationId: string): Promise<void>;
  publishRealtime(conversationId: string, message: NormalizedMessage): Promise<void>;
  
  // Pipeline completo
  process(event: ChannelAdapterEvent): Promise<{ messageId: string; conversationId: string }>;
}

// Mapeamento de MIME types para contentType
export function mimeToContentType(mime?: string): 'text' | 'image' | 'audio' | 'video' | 'file' {
  if (!mime) return 'text';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

// Helper para extrair telefone E.164
export function normalizePhoneE164(phone?: string): string | undefined {
  if (!phone) return undefined;
  
  // Remove tudo exceto números e +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Se não começa com +, assume Brasil (+55)
  if (!cleaned.startsWith('+')) {
    // Se começa com 55, adiciona +
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      cleaned = '+' + cleaned;
    } else {
      // Adiciona +55
      cleaned = '+55' + cleaned;
    }
  }
  
  return cleaned;
}

// Helper para extrair email válido
export function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const normalized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized) ? normalized : undefined;
}
