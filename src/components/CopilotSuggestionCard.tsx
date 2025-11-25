import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, RefreshCw } from "lucide-react";
import { useLatestCopilotReply, useGenerateCopilotReply, useMarkCopilotReplyAsUsed } from "@/hooks/useCopilotSmartReply";
import { useState, useEffect } from "react";

interface CopilotSuggestionCardProps {
  conversationId: string;
  onUseSuggestion: (text: string) => void;
}

export default function CopilotSuggestionCard({ 
  conversationId, 
  onUseSuggestion 
}: CopilotSuggestionCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { data: suggestion, isLoading } = useLatestCopilotReply(conversationId);
  const generateReply = useGenerateCopilotReply();
  const markAsUsed = useMarkCopilotReplyAsUsed();

  // Reset dismissed state when conversation changes
  useEffect(() => {
    setIsDismissed(false);
  }, [conversationId]);

  const handleUseSuggestion = () => {
    if (!suggestion) return;
    
    onUseSuggestion(suggestion.suggested_reply);
    markAsUsed.mutate(suggestion.id);
    setIsDismissed(true);
  };

  const handleRegenerate = () => {
    generateReply.mutate(conversationId);
  };

  // Se não há sugestão e não está carregando, mostrar botão de gerar
  if (!suggestion && !isLoading && !generateReply.isPending) {
    return (
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium text-foreground">
              💡 Modo Copilot Ativo
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleRegenerate}
            disabled={generateReply.isPending}
          >
            {generateReply.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">Gerar Sugestão</span>
          </Button>
        </div>
      </Card>
    );
  }

  // Se foi dismissed ou não há sugestão, não mostrar card
  if (isDismissed || !suggestion) return null;

  return (
    <Card className="p-4 bg-primary/5 border-primary/20 animate-in fade-in-50 duration-300">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">
              💡 Sugestão da IA
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">
            {suggestion.suggested_reply}
          </p>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              onClick={handleUseSuggestion}
              className="bg-primary hover:bg-primary/90"
            >
              Usar esta resposta
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRegenerate}
              disabled={generateReply.isPending}
            >
              {generateReply.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
