import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompactMetric {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  percent?: string;
  percentColor?: "green" | "red" | "yellow" | "muted";
  subtext?: string;
  tooltip?: string;
}

interface CompactMetricsGridProps {
  label?: string;
  metrics: CompactMetric[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const percentColorMap = {
  green: "text-green-600 dark:text-green-400",
  red: "text-red-600 dark:text-red-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  muted: "text-muted-foreground",
};

export function CompactMetricsGrid({ 
  label, 
  metrics, 
  columns = 4,
  className 
}: CompactMetricsGridProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      )}
      <div className={cn("grid gap-3 grid-cols-1", gridCols[columns])}>
        {metrics.map((metric, index) => (
          <CompactMetricCard key={index} metric={metric} />
        ))}
      </div>
    </div>
  );
}

function CompactMetricCard({ metric }: { metric: CompactMetric }) {
  const Icon = metric.icon;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg shrink-0", metric.bgColor)}>
            <Icon className={cn("h-4 w-4", metric.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold leading-none truncate">
              {typeof metric.value === "number" 
                ? metric.value.toLocaleString("pt-BR") 
                : metric.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {metric.title}
            </p>
            {metric.subtext && (
              <p className="text-[10px] text-muted-foreground/70 truncate">
                {metric.subtext}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {metric.percent && (
              <span className={cn(
                "text-sm font-medium",
                percentColorMap[metric.percentColor || "muted"]
              )}>
                {metric.percent}
              </span>
            )}
            {metric.tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">{metric.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
