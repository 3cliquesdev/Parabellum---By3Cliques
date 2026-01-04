import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressCellProps {
  percentage: number;
  currentValue: number;
  targetValue: number;
  isTopPerformer?: boolean;
  hasRecentSale?: boolean;
}

export function ProgressCell({ 
  percentage, 
  currentValue, 
  targetValue, 
  isTopPerformer = false,
  hasRecentSale = false 
}: ProgressCellProps) {
  const getProgressColor = (pct: number) => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 90) return "bg-emerald-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getTextColor = (pct: number) => {
    if (pct >= 100) return "text-green-600 dark:text-green-400";
    if (pct >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-2 min-w-[180px]">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-bold text-sm", getTextColor(percentage))}>
          {percentage.toFixed(0)}%
        </span>
        <div className="flex items-center gap-1">
          {percentage >= 100 && (
            <Trophy className="h-4 w-4 text-amber-500 animate-pulse" />
          )}
          {isTopPerformer && percentage < 100 && (
            <Star className="h-4 w-4 text-amber-400" />
          )}
          {hasRecentSale && (
            <Flame className="h-4 w-4 text-orange-500" />
          )}
        </div>
      </div>
      
      <div className="relative">
        <Progress 
          value={Math.min(percentage, 100)} 
          className="h-2.5 bg-muted"
        />
        <div 
          className={cn(
            "absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out",
            getProgressColor(percentage)
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(currentValue)}</span>
        <span>de {formatCurrency(targetValue)}</span>
      </div>
    </div>
  );
}
