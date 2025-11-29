import { Badge } from "@/components/ui/badge";
import { Angry, Meh, Smile } from "lucide-react";
import type { Sentiment } from "@/hooks/useSentimentAnalysis";

interface SentimentBadgeProps {
  sentiment: Sentiment;
  className?: string;
}

const sentimentConfig = {
  critico: {
    label: "Crítico",
    icon: Angry,
    color: "border-rose-200/20 bg-rose-500/10 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400",
  },
  neutro: {
    label: "Neutro",
    icon: Meh,
    color: "border-slate-200/20 bg-slate-500/10 text-slate-600 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400",
  },
  promotor: {
    label: "Promotor",
    icon: Smile,
    color: "border-emerald-200/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
};

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const config = sentimentConfig[sentiment];
  
  // Guard: se config não existir, fallback para neutro
  if (!config) {
    console.warn(`[SentimentBadge] Sentiment desconhecido: ${sentiment}, usando fallback 'neutro'`);
    const fallbackConfig = sentimentConfig.neutro;
    const FallbackIcon = fallbackConfig.icon;
    return (
      <Badge variant="secondary" className={`${fallbackConfig.color} ${className}`}>
        <FallbackIcon className="h-3 w-3 mr-1" />
        {fallbackConfig.label}
      </Badge>
    );
  }
  
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={`${config.color} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
