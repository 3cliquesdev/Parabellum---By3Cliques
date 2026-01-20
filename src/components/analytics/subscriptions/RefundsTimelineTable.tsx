import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";

interface RefundsTimelineTableProps {
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function RefundsTimelineTable({ subscriptionData, isLoading }: RefundsTimelineTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-red-500" />
            Reembolsos por Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const refunds = subscriptionData?.reembolsos || [];

  if (refunds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-red-500" />
            Reembolsos por Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Nenhum reembolso no período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalValue = refunds.reduce((sum, r) => sum + r.value, 0);

  // Ordenar por data de reembolso (mais recente primeiro)
  const sortedRefunds = [...refunds].sort((a, b) => 
    new Date(b.refundDate).getTime() - new Date(a.refundDate).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <RefreshCcw className="h-5 w-5 text-red-500" />
            Reembolsos por Data
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{refunds.length}</span> reembolsos
            </span>
            <span className="text-red-600 font-bold">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 font-medium">Data</th>
                <th className="text-left py-2 font-medium">Cliente</th>
                <th className="text-left py-2 font-medium">Produto</th>
                <th className="text-right py-2 font-medium">Valor</th>
                <th className="text-left py-2 font-medium">Categoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedRefunds.slice(0, 20).map((refund, index) => (
                <tr key={`${refund.orderId}-${index}`} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3">
                    <span className="text-sm font-medium">
                      {format(parseISO(refund.refundDate), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {refund.customerEmail}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {refund.customerName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="text-sm truncate max-w-[200px] block">
                      {refund.productName}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm font-semibold text-red-600">
                      {formatCurrency(refund.value)}
                    </span>
                  </td>
                  <td className="py-3">
                    <Badge variant="secondary" className="text-xs">
                      {refund.productCategory}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {refunds.length > 20 && (
          <div className="text-center text-sm text-muted-foreground mt-4 pt-4 border-t">
            Mostrando 20 de {refunds.length} reembolsos
          </div>
        )}
      </CardContent>
    </Card>
  );
}
