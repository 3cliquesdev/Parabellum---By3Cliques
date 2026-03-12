import { useMemo, useCallback } from "react";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { InternalNoteMessage } from "@/components/InternalNoteMessage";
import { StreamingMessage } from "@/components/inbox/StreamingMessage";
import { useMediaUrls } from "@/hooks/useMediaUrls";
import type { Tables } from "@/integrations/supabase/types";

type Contact = Tables<"contacts"> & {
  organizations: Tables<"organizations"> | null;
};

type Conversation = Tables<"conversations">;

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_type: string;
  is_ai_generated: boolean;
  is_internal: boolean;
  attachment_url?: string | null;
  attachment_type?: string | null;
  status?: string;
  metadata?: Record<string, any> | null;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
  } | null;
  media_attachments?: Array<{
    id: string;
    status: string;
    storage_bucket: string;
    storage_path: string;
    mime_type: string;
    original_filename?: string;
    file_size?: number;
    waveform_data?: any;
    duration_seconds?: number;
  }>;
}

interface MessagesWithMediaProps {
  messages: Message[];
  contact: Contact | null | undefined;
  conversation: Conversation;
  isAdmin: boolean;
  isManager: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

// Helper: Extrair MIME type do attachment_type
function getMimeFromType(attachmentType?: string | null): string {
  switch (attachmentType) {
    case 'image':
      return 'image/jpeg';
    case 'audio':
      return 'audio/ogg';
    case 'video':
      return 'video/mp4';
    case 'document':
      return 'application/pdf';
    case 'sticker':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

// Helper: Extrair filename de URL
function extractFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop() || 'media';
  } catch {
    return 'media';
  }
}

export function MessagesWithMedia({
  messages,
  contact,
  conversation,
  isAdmin,
  isManager,
  messagesEndRef,
}: MessagesWithMediaProps) {
  // Extrair todos os attachments prontos de todas as mensagens
  const allAttachments = useMemo(() => {
    const attachments: Array<{
      id: string;
      storage_bucket: string;
      storage_path: string;
      mime_type: string;
      original_filename?: string;
      file_size?: number;
      waveform_data?: any;
      duration_seconds?: number;
    }> = [];

    messages.forEach(msg => {
      if (msg.media_attachments) {
        msg.media_attachments
          .filter(a => a.status === 'ready' && a.storage_bucket && a.storage_path)
          .forEach(a => attachments.push(a));
      }
    });

    return attachments;
  }, [messages]);

  // Carregar signed URLs para todos os attachments
  const { urls: mediaUrls, isLoading: mediaLoading, getUrl, retryLoad } = useMediaUrls(allAttachments);

  // Função de retry wrapper
  const handleRetry = useCallback((attachmentId: string) => {
    retryLoad(attachmentId);
  }, [retryLoad]);

  // Detectar separador de teste para aplicar borda amarela nas mensagens seguintes
  const testSeparatorIndex = useMemo(() => {
    // Encontrar o ÚLTIMO separador de teste para destacar apenas as mensagens mais recentes
    for (let i = messages.length - 1; i >= 0; i--) {
      if (
        messages[i].sender_type === 'system' &&
        messages[i].content?.includes('TESTE DE FLUXO INICIADO')
      ) {
        return i;
      }
    }
    return -1;
  }, [messages]);

  return (
    <div className="space-y-4 py-3">
      {messages.map((message, index) => {
        const isCustomer = message.sender_type === 'contact';
        const isSystem = message.sender_type === 'system';
        // 🆕 Mensagens com flow_id no metadata são do bot (mesmo sem is_ai_generated)
        const hasFlowMetadata = !!(message.metadata?.flow_id || message.metadata?.flow_name);
        const isAI = message.is_ai_generated || hasFlowMetadata;
        const isInternalNote = message.is_internal;
        const isInTestZone = testSeparatorIndex >= 0 && index > testSeparatorIndex;
        
        // Parse AI debug metadata
        let usedArticles: any[] = [];
        try {
          if (isAI && message.attachment_url) {
            const metadata = JSON.parse(message.attachment_url);
            usedArticles = metadata.used_articles || [];
          }
        } catch (e) {
          // Ignore parse errors
        }

        // Mapear attachments COM estados de erro/loading (não filtrar!)
        let attachments = (message.media_attachments || [])
          .filter(a => a.status === 'ready' && a.storage_bucket && a.storage_path)
          .map(a => {
            const urlResult = getUrl(a.id);
            const hasError = urlResult?.error;
            const hasUrl = urlResult?.url;
            const isLoadingUrl = !urlResult && mediaLoading;
            
            return {
              id: a.id,
              url: urlResult?.url || '',
              mimeType: urlResult?.mimeType || a.mime_type,
              filename: urlResult?.filename || a.original_filename,
              size: urlResult?.size || a.file_size,
              waveformData: urlResult?.waveformData || a.waveform_data,
              durationSeconds: urlResult?.durationSeconds || a.duration_seconds,
              error: hasError ? urlResult.error : undefined,
              isLoading: isLoadingUrl || (!hasUrl && !hasError),
              onRetry: hasError ? () => handleRetry(a.id) : undefined,
            };
          });

        // FALLBACK: Se não tem media_attachments mas tem attachment_url direto
        // Isso cobre mídias Meta que falharam ao criar registro ou mídias antigas
        if (attachments.length === 0 && message.attachment_url && !isAI) {
          // Verificar se é uma URL válida (não é JSON de metadata AI)
          const isValidUrl = message.attachment_url.startsWith('http');
          if (isValidUrl) {
            // Detectar tipo de mídia pela URL ou attachment_type
            const mimeType = getMimeFromType((message as any).attachment_type);
            const filename = extractFilename(message.attachment_url);
            
            attachments = [{
              id: `fallback-${message.id}`,
              url: message.attachment_url,
              mimeType,
              filename,
              size: undefined,
              waveformData: undefined,
              durationSeconds: undefined,
              error: undefined,
              isLoading: false,
              onRetry: undefined,
            }];
          }
        }

        // Renderizar notas internas com estilo especial
        if (isInternalNote) {
          return (
            <InternalNoteMessage
              key={message.id}
              content={message.content}
              createdAt={message.created_at}
              senderName={message.sender?.full_name}
            />
          );
        }

        if (isSystem) {
          return (
            <div key={message.id} className="flex justify-center py-3">
              <div className="bg-muted/50 px-4 py-2 rounded-full">
                <p className="text-xs text-muted-foreground text-center">
                  📢 {message.content}
                </p>
              </div>
            </div>
          );
        }

        // 🚀 Renderizar mensagem em streaming (IA gerando resposta)
        if (message.status === 'streaming' && isAI) {
          return (
            <StreamingMessage
              key={message.id}
              content={message.content}
              isStreaming={true}
            />
          );
        }

        // Extrair erro do metadata para tooltip
        let errorDetail: string | undefined;
        if (message.status === 'failed' && message.metadata) {
          const meta = message.metadata;
          if (meta.error_title) {
            errorDetail = meta.error_code 
              ? `${meta.error_title} (${meta.error_code})`
              : meta.error_title;
          } else if (meta.error_code) {
            errorDetail = `Erro ${meta.error_code}`;
          }
        }

        // Extrair flow_name do metadata para badge
        const flowName = message.metadata?.flow_name as string | undefined;

        return (
          <div key={message.id} className={isInTestZone ? "border-l-2 border-amber-400 pl-2" : undefined}>
            <MessageBubble
              content={message.content}
              createdAt={message.created_at}
              isCustomer={isCustomer}
              isAI={isAI}
              sender={message.sender ? {
                id: message.sender.id,
                full_name: message.sender.full_name,
                avatar_url: message.sender.avatar_url || null,
                job_title: message.sender.job_title || null,
              } : null}
              contactInitials={`${contact?.first_name?.[0] || ''}${contact?.last_name?.[0] || ''}`}
              channel={conversation.channel}
              showChannel={false}
              status={message.status as "sending" | "sent" | "delivered" | "read" | "failed" | undefined}
              errorDetail={errorDetail}
              usedArticles={usedArticles}
              isAdmin={isAdmin}
              isManager={isManager}
              attachments={attachments}
            />
            {flowName && (
              <p className="text-[10px] text-muted-foreground mt-0.5 ml-10 opacity-70">
                🔧 {flowName}
              </p>
            )}
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
