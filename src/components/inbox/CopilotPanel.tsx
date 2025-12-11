import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLatestCopilotReply, useGenerateCopilotReply, useMarkCopilotReplyAsUsed } from "@/hooks/useCopilotSmartReply";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CopilotPanelProps {
  conversationId: string;
  onUseSuggestion: (text: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function CopilotPanel({
  conversationId,
  onUseSuggestion,
  isCollapsed = false,
  onToggleCollapse,
}: CopilotPanelProps) {
  const { data: suggestion, isLoading } = useLatestCopilotReply(conversationId);
  const generateReply = useGenerateCopilotReply();
  const markAsUsed = useMarkCopilotReplyAsUsed();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const suggestions = suggestion ? [suggestion.suggested_reply] : [];

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Copiado para a área de transferência");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleUse = (text: string) => {
    onUseSuggestion(text);
    if (suggestion?.id) {
      markAsUsed.mutate(suggestion.id);
    }
    toast.success("Sugestão aplicada no composer");
  };

  const handleRefresh = () => {
    generateReply.mutate(conversationId);
  };
  
  const isFetching = generateReply.isPending;

  if (!suggestions?.length && !isLoading) {
    return null;
  }

  return (
    <Card className="mx-4 mb-2 border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
            Sugestões do Copilot
          </span>
          {suggestions?.length && (
            <span className="text-xs bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full">
              {suggestions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50"
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-violet-600 dark:text-violet-400"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <CardContent className="px-4 pb-3 pt-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions?.map((suggestion, index) => (
                <div
                  key={index}
                  className="group relative p-3 rounded-lg bg-white dark:bg-zinc-900 border border-violet-100 dark:border-violet-800 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
                >
                  <p className="text-sm text-foreground pr-16 line-clamp-2">
                    {suggestion}
                  </p>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopy(suggestion, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
                      onClick={() => handleUse(suggestion)}
                    >
                      Usar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
