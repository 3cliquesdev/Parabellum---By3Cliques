import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import { useMemo } from "react";

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

// Gera cor consistente baseada no nome da categoria (hash do nome)
function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#8B5CF6', // Roxo
    '#F97316', // Laranja
    '#3B82F6', // Azul
    '#10B981', // Verde
    '#EC4899', // Rosa
    '#EAB308', // Amarelo
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#EF4444', // Vermelho
    '#06B6D4', // Cyan
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

interface CategoryMetrics {
  category: string;
  label: string;
  color: string;
  sales: number;
  revenue: number;
  percentage: number;
  avgTicket: number;
}

export function WhoSoldRankingWidget({ subscriptionData, isLoading }: WhoSoldRankingWidgetProps) {
  // Processar dados agrupando por productCategory (nome do produto mapeado)
  // Isso garante que os dados sejam EXATAMENTE iguais ao menu Assinaturas
  const categories = useMemo((): CategoryMetrics[] => {
    if (!subscriptionData?.subscriptions || subscriptionData.subscriptions.length === 0) {
      return [];
    }

    // Agrupar por productCategory (exatamente como o menu Assinaturas)
    const categoryMap = new Map<string, { sales: number; revenue: number }>();

    for (const sub of subscriptionData.subscriptions) {
      // Usa productCategory que é o nome do produto mapeado em product_offers → products.name
      const categoryName = sub.productCategory || 'Não mapeado';

      const existing = categoryMap.get(categoryName) || { sales: 0, revenue: 0 };
      existing.sales += 1;
      existing.revenue += sub.grossValue;
      categoryMap.set(categoryName, existing);
    }

    // Converter para array e calcular métricas
    const totalRevenue = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.revenue, 0);

    const result: CategoryMetrics[] = [];
    for (const [categoryName, data] of categoryMap.entries()) {
      result.push({
        category: categoryName,
        label: categoryName,
        color: getCategoryColor(categoryName),
        sales: data.sales,
        revenue: data.revenue,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        avgTicket: data.sales > 0 ? data.revenue / data.sales : 0,
      });
    }

    // Ordenar por QUANTIDADE de vendas (não receita)
    return result.sort((a, b) => b.sales - a.sales);
  }, [subscriptionData?.subscriptions]);

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

  // Calcular totais para mostrar no cabeçalho
  const totalSales = categories.reduce((sum, c) => sum + c.sales, 0);
  const totalRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);
  const maxSales = Math.max(...categories.map((c) => c.sales), 1);

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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-5 w-5 text-amber-500" />
            Quem Vendeu (Ranking por Quantidade)
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{totalSales}</span> vendas · <span className="font-semibold text-green-600">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
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
                      <span className="font-medium text-sm whitespace-nowrap">{category.label}</span>
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
                      value={(category.sales / maxSales) * 100}
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
