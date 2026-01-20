import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useMemo } from "react";
import { fetchProductMappings, getMappedProductWithSourceType } from "@/lib/kiwifyProductMapping";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface WhoSoldRankingWidgetProps {
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Configuração de categorias com labels e cores
const CATEGORY_CONFIG: Record<string, { label: string; color: string; priority: number }> = {
  afiliado_novo: { label: "Afiliado (Novo)", color: "#22c55e", priority: 1 },
  afiliado_recorrente: { label: "Afiliado (Recorrente)", color: "#16a34a", priority: 2 },
  organico_novo: { label: "Orgânico (Novo)", color: "#3b82f6", priority: 3 },
  organico_recorrente: { label: "Orgânico (Recorrente)", color: "#2563eb", priority: 4 },
  comercial_novo: { label: "Comercial (Novo)", color: "#f59e0b", priority: 5 },
  comercial_recorrente: { label: "Comercial (Recorrente)", color: "#d97706", priority: 6 },
};

interface CategoryMetrics {
  category: string;
  label: string;
  color: string;
  sales: number;
  revenue: number;
  percentage: number;
  avgTicket: number;
}

export function WhoSoldRankingWidget({ subscriptionData, isLoading: parentLoading }: WhoSoldRankingWidgetProps) {
  // Buscar mapeamentos de produtos para obter source_type
  const { data: productMappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['product-mappings-who-sold'],
    queryFn: fetchProductMappings,
    staleTime: 60 * 1000, // 1 minuto
  });

  // Buscar payloads originais para classificar por source_type
  const { data: rawEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['who-sold-raw-events', subscriptionData?.subscriptions?.map(s => s.orderId).join(',')],
    queryFn: async () => {
      if (!subscriptionData?.subscriptions || subscriptionData.subscriptions.length === 0) {
        return new Map<string, any>();
      }

      const orderIds = subscriptionData.subscriptions.map(s => s.orderId).filter(Boolean);
      if (orderIds.length === 0) return new Map<string, any>();

      // Buscar eventos paid para obter os payloads originais
      const { data: events } = await supabase
        .from('kiwify_events')
        .select('payload')
        .eq('event_type', 'paid')
        .limit(1000);

      const eventMap = new Map<string, any>();
      for (const event of events || []) {
        const payload = event.payload as any;
        const orderId = payload?.order_id || payload?.OrderId;
        if (orderId) {
          eventMap.set(orderId, payload);
        }
      }

      return eventMap;
    },
    enabled: !!subscriptionData?.subscriptions && subscriptionData.subscriptions.length > 0,
    staleTime: 30 * 1000,
  });

  // Processar dados e agrupar por canal (source_type + novo/recorrente)
  const categories = useMemo((): CategoryMetrics[] => {
    if (!subscriptionData?.subscriptions || !productMappings || !rawEvents) {
      return [];
    }

    const categoryMap = new Map<string, { sales: number; revenue: number }>();

    for (const sub of subscriptionData.subscriptions) {
      // Obter payload original para determinar source_type e charges
      const payload = rawEvents.get(sub.orderId);
      if (!payload) continue;

      // Determinar source_type usando helper centralizado
      const mappedProduct = getMappedProductWithSourceType(
        payload,
        productMappings.offerMap,
        productMappings.productIdMap
      );
      const sourceType = mappedProduct.sourceType || 'organico';

      // Determinar se é novo ou recorrente
      const chargesCompleted = payload?.Subscription?.charges?.completed || [];
      const hasPlan = !!payload?.Subscription?.plan?.id;
      const isRecorrente = hasPlan && chargesCompleted.length > 1;

      // Criar chave composta: sourceType_tipo
      const categoryKey = `${sourceType}_${isRecorrente ? 'recorrente' : 'novo'}`;

      const existing = categoryMap.get(categoryKey) || { sales: 0, revenue: 0 };
      existing.sales += 1;
      existing.revenue += sub.grossValue;
      categoryMap.set(categoryKey, existing);
    }

    // Converter para array e calcular métricas
    const totalRevenue = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.revenue, 0);

    const result: CategoryMetrics[] = [];
    for (const [key, data] of categoryMap.entries()) {
      const config = CATEGORY_CONFIG[key] || {
        label: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        color: '#6b7280',
        priority: 99,
      };

      result.push({
        category: key,
        label: config.label,
        color: config.color,
        sales: data.sales,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        avgTicket: data.sales > 0 ? data.revenue / data.sales : 0,
      });
    }

    // Ordenar por receita decrescente
    return result.sort((a, b) => b.revenue - a.revenue);
  }, [subscriptionData?.subscriptions, productMappings, rawEvents]);

  const isLoading = parentLoading || mappingsLoading || eventsLoading;

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
              {categories.slice(0, 8).map((category, index) => (
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
