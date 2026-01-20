import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesByRep } from "@/hooks/useSalesByRep";
import { Trophy, Medal } from "lucide-react";

interface SalesRepRankingWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SalesRepRankingWidget({ startDate, endDate }: SalesRepRankingWidgetProps) {
  const { data, isLoading } = useSalesByRep(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const topReps = (data || []).slice(0, 5);
  const maxSales = Math.max(...topReps.map((r) => r.totalSales), 1);

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-500";
      case 1:
        return "text-gray-400";
      case 2:
        return "text-amber-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Vendedores
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topReps.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Nenhuma venda no período
          </div>
        ) : (
          <div className="space-y-3">
            {topReps.map((rep, index) => {
              const percentage = (rep.totalSales / maxSales) * 100;
              return (
                <div key={rep.repName} className="space-y-1">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Medal className={`h-4 w-4 ${getMedalColor(index)}`} />
                      <span className="font-medium text-sm whitespace-nowrap">
                        {rep.repName}
                      </span>
                    </div>
                    <span className="font-bold text-sm text-primary">
                      {rep.dealsCount} vendas
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {formatCurrency(rep.totalSales)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
