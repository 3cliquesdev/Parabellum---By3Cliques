/**
 * useReplyChannel Hook
 * 
 * Hook para sugestão inteligente de canal de resposta.
 * Analisa a conversa e sugere o melhor canal para responder.
 * 
 * Estratégia:
 * 1. Padrão: responder no mesmo canal da última mensagem inbound
 * 2. Fallback: canal mais usado na conversa
 * 3. Se canal indisponível: sugerir alternativo
 */

import { useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;
type Conversation = Tables<"conversations">;

export type ChannelType = "whatsapp" | "web_chat" | "email" | "instagram";

export interface ChannelOption {
  channel: ChannelType;
  label: string;
  icon: string;
  isRecommended: boolean;
  isAvailable: boolean;
  reason?: string;
}

export interface ReplyChannelSuggestion {
  recommended: ChannelType;
  availableChannels: ChannelOption[];
  lastInboundChannel: ChannelType | null;
  channelMix: Record<ChannelType, number>;
}

const CHANNEL_CONFIG: Record<ChannelType, { label: string; icon: string }> = {
  whatsapp: { label: "WhatsApp", icon: "📱" },
  web_chat: { label: "Web Chat", icon: "💬" },
  email: { label: "E-mail", icon: "📧" },
  instagram: { label: "Instagram", icon: "📸" },
};

/**
 * Analisa mensagens e sugere o melhor canal de resposta
 */
export function useReplyChannel(
  messages: Message[] | undefined,
  conversation: Conversation | null,
  contactEmail?: string | null,
  contactPhone?: string | null
): ReplyChannelSuggestion {
  return useMemo(() => {
    const defaultSuggestion: ReplyChannelSuggestion = {
      recommended: conversation?.channel as ChannelType || "web_chat",
      availableChannels: [],
      lastInboundChannel: null,
      channelMix: { whatsapp: 0, web_chat: 0, email: 0, instagram: 0 },
    };

    if (!messages || messages.length === 0) {
      // Sem mensagens, usar canal da conversa
      const channel = (conversation?.channel as ChannelType) || "web_chat";
      return {
        ...defaultSuggestion,
        recommended: channel,
        availableChannels: buildAvailableChannels(channel, contactEmail, contactPhone),
      };
    }

    // Calcular mix de canais
    const channelMix: Record<ChannelType, number> = {
      whatsapp: 0,
      web_chat: 0,
      email: 0,
      instagram: 0,
    };

    messages.forEach((msg) => {
      const ch = msg.channel as ChannelType;
      if (ch && channelMix[ch] !== undefined) {
        channelMix[ch]++;
      }
    });

    // Encontrar última mensagem inbound (do cliente)
    // sender_type === "contact" ou sender_id === null indica mensagem do cliente
    const inboundMessages = messages.filter(
      (m) => (m.sender_type === "contact" || m.sender_id === null) && !m.is_internal
    );
    const lastInbound = inboundMessages[inboundMessages.length - 1];
    const lastInboundChannel = (lastInbound?.channel as ChannelType) || null;

    // Determinar canal recomendado
    let recommended: ChannelType = "web_chat";

    if (lastInboundChannel) {
      // Preferir o último canal usado pelo cliente
      recommended = lastInboundChannel;
    } else if (conversation?.channel) {
      // Fallback para canal da conversa
      recommended = conversation.channel as ChannelType;
    } else {
      // Fallback para canal mais usado
      const sortedChannels = Object.entries(channelMix).sort(
        ([, a], [, b]) => b - a
      );
      if (sortedChannels[0] && sortedChannels[0][1] > 0) {
        recommended = sortedChannels[0][0] as ChannelType;
      }
    }

    // Verificar disponibilidade e construir opções
    const availableChannels = buildAvailableChannels(
      recommended,
      contactEmail,
      contactPhone,
      channelMix
    );

    return {
      recommended,
      availableChannels,
      lastInboundChannel,
      channelMix,
    };
  }, [messages, conversation, contactEmail, contactPhone]);
}

/**
 * Constrói lista de canais disponíveis com status
 */
function buildAvailableChannels(
  recommended: ChannelType,
  contactEmail?: string | null,
  contactPhone?: string | null,
  channelMix?: Record<ChannelType, number>
): ChannelOption[] {
  const channels: ChannelOption[] = [];

  // WhatsApp - disponível se tem telefone
  const hasPhone = !!contactPhone;
  channels.push({
    channel: "whatsapp",
    label: CHANNEL_CONFIG.whatsapp.label,
    icon: CHANNEL_CONFIG.whatsapp.icon,
    isRecommended: recommended === "whatsapp",
    isAvailable: hasPhone,
    reason: hasPhone ? undefined : "Telefone não cadastrado",
  });

  // Email - disponível se tem email
  const hasEmail = !!contactEmail;
  channels.push({
    channel: "email",
    label: CHANNEL_CONFIG.email.label,
    icon: CHANNEL_CONFIG.email.icon,
    isRecommended: recommended === "email",
    isAvailable: hasEmail,
    reason: hasEmail ? undefined : "E-mail não cadastrado",
  });

  // Web Chat - sempre disponível (sessão ativa)
  channels.push({
    channel: "web_chat",
    label: CHANNEL_CONFIG.web_chat.label,
    icon: CHANNEL_CONFIG.web_chat.icon,
    isRecommended: recommended === "web_chat",
    isAvailable: true,
  });

  // Instagram - disponível se já teve mensagens nesse canal
  const hasInstagram = channelMix?.instagram && channelMix.instagram > 0;
  channels.push({
    channel: "instagram",
    label: CHANNEL_CONFIG.instagram.label,
    icon: CHANNEL_CONFIG.instagram.icon,
    isRecommended: recommended === "instagram",
    isAvailable: !!hasInstagram,
    reason: hasInstagram ? undefined : "Sem histórico no Instagram",
  });

  // Ordenar: recomendado primeiro, depois disponíveis, depois indisponíveis
  return channels.sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;
    return 0;
  });
}

/**
 * Retorna o ícone e label de um canal
 */
export function getChannelInfo(channel: ChannelType): { label: string; icon: string } {
  return CHANNEL_CONFIG[channel] || { label: channel, icon: "💬" };
}
