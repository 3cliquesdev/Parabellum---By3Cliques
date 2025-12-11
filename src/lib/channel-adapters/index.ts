/**
 * Channel Adapters - Index
 * Exporta todos os adapters e helpers
 */

export * from './types.ts';
export { WhatsAppAdapter, createWhatsAppAdapter } from './whatsapp-adapter.ts';
export { WebChatAdapter, createWebChatAdapter } from './webchat-adapter.ts';

import type { ChannelAdapter, AdapterConfig } from './types.ts';
import { createWhatsAppAdapter } from './whatsapp-adapter.ts';
import { createWebChatAdapter } from './webchat-adapter.ts';

/**
 * Factory para criar adapter baseado no provider
 */
export function createAdapter(provider: string, config: AdapterConfig): ChannelAdapter | null {
  switch (provider) {
    case 'whatsapp':
      return createWhatsAppAdapter(config);
    case 'web_chat':
      return createWebChatAdapter(config);
    // case 'email':
    //   return createEmailAdapter(config);
    // case 'instagram':
    //   return createInstagramAdapter(config);
    default:
      console.warn(`Adapter não implementado para: ${provider}`);
      return null;
  }
}
