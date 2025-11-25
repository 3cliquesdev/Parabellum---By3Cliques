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
    color: "bg-destructive text-destructive-foreground",
  },
  neutro: {
    label: "Neutro",
    icon: Meh,
    color: "bg-muted text-muted-foreground",
  },
  promotor: {
    label: "Promotor",
    icon: Smile,
    color: "bg-green-500 text-white dark:bg-green-600",
  },
};

export function SentimentBadge({ sentiment, className }: SentimentBadgeProps) {
  const config = sentimentConfig[sentiment];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={`${config.color} ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
