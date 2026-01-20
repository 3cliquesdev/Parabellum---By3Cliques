import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { SubscriptionMetrics, SubscriptionData } from "@/hooks/useKiwifySubscriptions";
import { useMemo } from "react";

interface ProductPerformanceTableProps {
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface ProductAggregation {
  productName: string;
  productCategory: string;
  vendas: number;
  bruto: number;
  liquido: number;
}

export function ProductPerformanceTable({ subscriptionData, isLoading }: ProductPerformanceTableProps) {
  // Agregar dados por produto a partir do array de subscriptions
  const products = useMemo(() => {
    if (!subscriptionData?.subscriptions) return [];

    const productMap = new Map<string, ProductAggregation>();

    for (const sub of subscriptionData.subscriptions) {
      const key = sub.productName;
      const existing = productMap.get(key);

      if (existing) {
        existing.vendas += 1;
        existing.bruto += sub.grossValue;
        existing.liquido += sub.netValue;
      } else {
        productMap.set(key, {
          productName: sub.productName,
          productCategory: sub.productCategory,
          vendas: 1,
          bruto: sub.grossValue,
          liquido: sub.netValue,
        });
      }
    }

    // Ordenar por receita bruta decrescente
    return Array.from(productMap.values()).sort((a, b) => b.bruto - a.bruto);
  }, [subscriptionData?.subscriptions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const maxRevenue = Math.max(...products.map(p => p.bruto), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Performance por Produto
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Nenhum produto vendido no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Produto</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Receita Bruta</TableHead>
                  <TableHead className="text-right">Receita Líquida</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="w-[150px]">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.slice(0, 10).map((product, index) => {
                  const ticketMedio = product.vendas > 0 ? product.bruto / product.vendas : 0;
                  const performance = (product.bruto / maxRevenue) * 100;
                  
                  return (
                    <TableRow key={product.productName}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                              #{index + 1}
                            </Badge>
                          )}
                          <span className="truncate max-w-[180px]" title={product.productName}>
                            {product.productName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {product.vendas}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatCurrency(product.bruto)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatCurrency(product.liquido)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(ticketMedio)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${performance}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {performance.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
