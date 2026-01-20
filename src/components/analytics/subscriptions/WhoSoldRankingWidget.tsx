import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal } from "lucide-react";
import { useWhoSoldMetrics } from "@/hooks/useWhoSoldMetrics";

interface WhoSoldRankingWidgetProps {
  startDate: Date;
  endDate: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function WhoSoldRankingWidget({ startDate, endDate }: WhoSoldRankingWidgetProps) {
  const { data: categories, isLoading } = useWhoSoldMetrics(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Quem Vendeu (Ranking por Receita)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Quem Vendeu (Ranking por Receita)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma venda no período selecionado
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...categories.map((c) => c.revenue));

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return "text-amber-500";
      case 1: return "text-gray-400";
      case 2: return "text-amber-700";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-amber-500" />
          Quem Vendeu (Ranking por Receita)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 font-medium">Canal</th>
                <th className="text-center py-2 font-medium">Vendas</th>
                <th className="text-right py-2 font-medium">Receita</th>
                <th className="text-right py-2 font-medium">% Total</th>
                <th className="text-right py-2 font-medium">Ticket Médio</th>
                <th className="py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {categories.slice(0, 6).map((category, index) => (
                <tr key={category.category} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Medal className={`h-5 w-5 ${getMedalColor(index)}`} />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-sm">{category.label}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-sm font-semibold">{category.sales}</span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(category.revenue)}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-medium text-muted-foreground">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm">{formatCurrency(category.avgTicket)}</span>
                  </td>
                  <td className="py-3">
                    <Progress
                      value={(category.revenue / maxRevenue) * 100}
                      className="h-2"
                      style={
                        {
                          "--progress-background": category.color,
                        } as React.CSSProperties
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
