import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";
import { TrendingDown, RefreshCw, AlertTriangle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ChurnWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function ChurnWidget({ startDate, endDate }: ChurnWidgetProps) {
  const { data, isLoading, error } = useKiwifyCompleteMetrics(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive text-sm">Erro ao carregar métricas de churn</p>
        </CardContent>
      </Card>
    );
  }

  const churnColor = data.taxaChurn > 10 
    ? 'text-red-500' 
    : data.taxaChurn > 5 
      ? 'text-yellow-500' 
      : 'text-green-500';

  const churnBgColor = data.taxaChurn > 10 
    ? 'bg-red-500/10 border-red-500/20' 
    : data.taxaChurn > 5 
      ? 'bg-yellow-500/10 border-yellow-500/20' 
      : 'bg-green-500/10 border-green-500/20';

  const totalCancelamentos = data.reembolsos.quantidade + data.chargebacks.quantidade;
  const valorPerdido = data.reembolsos.valor + data.chargebacks.valor;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-destructive" />
          Taxa de Churn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Taxa de Churn Principal */}
        <div className={`p-4 rounded-lg border ${churnBgColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Cancelamento</p>
              <p className={`text-4xl font-bold ${churnColor}`}>
                {data.taxaChurn.toFixed(1)}%
              </p>
            </div>
            {data.taxaChurn > 10 ? (
              <AlertCircle className="h-10 w-10 text-red-500" />
            ) : data.taxaChurn > 5 ? (
              <AlertTriangle className="h-10 w-10 text-yellow-500" />
            ) : (
              <TrendingDown className="h-10 w-10 text-green-500" />
            )}
          </div>
          <Progress 
            value={Math.min(data.taxaChurn * 5, 100)} 
            className={`h-2 mt-3 ${data.taxaChurn > 10 ? '[&>div]:bg-red-500' : data.taxaChurn > 5 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
          />
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <RefreshCw className="h-4 w-4 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{data.reembolsos.quantidade}</p>
            <p className="text-xs text-muted-foreground">Reembolsos</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{data.chargebacks.quantidade}</p>
            <p className="text-xs text-muted-foreground">Chargebacks</p>
          </div>
        </div>

        {/* Valor Perdido */}
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor Perdido</span>
            <span className="font-bold text-destructive">{formatCurrency(valorPerdido)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalCancelamentos} cancelamentos no período
          </p>
        </div>

        {/* Reembolsos Pendentes */}
        {data.reembolsosPendentes.quantidade > 0 && (
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Reembolsos Pendentes</span>
              <span className="font-bold text-yellow-600">{data.reembolsosPendentes.quantidade}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(data.reembolsosPendentes.valor)} em análise
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
