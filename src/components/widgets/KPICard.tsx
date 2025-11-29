import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  description?: string;
}

export function KPICard({ 
  title, 
  value, 
  trend, 
  trendUp = true, 
  icon: Icon, 
  description 
}: KPICardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4 min-w-0">
        {/* Header: Label + Icon */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
            {title}
          </span>
          <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
        </div>
        
        {/* Value */}
        <div className="text-2xl font-semibold text-slate-900 dark:text-white truncate">
          {value}
        </div>
        
        {/* Footer: Trend Badge */}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs px-1.5 py-0",
                trendUp ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" : "text-red-600 bg-red-50 dark:bg-red-950"
              )}
            >
              {trendUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trend}
            </Badge>
            {description && (
              <span className="text-xs text-slate-500">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
