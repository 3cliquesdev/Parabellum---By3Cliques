import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeHTML } from "@/components/SafeHTML";
import { MessageStatusIndicator } from "@/components/MessageStatusIndicator";
import { AIDebugTooltip } from "@/components/AIDebugTooltip";
import { ChannelIcon } from "@/components/ChannelIcon";
import { MediaPreview } from "./MediaPreview";

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
  filename: string;
  size?: number;
  waveformData?: number[];
  durationSeconds?: number;
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
  status?: "sending" | "sent" | "delivered" | "failed";
  usedArticles?: any[];
  isAdmin?: boolean;
  isManager?: boolean;
  attachments?: MediaAttachment[];
  className?: string;
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
  usedArticles = [],
  isAdmin = false,
  isManager = false,
  attachments = [],
  className,
}: MessageBubbleProps) {
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
        {/* Sender Name */}
        {!isCustomer && (
          <p className="text-xs text-muted-foreground mb-1 px-1 font-medium">
            {isAI ? "Assistente Virtual" : sender?.full_name}
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
            "max-w-[85%] min-w-[120px] px-4 py-3 shadow-sm",
            isCustomer
              ? "bg-slate-900 text-white rounded-2xl rounded-tl-none"
              : isAI
              ? "bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl rounded-tr-none text-violet-900 dark:text-violet-300"
              : "bg-blue-600 dark:bg-blue-600/90 text-white rounded-2xl rounded-tr-none"
          )}
        >
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {attachments.map((attachment) => {
                // ✅ Detectar mídia pendente de download
                const isPending = !attachment.url || attachment.url === '';
                
                if (isPending) {
                  return (
                    <div 
                      key={attachment.id}
                      className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30"
                    >
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center animate-pulse">
                        <span className="text-muted-foreground text-xs">⏳</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground">
                          Mídia pendente
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          Download em andamento...
                        </span>
                      </div>
                    </div>
                  );
                }
                
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
          {content && (
            <SafeHTML
              html={content}
              className="text-sm whitespace-pre-wrap [word-break:break-word]"
            />
          )}

          {/* Metadata Row */}
          <div
            className={cn(
              "text-[10px] mt-1 flex items-center gap-1.5",
              isCustomer
                ? "text-slate-400 dark:text-zinc-500"
                : isAI
                ? "text-violet-600 dark:text-violet-400 opacity-70"
                : "text-white opacity-70"
            )}
          >
            <span>{format(new Date(createdAt), "HH:mm")}</span>

            {/* AI Debug for Admins */}
            {isAI && (isAdmin || isManager) && usedArticles.length > 0 && (
              <AIDebugTooltip usedArticles={usedArticles} />
            )}

            {/* Status Indicator */}
            {!isCustomer && status && (
              <MessageStatusIndicator
                status={status}
                className={
                  isAI ? "text-violet-600 dark:text-violet-400" : "text-white"
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
