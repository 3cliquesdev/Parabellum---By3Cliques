import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useMemo } from "react";

interface SalesChannelQuantityWidgetProps {
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface ChannelMetrics {
  channel: string;
  sales: number;
  revenue: number;
  percentage: number;
  avgTicket: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  afiliado: "Afiliados",
  organico: "Orgânico",
  comercial: "Comercial",
  recorrencia: "Recorrência",
};

const CHANNEL_ORDER = ["afiliado", "comercial", "organico", "recorrencia"];

export function SalesChannelQuantityWidget({ subscriptionData, isLoading }: SalesChannelQuantityWidgetProps) {
  const channels = useMemo(() => {
    if (!subscriptionData?.subscriptions) return [];

    const channelMap = new Map<string, { sales: number; revenue: number }>();

    for (const sub of subscriptionData.subscriptions) {
      // Detectar canal baseado em sourceType do mapping
      let channel = sub.sourceType || "organico";
      
      // Normalizar
      if (channel === "afiliado") channel = "afiliado";
      else if (channel === "comercial") channel = "comercial";
      else channel = "organico";

      const existing = channelMap.get(channel) || { sales: 0, revenue: 0 };
      existing.sales += 1;
      existing.revenue += sub.grossValue;
      channelMap.set(channel, existing);
    }

    const totalSales = Array.from(channelMap.values()).reduce((sum, c) => sum + c.sales, 0);

    // Converter para array com métricas calculadas
    const result: ChannelMetrics[] = Array.from(channelMap.entries())
      .map(([channel, stats]) => ({
        channel,
        sales: stats.sales,
        revenue: stats.revenue,
        percentage: totalSales > 0 ? (stats.sales / totalSales) * 100 : 0,
        avgTicket: stats.sales > 0 ? stats.revenue / stats.sales : 0,
      }))
      .sort((a, b) => b.sales - a.sales); // Ordenar por QUANTIDADE

    return result;
  }, [subscriptionData?.subscriptions]);

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

  const maxSales = Math.max(...channels.map(c => c.sales), 1);
  const totalSales = channels.reduce((sum, c) => sum + c.sales, 0);
  const totalRevenue = channels.reduce((sum, c) => sum + c.revenue, 0);

  const getMedalEmoji = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Canais de Vendas (Ranking por Quantidade)
          </CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{totalSales} vendas</span>
            <span className="text-primary font-medium">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Nenhuma venda no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Canal</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-center">% Total</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="w-[140px]">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel, index) => {
                  const barWidth = (channel.sales / maxSales) * 100;
                  
                  return (
                    <TableRow key={channel.channel}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getMedalEmoji(index)}</span>
                          <span>{CHANNEL_LABELS[channel.channel] || channel.channel}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-lg">{channel.sales}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="secondary" 
                          className={index === 0 ? "bg-primary/10 text-primary border-primary/20" : ""}
                        >
                          {channel.percentage.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(channel.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(channel.avgTicket)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
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
