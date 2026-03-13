import { StickyNote } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { MediaPreview } from "@/components/inbox/MediaPreview";

interface Attachment {
  url: string;
  mimeType: string;
  filename: string;
  size?: number;
  waveformData?: number[];
  durationSeconds?: number;
  error?: string;
  isLoading?: boolean;
  onRetry?: () => void;
}

interface InternalNoteMessageProps {
  content: string;
  createdAt: string;
  senderName?: string;
  attachments?: Attachment[];
}

// FASE 8: Componente de exibição de Nota Interna
export function InternalNoteMessage({ 
  content, 
  createdAt,
  senderName,
  attachments 
}: InternalNoteMessageProps) {
  return (
    <div className="flex justify-center py-2">
      <div className={cn(
        "max-w-md w-full mx-4 p-3 rounded-lg",
        "bg-yellow-50 dark:bg-yellow-900/30",
        "border border-yellow-200 dark:border-yellow-800"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-200 dark:bg-yellow-800">
            <StickyNote className="h-3.5 w-3.5 text-yellow-700 dark:text-yellow-300" />
          </div>
          <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
            Nota Interna
          </span>
          {senderName && (
            <>
              <span className="text-yellow-400">•</span>
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                {senderName}
              </span>
            </>
          )}
        </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {attachments.map((att, idx) => (
              <MediaPreview
                key={idx}
                url={att.url}
                mimeType={att.mimeType}
                filename={att.filename}
                size={att.size}
                waveformData={att.waveformData}
                durationSeconds={att.durationSeconds}
                compact
              />
            ))}
          </div>
        )}
        
        {/* Content */}
        {content && (
          <p className="text-sm text-yellow-800 dark:text-yellow-200 whitespace-pre-wrap">
            {content}
          </p>
        )}
        
        {/* Timestamp */}
        <div className="mt-2 text-right">
          <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
            {format(new Date(createdAt), "HH:mm")}
          </span>
        </div>
      </div>
    </div>
  );
}
