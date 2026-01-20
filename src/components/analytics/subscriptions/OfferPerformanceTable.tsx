import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useMemo } from "react";

interface OfferPerformanceTableProps {
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface OfferAggregation {
  offerName: string;
  productName: string;
  productCategory: string;
  vendas: number;
  bruto: number;
  liquido: number;
}

export function OfferPerformanceTable({ subscriptionData, isLoading }: OfferPerformanceTableProps) {
  // Agregar dados por oferta a partir do array de subscriptions
  const offers = useMemo(() => {
    if (!subscriptionData?.subscriptions) return [];

    const offerMap = new Map<string, OfferAggregation>();

    for (const sub of subscriptionData.subscriptions) {
      // Usar combinação de produto + oferta como chave única
      const key = `${sub.productName}|${sub.offerName}`;
      const existing = offerMap.get(key);

      if (existing) {
        existing.vendas += 1;
        existing.bruto += sub.grossValue;
        existing.liquido += sub.netValue;
      } else {
        offerMap.set(key, {
          offerName: sub.offerName,
          productName: sub.productName,
          productCategory: sub.productCategory,
          vendas: 1,
          bruto: sub.grossValue,
          liquido: sub.netValue,
        });
      }
    }

    // Ordenar por QUANTIDADE de vendas (não receita)
    return Array.from(offerMap.values()).sort((a, b) => b.vendas - a.vendas);
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

  const maxRevenue = Math.max(...offers.map(o => o.bruto), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Performance por Oferta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {offers.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Nenhuma oferta vendida no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Produto</TableHead>
                  <TableHead className="min-w-[250px]">Oferta</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Receita Bruta</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="w-[120px]">Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.slice(0, 15).map((offer, index) => {
                  const ticketMedio = offer.vendas > 0 ? offer.bruto / offer.vendas : 0;
                  const performance = (offer.bruto / maxRevenue) * 100;
                  
                  return (
                    <TableRow key={`${offer.productName}-${offer.offerName}-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <Badge 
                              variant={index === 0 ? "default" : "secondary"} 
                              className="text-xs shrink-0"
                            >
                              #{index + 1}
                            </Badge>
                          )}
                          <span className="text-sm font-medium text-foreground" title={offer.productName}>
                            {offer.productName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground" title={offer.offerName}>
                          {offer.offerName}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {offer.vendas}
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {formatCurrency(offer.bruto)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
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
