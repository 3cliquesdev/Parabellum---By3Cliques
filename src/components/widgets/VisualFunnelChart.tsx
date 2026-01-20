/**
 * ⚠️ LÓGICA TRAVADA - Usar useDealsCounts (query simples, cache 60s)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDealsCounts } from "@/hooks/useDealsCounts";
import { DateRange } from "react-day-picker";
import { TrendingDown } from "lucide-react";

interface VisualFunnelChartProps {
  dateRange?: DateRange;
}

export function VisualFunnelChart({ dateRange }: VisualFunnelChartProps) {
  const { data: totals, isLoading } = useDealsCounts(dateRange?.from, dateRange?.to);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className="h-14 rounded-lg"
                style={{ width: `${100 - i * 15}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCreated = totals?.totalCreated || 0;
  const totalWon = totals?.totalWon || 0;
  const totalLost = totals?.totalLost || 0;
  const totalOpen = totals?.totalOpen || 0;

  const stages = [
    {
      label: "Criados",
      value: totalCreated,
      color: "hsl(var(--primary))",
      bgClass: "bg-primary",
    },
    {
      label: "Ganhos",
      value: totalWon,
      color: "hsl(142, 76%, 36%)",
      bgClass: "bg-green-600",
    },
    {
      label: "Perdidos",
      value: totalLost,
      color: "hsl(0, 84%, 60%)",
      bgClass: "bg-red-500",
    },
    {
      label: "Em Aberto",
      value: totalOpen,
      color: "hsl(45, 93%, 47%)",
      bgClass: "bg-amber-500",
    },
  ];

  const maxValue = totalCreated || 1;
  
  // Larguras mínimas progressivas para manter o formato de funil
  const minWidths = [100, 70, 50, 35]; // Criados, Ganhos, Perdidos, Aberto

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-5 w-5 text-primary" />
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-2 py-2">
          {stages.map((stage, index) => {
            const proportionalWidth = (stage.value / maxValue) * 100;
            const widthPercent = Math.max(proportionalWidth, minWidths[index]);
            const percentage = totalCreated > 0 
              ? ((stage.value / totalCreated) * 100).toFixed(1) 
              : "0";

            return (
              <div
                key={stage.label}
                className="relative flex items-center justify-center h-14 rounded-md transition-all duration-300 hover:scale-[1.02] cursor-default"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: stage.color,
                  clipPath: index === stages.length - 1 
                    ? "polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)"
                    : "polygon(3% 0%, 97% 0%, 100% 100%, 0% 100%)",
                }}
              >
                <div className="flex flex-col items-center text-white">
                  <span className="font-bold text-sm md:text-base">
                    {stage.value.toLocaleString("pt-BR")} {stage.label}
                  </span>
                  <span className="text-xs opacity-90">
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t">
          {stages.map((stage) => (
            <div key={stage.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-xs text-muted-foreground">
                {stage.label}: {stage.value.toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
