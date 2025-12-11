/**
 * WebChat Channel Adapter
 * Normaliza eventos do chat web embeddable para o formato unificado
 */

import type { 
  ChannelAdapter, 
  ChannelAdapterEvent, 
  NormalizedMessage,
  AdapterConfig 
} from './types.ts';
import { normalizeEmail, mimeToContentType } from './types.ts';

export class WebChatAdapter implements ChannelAdapter {
  provider = 'web_chat';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parseInbound(rawEvent: unknown): ChannelAdapterEvent | null {
    const event = rawEvent as Record<string, unknown>;
    
    // Estrutura esperada do WebChat
    const message = event.message as Record<string, unknown>;
    const session = event.session as Record<string, unknown>;
    const visitor = event.visitor as Record<string, unknown>;
    
    if (!message) return null;

    const messageId = message.id as string || crypto.randomUUID();
    const text = message.text as string;
    const attachments = message.attachments as Array<Record<string, unknown>> || [];

    // Determinar tipo de conteúdo
    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'audio' | 'video' | 'document' | undefined;

    if (attachments.length > 0) {
      const firstAttachment = attachments[0];
      mediaUrl = firstAttachment.url as string;
      const mime = firstAttachment.mimeType as string;
      mediaType = mimeToContentType(mime) as typeof mediaType;
    }

    return {
      provider: 'web_chat',
      externalMsgId: messageId,
      direction: 'inbound',
      payload: {
        text,
        mediaUrl,
        mediaType,
        from: {
          email: normalizeEmail(visitor?.email as string),
          name: visitor?.name as string || 'Visitante',
          socialId: session?.visitorId as string
        },
        threadKey: session?.conversationId as string,
        metadata: {
          sessionToken: session?.token as string,
          pageUrl: session?.pageUrl as string,
          userAgent: session?.userAgent as string,
          referrer: session?.referrer as string
        }
      },
      receivedAt: new Date().toISOString(),
      rawEvent
    };
  }

  formatOutbound(message: NormalizedMessage): unknown {
    return {
      id: crypto.randomUUID(),
      conversationId: message.conversationId,
      content: message.content.text,
      sender: {
        type: message.isAiGenerated ? 'ai' : 'agent',
        name: message.isAiGenerated ? 'Assistente Virtual' : 'Agente'
      },
      timestamp: message.timestamp,
      attachments: message.content.mediaId ? [{
        type: message.contentType,
        url: message.content.mediaId
      }] : []
    };
  }

  verifySignature(headers: Record<string, string>, body: string): boolean {
    // WebChat usa session token para autenticação
    const sessionToken = headers['x-session-token'];
    return !!sessionToken;
  }
}

// Factory function
export function createWebChatAdapter(config: AdapterConfig): WebChatAdapter {
  return new WebChatAdapter(config);
}
