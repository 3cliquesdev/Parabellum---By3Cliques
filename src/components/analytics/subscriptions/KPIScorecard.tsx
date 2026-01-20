import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIScorecardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  iconColor?: string;
  isLoading?: boolean;
}

export function KPIScorecard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  iconColor = "text-primary",
  isLoading = false,
}: KPIScorecardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-24 mt-2" />
          <Skeleton className="h-3 w-16 mt-1" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn("p-2 rounded-lg bg-primary/10", iconColor.replace("text-", "bg-").replace("/10", "/10"))}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          <div className="flex items-center gap-2 mt-1">
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
