import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, AlertCircle, RefreshCw, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeHTML } from "@/components/SafeHTML";
import { MessageStatusIndicator } from "@/components/MessageStatusIndicator";
import { AIDebugTooltip } from "@/components/AIDebugTooltip";
import { ChannelIcon } from "@/components/ChannelIcon";
import { MediaPreview } from "./MediaPreview";
import { Button } from "@/components/ui/button";
import { useTemplateContent } from "@/hooks/useTemplateContent";

interface MessageSender {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title?: string | null;
}

interface MediaAttachment {
  id: string;
  url: string;
  mimeType: string;
  filename?: string;
  size?: number;
  waveformData?: number[];
  durationSeconds?: number;
  error?: string;
  isLoading?: boolean;
  onRetry?: () => void;
}

interface MessageBubbleProps {
  content: string;
  createdAt: string;
  isCustomer: boolean;
  isAI?: boolean;
  sender?: MessageSender | null;
  contactInitials?: string;
  channel?: string;
  showChannel?: boolean;
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  errorDetail?: string;
  usedArticles?: any[];
  isAdmin?: boolean;
  isManager?: boolean;
  attachments?: MediaAttachment[];
  className?: string;
  onRetryMessage?: () => void;
  isRetrying?: boolean;
  metadata?: Record<string, any> | null;
}

// Pure function — no per-bubble interval. Parent passes _tick to force re-render.
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  return format(new Date(dateStr), "HH:mm");
}

export function MessageBubble({
  content,
  createdAt,
  isCustomer,
  isAI = false,
  sender,
  contactInitials = "?",
  channel,
  showChannel = false,
  status,
  errorDetail,
  usedArticles = [],
  isAdmin = false,
  isManager = false,
  attachments = [],
  className,
  onRetryMessage,
  isRetrying,
  metadata,
}: MessageBubbleProps) {
  const relativeTime = formatRelativeTime(createdAt);
  return (
    <div
      className={cn(
        "flex gap-2",
        isCustomer ? "justify-start" : "justify-end",
        className
      )}
      role="article"
      aria-label={`Message from ${isCustomer ? "customer" : isAI ? "AI assistant" : sender?.full_name || "agent"}`}
    >
      {/* Customer Avatar */}
      {isCustomer && (
        <div className="relative shrink-0">
          <Avatar className="w-9 h-9 shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-600 text-white text-sm font-semibold">
              {contactInitials}
            </AvatarFallback>
          </Avatar>
          {showChannel && channel && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <ChannelIcon channel={channel as any} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* Agent/AI Avatar */}
      {!isCustomer && (
        <div className="relative shrink-0 order-2">
          <Avatar className="w-9 h-9 shadow-sm">
            {isAI ? (
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
              </AvatarFallback>
            ) : sender ? (
              <>
                {sender.avatar_url && (
                  <AvatarImage src={sender.avatar_url} alt={sender.full_name} />
                )}
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold">
                  {sender.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </>
            ) : (
              <AvatarFallback>?</AvatarFallback>
            )}
          </Avatar>
          {showChannel && channel && (
            <div className="absolute -bottom-0.5 -left-0.5">
              <ChannelIcon channel={channel as any} size="xs" />
            </div>
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={cn("flex flex-col", isCustomer ? "items-start" : "items-end")}>
        {/* Sender Name - Always show for non-customer messages */}
        {!isCustomer && (
          <p className="text-xs text-muted-foreground mb-1 px-1 font-medium">
            {isAI ? "Assistente Virtual" : (sender?.full_name || "Atendente")}
            {sender?.job_title && (
              <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                {sender.job_title}
              </span>
            )}
          </p>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "max-w-[75%] min-w-[120px] px-4 py-2.5",
            "text-[15px] leading-relaxed shadow-sm",
            isCustomer
              ? "bg-slate-900 text-white rounded-2xl rounded-tl-none"
              : isAI
              ? "bg-[hsl(var(--chat-surface))] border border-[hsl(var(--chat-border))] text-foreground rounded-2xl rounded-tr-none"
              : "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
          )}
        >
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {attachments.map((attachment) => {
                // Estado de erro com retry
                if (attachment.error) {
                  return (
                    <div 
                      key={attachment.id}
                      className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-lg border border-destructive/30"
                    >
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-xs font-medium text-destructive truncate">
                          Falha ao carregar mídia
                        </span>
                        <span className="text-[10px] text-destructive/70 truncate">
                          {attachment.filename || 'Arquivo'}
                        </span>
                      </div>
                      {attachment.onRetry && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={attachment.onRetry}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Tentar
                        </Button>
                      )}
                    </div>
                  );
                }

                // Estado de loading
                if (attachment.isLoading || (!attachment.url && !attachment.error)) {
                  return (
                    <div 
                      key={attachment.id}
                      className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30"
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground">
                          Carregando mídia...
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[150px]">
                          {attachment.filename || 'Arquivo'}
                        </span>
                      </div>
                    </div>
                  );
                }
                
                // Mídia carregada com sucesso
                return (
                  <MediaPreview
                    key={attachment.id}
                    url={attachment.url}
                    mimeType={attachment.mimeType}
                    filename={attachment.filename}
                    size={attachment.size}
                    waveformData={attachment.waveformData}
                    durationSeconds={attachment.durationSeconds}
                    compact
                  />
                );
              })}
            </div>
          )}

          {/* Text Content */}
          <TemplateOrTextContent
            content={content}
            metadata={metadata}
            isCustomer={isCustomer}
            isAI={isAI}
          />

          {/* Metadata Row */}
          <div className={cn(
            "mt-2 flex flex-col gap-1",
            isCustomer
              ? "text-slate-400 dark:text-zinc-500"
              : isAI
              ? "text-violet-600 dark:text-violet-400 opacity-70"
              : "text-white opacity-70"
          )}>
            <div className="text-[11px] flex items-center gap-1.5">
              <span>{relativeTime}</span>
              {isAI && (isAdmin || isManager) && usedArticles.length > 0 && (
                <AIDebugTooltip usedArticles={usedArticles} />
              )}
              {!isCustomer && status !== 'failed' && (
                <MessageStatusIndicator
                  status={status || 'sent'}
                  className={isAI ? "text-violet-600 dark:text-violet-400" : "text-white"}
                />
              )}
            </div>
            {!isCustomer && status === 'failed' && (
              <MessageStatusIndicator
                status="failed"
                errorDetail={errorDetail}
                onRetry={onRetryMessage}
                isRetrying={isRetrying}
                className="text-white"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
