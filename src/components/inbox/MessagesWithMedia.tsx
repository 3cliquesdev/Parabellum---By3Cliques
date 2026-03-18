import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { displayInitials } from "@/lib/displayName";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { InternalNoteMessage } from "@/components/InternalNoteMessage";
import { StreamingMessage } from "@/components/inbox/StreamingMessage";
import { useMediaUrls } from "@/hooks/useMediaUrls";
import { useRetryMessage } from "@/hooks/useRetryMessage";
import { supabase } from "@/integrations/supabase/client";
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
  /** Tick counter from parent — forces re-render for relative timestamps */
  _tick?: number;
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

// Helper: Parse storage: reference → { bucket, path }
function parseStorageRef(ref: string): { bucket: string; path: string } | null {
  if (!ref.startsWith('storage:')) return null;
  const rest = ref.slice('storage:'.length); // "chat-attachments/path/to/file"
  const slashIdx = rest.indexOf('/');
  if (slashIdx === -1) return null;
  return { bucket: rest.slice(0, slashIdx), path: rest.slice(slashIdx + 1) };
}

/**
 * Hook to resolve multiple storage: prefixed URLs to signed URLs
 * Only activates for messages with storage: attachment_url but no media_attachments
 */
function useStorageUrlsResolver(refs: Map<string, string>) {
  // Map<messageId, { url, error, isLoading }>
  const [resolved, setResolved] = useState<Map<string, { url: string | null; error: string | null; isLoading: boolean }>>(new Map());
  const resolvedRefsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toResolve: Array<{ msgId: string; ref: string }> = [];
    refs.forEach((ref, msgId) => {
      if (!resolvedRefsRef.current.has(msgId)) {
        toResolve.push({ msgId, ref });
      }
    });

    if (toResolve.length === 0) return;

    // Mark as processing
    toResolve.forEach(({ msgId }) => resolvedRefsRef.current.add(msgId));

    // Set loading states
    setResolved(prev => {
      const next = new Map(prev);
      toResolve.forEach(({ msgId }) => {
        next.set(msgId, { url: null, error: null, isLoading: true });
      });
      return next;
    });

    // Resolve all in parallel
    Promise.all(
      toResolve.map(async ({ msgId, ref }) => {
        const parsed = parseStorageRef(ref);
        if (!parsed) return { msgId, url: null, error: 'Invalid storage reference' };

        const { data, error } = await supabase.storage
          .from(parsed.bucket)
          .createSignedUrl(parsed.path, 3600);

        if (error || !data?.signedUrl) {
          console.warn(`[useStorageUrlsResolver] Failed for ${msgId}:`, error?.message);
          resolvedRefsRef.current.delete(msgId); // Allow retry
          return { msgId, url: null, error: error?.message || 'Failed to resolve' };
        }

        return { msgId, url: data.signedUrl, error: null };
      })
    ).then(results => {
      setResolved(prev => {
        const next = new Map(prev);
        results.forEach(r => {
          next.set(r.msgId, { url: r.url, error: r.error, isLoading: false });
        });
        return next;
      });
    });
  }, [refs]);

  return resolved;
}

export function MessagesWithMedia({
  messages,
  contact,
  conversation,
  isAdmin,
  isManager,
  messagesEndRef,
  _tick,
}: MessagesWithMediaProps) {
  const retryMutation = useRetryMessage();
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

  // Coletar storage: refs de mensagens sem media_attachments (para fallback)
  const storageRefs = useMemo(() => {
    const refs = new Map<string, string>();
    messages.forEach(msg => {
      const hasMediaAttachments = msg.media_attachments?.some(
        a => a.status === 'ready' && a.storage_bucket && a.storage_path
      );
      if (!hasMediaAttachments && msg.attachment_url?.startsWith('storage:') && !msg.is_ai_generated) {
        refs.set(msg.id, msg.attachment_url);
      }
    });
    return refs;
  }, [messages]);

  // Resolver storage: URLs para signed URLs
  const resolvedStorageUrls = useStorageUrlsResolver(storageRefs);

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
          const isValidUrl = message.attachment_url.startsWith('http');
          const isStorageRef = message.attachment_url.startsWith('storage:');

          if (isStorageRef) {
            // Resolver storage: URL via signed URL
            const resolved = resolvedStorageUrls.get(message.id);
            const mimeType = getMimeFromType((message as any).attachment_type);
            const storagePath = message.attachment_url.slice('storage:'.length);
            const filename = storagePath.split('/').pop() || 'media';

            attachments = [{
              id: `storage-fallback-${message.id}`,
              url: resolved?.url || '',
              mimeType,
              filename,
              size: undefined,
              waveformData: undefined,
              durationSeconds: undefined,
              error: resolved?.error || undefined,
              isLoading: resolved?.isLoading ?? true,
              onRetry: resolved?.error ? () => {
                // Force re-resolve by clearing the ref tracking
                // The hook will pick it up on next render
                window.location.reload(); // Simple fallback for edge case
              } : undefined,
            }];
          } else if (isValidUrl) {
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
              attachments={attachments}
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
              contactInitials={displayInitials(contact?.first_name, contact?.last_name)}
              channel={conversation.channel}
              showChannel={false}
              status={message.status as "sending" | "sent" | "delivered" | "read" | "failed" | undefined}
              errorDetail={errorDetail}
              usedArticles={usedArticles}
              isAdmin={isAdmin}
              isManager={isManager}
              attachments={attachments}
              metadata={message.metadata}
              onRetryMessage={
                message.status === 'failed' && !isCustomer
                  ? () => retryMutation.mutate({ messageId: message.id, conversationId: conversation.id })
                  : undefined
              }
              isRetrying={retryMutation.isPending && retryMutation.variables?.messageId === message.id}
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
