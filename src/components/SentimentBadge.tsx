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
    color: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  neutro: {
    label: "Neutro",
    icon: Meh,
    color: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  },
  promotor: {
    label: "Promotor",
    icon: Smile,
    color: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
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
