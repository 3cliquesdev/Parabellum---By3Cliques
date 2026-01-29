import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
}

/**
 * Componente para renderizar mensagem da IA durante streaming
 * Exibe cursor piscante enquanto tokens chegam
 */
export function StreamingMessage({ content, isStreaming }: StreamingMessageProps) {
  return (
    <div className="flex justify-start gap-2 animate-in fade-in-0 slide-in-from-bottom-2">
      {/* Avatar IA */}
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="h-4 w-4 text-primary" />
      </div>

      {/* Bubble de mensagem */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5",
          "bg-muted text-foreground",
          "rounded-tl-sm"
        )}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content || (
            <span className="text-muted-foreground italic">Pensando...</span>
          )}
          
          {/* Cursor piscante */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-primary/60 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Indicador de streaming */}
        {isStreaming && content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Gerando resposta...</span>
          </div>
        )}
      </div>
    </div>
  );
}
