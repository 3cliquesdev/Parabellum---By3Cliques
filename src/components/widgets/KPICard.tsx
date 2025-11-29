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
  // Color mapping para fundos suaves dos ícones
  const iconColorMap: Record<string, string> = {
    'DollarSign': 'bg-green-500/10 text-green-600',
    'Users': 'bg-blue-500/10 text-blue-600',
    'TrendingUp': 'bg-purple-500/10 text-purple-600',
    'Target': 'bg-orange-500/10 text-orange-600',
    'Package': 'bg-indigo-500/10 text-indigo-600',
  };
  
  const iconColor = iconColorMap[Icon.name] || 'bg-primary/10 text-primary';
  
  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-[0_4px_32px_rgba(0,0,0,0.08)]">
      <CardContent className="p-5 min-w-0">
        {/* Header: Label + Icon com fundo colorido */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate leading-relaxed">
            {title}
          </span>
          <div className={cn("p-2 rounded-xl flex-shrink-0", iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        
        {/* Value */}
        <div className="text-2xl font-semibold text-foreground truncate leading-relaxed">
          {value}
        </div>
        
        {/* Footer: Trend Badge */}
        {trend && (
          <div className="flex items-center gap-1.5 mt-3">
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                trendUp ? "text-emerald-600 bg-emerald-500/10" : "text-red-600 bg-red-500/10"
              )}
            >
              {trendUp ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {trend}
            </Badge>
            {description && (
              <span className="text-xs text-muted-foreground leading-relaxed">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
