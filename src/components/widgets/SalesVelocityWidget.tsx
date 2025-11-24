import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSalesCycle } from "@/hooks/useSalesCycle";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

export function SalesVelocityWidget() {
  const { data: salesCycle, isLoading } = useSalesCycle();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>⚡ Velocidade de Vendas</CardTitle>
          <CardDescription>Tempo médio para fechar negócios</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!salesCycle || salesCycle.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Velocidade de Vendas
          </CardTitle>
          <CardDescription>Tempo médio para fechar negócios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Sem negócios ganhos para calcular
          </div>
        </CardContent>
      </Card>
    );
  }

  const globalAvg = salesCycle.reduce((sum, rep) => sum + rep.avgDaysToClose, 0) / salesCycle.length;
  const fastestDeal = Math.min(...salesCycle.map(rep => rep.fastestDeal));
  const slowestDeal = Math.max(...salesCycle.map(rep => rep.slowestDeal));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Velocidade de Vendas
        </CardTitle>
        <CardDescription>Tempo médio para fechar negócios</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Métrica Global */}
          <div className="text-center">
            <div className="text-5xl font-bold text-primary">
              {globalAvg.toFixed(0)} dias
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Tempo médio de fechamento
            </p>
          </div>
          
          {/* Ranking por vendedor */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">🏆 Mais Rápidos:</p>
            {salesCycle.slice(0, 3).map((rep, idx) => (
              <div key={rep.repId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center gap-2">
                  <Badge variant={idx === 0 ? "default" : "secondary"}>
                    #{idx + 1}
                  </Badge>
                  <span className="text-sm">{rep.repName}</span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {rep.avgDaysToClose.toFixed(0)} dias
                </span>
              </div>
            ))}
          </div>
          
          {/* Insight */}
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              📊 Deal mais rápido: {fastestDeal} dias | Mais lento: {slowestDeal} dias
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
