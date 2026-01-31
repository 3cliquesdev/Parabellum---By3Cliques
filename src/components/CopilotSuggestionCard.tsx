import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  X, 
  RefreshCw, 
  MessageSquare, 
  AlertTriangle, 
  Tag,
  Copy,
  Check
} from "lucide-react";
import { 
  useCopilotSuggestions, 
  useGenerateCopilotSuggestions, 
  useMarkSuggestionAsUsed 
} from "@/hooks/useCopilotSuggestions";
import { useTrackQualityMetric } from "@/hooks/useTrackQualityMetric";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CopilotSuggestionCardProps {
  conversationId: string;
  onUseSuggestion: (text: string) => void;
}

export default function CopilotSuggestionCard({ 
  conversationId, 
  onUseSuggestion 
}: CopilotSuggestionCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { data, isLoading } = useCopilotSuggestions(conversationId);
  const generateSuggestions = useGenerateCopilotSuggestions();
  const markAsUsed = useMarkSuggestionAsUsed();
  const trackQuality = useTrackQualityMetric();

  // Reset dismissed state when conversation changes
  useEffect(() => {
    setIsDismissed(false);
  }, [conversationId]);

  const handleUseSuggestion = (suggestion: any) => {
    onUseSuggestion(suggestion.suggested_reply);
    markAsUsed.mutate(suggestion.id);
    
    // Track quality metric for analytics
    trackQuality.mutate({
      conversationId,
      event: 'suggestion_used',
      data: {
        suggestionsAvailable: data?.all.length || 0,
      },
    });
    
    toast.success("Sugestão aplicada no composer");
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copiado para a área de transferência");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = () => {
    generateSuggestions.mutate(conversationId);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </Card>
    );
  }

  // Empty state - show generate button
  if (!data?.all.length && !generateSuggestions.isPending) {
    return (
      <Card className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <p className="text-sm font-medium text-foreground">
              Copilot ativo
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleRegenerate}
            disabled={generateSuggestions.isPending}
            className="border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300"
          >
            {generateSuggestions.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">Gerar Sugestões</span>
          </Button>
        </div>
      </Card>
    );
  }

  // Generating state
  if (generateSuggestions.isPending) {
    return (
      <Card className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-violet-600 dark:text-violet-400 animate-spin" />
          <p className="text-sm text-violet-700 dark:text-violet-300">
            Analisando conversa e gerando sugestões...
          </p>
        </div>
      </Card>
    );
  }

  // Dismissed state
  if (isDismissed) return null;

  return (
    <div className="space-y-2 animate-in fade-in-50 duration-300">
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-medium text-violet-800 dark:text-violet-300">
            Sugestões do Copilot
          </span>
          <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
            {data?.all.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-violet-600 hover:bg-violet-100 dark:text-violet-400 dark:hover:bg-violet-900/50"
            onClick={handleRegenerate}
            disabled={generateSuggestions.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", generateSuggestions.isPending && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-muted"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Reply Suggestions */}
      {data?.replies.map((reply) => (
        <Card 
          key={reply.id} 
          className="p-4 bg-violet-50/80 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
        >
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-violet-600 dark:text-violet-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-violet-800 dark:text-violet-200">
                  Sugestão de Resposta
                </span>
                <Badge variant="outline" className="text-xs border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400">
                  {reply.confidence_score || 0}% confiança
                </Badge>
              </div>
              <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">
                {reply.suggested_reply}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={() => handleUseSuggestion(reply)}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  Usar esta resposta
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleCopy(reply.suggested_reply, reply.id)}
                  className="border-violet-300 dark:border-violet-700"
                >
                  {copiedId === reply.id ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* KB Gap Alerts */}
      {data?.kbGaps.map((gap) => (
        <Card 
          key={gap.id} 
          className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Lacuna de Conhecimento Detectada
                </span>
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                  KB Gap
                </Badge>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {gap.kb_gap_description}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {/* Classification Label (subtle) */}
      {data?.classifications[0] && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-1">
          <Tag className="h-3 w-3" />
          <span>Classificação: {data.classifications[0].classification_label}</span>
          <Badge variant="outline" className="text-[10px] px-1">
            {data.classifications[0].confidence_score || 0}%
          </Badge>
        </div>
      )}
    </div>
  );
}
