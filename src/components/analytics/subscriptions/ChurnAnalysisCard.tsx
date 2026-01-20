import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, RefreshCcw, Ban } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useMemo } from "react";

interface ChurnAnalysisCardProps {
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ChurnAnalysisCard({ subscriptionData, isLoading }: ChurnAnalysisCardProps) {
  // Calcular métricas de churn a partir dos dados do useKiwifySubscriptions
  const churnMetrics = useMemo(() => {
    if (!subscriptionData) {
      return {
        churnRate: 0,
        refundsCount: 0,
        refundsValue: 0,
        chargebacksCount: 0,
        chargebacksValue: 0,
        totalLost: 0,
      };
    }

    const refunds = subscriptionData.reembolsos || [];
    const refundsValue = refunds.reduce((sum, r) => sum + r.value, 0);
    
    // Churn rate = (reembolsos / vendas brutas) * 100
    const vendasBrutas = subscriptionData.vendasBrutas || 0;
    const churnRate = vendasBrutas > 0 ? (refunds.length / vendasBrutas) * 100 : 0;

    return {
      churnRate,
      refundsCount: refunds.length,
      refundsValue,
      chargebacksCount: 0, // Chargebacks são tratados como reembolsos na fonte
      chargebacksValue: 0,
      totalLost: refundsValue,
    };
  }, [subscriptionData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const getChurnColor = (rate: number) => {
    if (rate <= 2) return "text-green-500";
    if (rate <= 5) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Análise de Churn
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main Churn Rate */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Taxa de Churn</p>
            <p className={`text-4xl font-bold ${getChurnColor(churnMetrics.churnRate)}`}>
              {churnMetrics.churnRate.toFixed(1)}%
            </p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCcw className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Reembolsos</span>
              </div>
              <p className="text-lg font-bold">{churnMetrics.refundsCount}</p>
              <p className="text-xs text-orange-500">{formatCurrency(churnMetrics.refundsValue)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Ban className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Canceladas</span>
              </div>
              <p className="text-lg font-bold">{subscriptionData?.totalCanceladas || 0}</p>
              <p className="text-xs text-muted-foreground">assinaturas</p>
            </div>
          </div>

          {/* Total Lost */}
          <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Valor Perdido</span>
            </div>
            <span className="text-lg font-bold text-red-500">
              {formatCurrency(churnMetrics.totalLost)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
