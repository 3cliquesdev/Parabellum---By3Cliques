import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingDown, RefreshCcw, Ban } from "lucide-react";
import { KiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";

interface ChurnAnalysisCardProps {
  data?: KiwifyCompleteMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ChurnAnalysisCard({ data, isLoading }: ChurnAnalysisCardProps) {
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

  const churnRate = data?.taxaChurn || 0;
  const refunds = data?.reembolsos || { quantidade: 0, valor: 0 };
  const chargebacks = data?.chargebacks || { quantidade: 0, valor: 0 };
  const totalLost = refunds.valor + chargebacks.valor;

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
            <p className={`text-4xl font-bold ${getChurnColor(churnRate)}`}>
              {churnRate.toFixed(1)}%
            </p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCcw className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Reembolsos</span>
              </div>
              <p className="text-lg font-bold">{refunds.quantidade}</p>
              <p className="text-xs text-orange-500">{formatCurrency(refunds.valor)}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Ban className="h-4 w-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Chargebacks</span>
              </div>
              <p className="text-lg font-bold">{chargebacks.quantidade}</p>
              <p className="text-xs text-red-500">{formatCurrency(chargebacks.valor)}</p>
            </div>
          </div>

          {/* Total Lost */}
          <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Valor Perdido</span>
            </div>
            <span className="text-lg font-bold text-red-500">
              {formatCurrency(totalLost)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
