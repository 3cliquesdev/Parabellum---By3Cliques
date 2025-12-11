/**
 * WhatsApp Channel Adapter
 * Normaliza eventos do Evolution API para o formato unificado
 */

import type { 
  ChannelAdapter, 
  ChannelAdapterEvent, 
  NormalizedMessage,
  AdapterConfig 
} from './types.ts';
import { normalizePhoneE164, mimeToContentType } from './types.ts';

export class WhatsAppAdapter implements ChannelAdapter {
  provider = 'whatsapp';
  private config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  parseInbound(rawEvent: unknown): ChannelAdapterEvent | null {
    const event = rawEvent as Record<string, unknown>;
    
    // Evolution API envia diferentes tipos de eventos
    const eventType = event.event as string;
    
    // Processar apenas mensagens recebidas
    if (eventType !== 'messages.upsert') {
      return null;
    }

    const data = event.data as Record<string, unknown>;
    const message = data?.message as Record<string, unknown>;
    const key = data?.key as Record<string, unknown>;
    
    if (!message || !key) return null;

    // Ignorar mensagens enviadas pelo próprio sistema
    if (key.fromMe === true) return null;

    const remoteJid = key.remoteJid as string;
    const phone = this.extractPhone(remoteJid);
    
    // Determinar tipo de conteúdo
    let text: string | undefined;
    let mediaUrl: string | undefined;
    let mediaType: 'image' | 'audio' | 'video' | 'document' | undefined;

    if (message.conversation) {
      text = message.conversation as string;
    } else if (message.extendedTextMessage) {
      text = (message.extendedTextMessage as Record<string, unknown>).text as string;
    } else if (message.imageMessage) {
      mediaType = 'image';
      text = (message.imageMessage as Record<string, unknown>).caption as string;
      mediaUrl = (message.imageMessage as Record<string, unknown>).url as string;
    } else if (message.audioMessage) {
      mediaType = 'audio';
      mediaUrl = (message.audioMessage as Record<string, unknown>).url as string;
    } else if (message.videoMessage) {
      mediaType = 'video';
      text = (message.videoMessage as Record<string, unknown>).caption as string;
      mediaUrl = (message.videoMessage as Record<string, unknown>).url as string;
    } else if (message.documentMessage) {
      mediaType = 'document';
      text = (message.documentMessage as Record<string, unknown>).caption as string;
      mediaUrl = (message.documentMessage as Record<string, unknown>).url as string;
    }

    // Nome do remetente
    const pushName = data.pushName as string || 'Desconhecido';

    return {
      provider: 'whatsapp',
      externalMsgId: key.id as string,
      direction: 'inbound',
      payload: {
        text,
        mediaUrl,
        mediaType,
        from: {
          phoneE164: phone,
          name: pushName
        },
        to: {
          phoneE164: this.config.instanceId // Número do WhatsApp Business
        },
        metadata: {
          instanceId: event.instance,
          remoteJid,
          messageType: this.detectMessageType(message)
        }
      },
      receivedAt: new Date().toISOString(),
      rawEvent
    };
  }

  formatOutbound(message: NormalizedMessage): unknown {
    const basePayload = {
      number: message.content.text ? undefined : undefined, // Será preenchido pelo caller
      delay: 1000,
      linkPreview: true
    };

    // Mensagem de texto simples
    if (message.contentType === 'text' && message.content.text) {
      return {
        ...basePayload,
        text: message.content.text
      };
    }

    // Mensagem com mídia
    if (message.content.mediaId) {
      return {
        ...basePayload,
        mediatype: message.contentType,
        media: message.content.mediaId, // URL presigned
        caption: message.content.text
      };
    }

    return basePayload;
  }

  verifySignature(headers: Record<string, string>, body: string): boolean {
    // Evolution API pode usar diferentes métodos de verificação
    const signature = headers['x-hub-signature-256'] || headers['x-evolution-signature'];
    
    if (!signature || !this.config.webhookSecret) {
      return true; // Se não configurado, aceita (não recomendado em produção)
    }

    // TODO: Implementar verificação HMAC SHA-256
    return true;
  }

  private extractPhone(remoteJid: string): string | undefined {
    if (!remoteJid) return undefined;
    
    // Format: 5511999999999@s.whatsapp.net ou 5511999999999@g.us (grupos)
    const match = remoteJid.match(/^(\d+)@/);
    if (match) {
      return normalizePhoneE164(match[1]);
    }
    return undefined;
  }

  private detectMessageType(message: Record<string, unknown>): string {
    if (message.conversation) return 'text';
    if (message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.audioMessage) return 'audio';
    if (message.videoMessage) return 'video';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    if (message.locationMessage) return 'location';
    if (message.contactMessage) return 'contact';
    return 'unknown';
  }
}

// Factory function
export function createWhatsAppAdapter(config: AdapterConfig): WhatsAppAdapter {
  return new WhatsAppAdapter(config);
}
