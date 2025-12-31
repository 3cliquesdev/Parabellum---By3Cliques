import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PremiumKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  isLoading?: boolean;
  tooltip?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export function PremiumKPICard({
  title,
  value,
  subtitle,
  change,
  changeLabel = "vs período anterior",
  icon: Icon,
  iconColor = "text-primary",
  isLoading = false,
  tooltip,
  variant = "default"
}: PremiumKPICardProps) {
  const getChangeIcon = () => {
    if (change === undefined || change === 0) return Minus;
    return change > 0 ? TrendingUp : TrendingDown;
  };

  const getChangeColor = () => {
    if (change === undefined || change === 0) return "text-muted-foreground";
    // For sales cycle, negative is good (faster)
    if (changeLabel?.includes("dias")) {
      return change < 0 ? "text-emerald-600" : "text-red-500";
    }
    return change > 0 ? "text-emerald-600" : "text-red-500";
  };

  const ChangeIcon = getChangeIcon();

  const cardContent = (
    <Card className={cn(
      "p-4 transition-all duration-200 hover:shadow-md",
      "bg-card border-border/50",
      variant === "success" && "border-l-4 border-l-emerald-500",
      variant === "warning" && "border-l-4 border-l-amber-500",
      variant === "danger" && "border-l-4 border-l-red-500"
    )}>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground mt-1 truncate">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {subtitle}
              </p>
            )}
            {change !== undefined && (
              <div className={cn("flex items-center gap-1 mt-2", getChangeColor())}>
                <ChangeIcon className="h-3 w-3" />
                <span className="text-xs font-medium">
                  {change > 0 ? "+" : ""}{change.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {changeLabel}
                </span>
              </div>
            )}
          </div>
          <div className={cn(
            "p-2.5 rounded-lg bg-primary/10 shrink-0",
            iconColor
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      )}
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
