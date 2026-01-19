import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionMetrics, ProductCategory } from "@/hooks/useKiwifySubscriptions";
import { Users, ShoppingCart, DollarSign, RotateCcw, UserPlus, UserCheck } from "lucide-react";

interface SubscriptionMetricsCardsProps {
  data?: SubscriptionMetrics;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function SubscriptionMetricsCards({ data }: SubscriptionMetricsCardsProps) {
  if (!data) return null;

  const metrics = [
    {
      title: 'Clientes Únicos',
      subtitle: 'Total de assinaturas',
      value: (data.totalAssinaturas ?? 0).toLocaleString('pt-BR'),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Clientes Novos',
      subtitle: 'Primeira compra',
      value: (data.clientesNovos ?? 0).toLocaleString('pt-BR'),
      icon: UserPlus,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Clientes Recorrentes',
      subtitle: 'Compraram antes',
      value: (data.clientesRecorrentes ?? 0).toLocaleString('pt-BR'),
      icon: UserCheck,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
    {
      title: 'Vendas Brutas',
      subtitle: 'Produtos vendidos',
      value: (data.vendasBrutas ?? 0).toLocaleString('pt-BR'),
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Vendas Líquidas',
      subtitle: 'Após reembolsos',
      value: (data.vendasLiquidas ?? 0).toLocaleString('pt-BR'),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Reembolsos',
      subtitle: 'Devoluções',
      value: (data.reembolsos?.length ?? 0).toLocaleString('pt-BR'),
      icon: RotateCcw,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center text-center">
              <div className={`p-2 rounded-full ${metric.bgColor} mb-2`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{metric.title}</p>
              <p className="text-xs text-muted-foreground/70">{metric.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CategoryBreakdownProps {
  byCategory: Record<ProductCategory, { ativas: number; canceladas: number; faturamento: number }>;
}

export function CategoryBreakdown({ byCategory }: CategoryBreakdownProps) {
  const categories = Object.entries(byCategory).filter(([_, data]) => data.ativas + data.canceladas > 0);

  if (categories.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-semibold mb-4">Por Categoria de Produto</h3>
        <div className="space-y-3">
          {categories.map(([category, data]) => {
            const total = data.ativas + data.canceladas;
            const activePercent = total > 0 ? (data.ativas / total) * 100 : 0;
            
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{category}</span>
                  <span className="text-muted-foreground">
                    {data.ativas} ativas / {data.canceladas} canceladas
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${activePercent}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  {formatCurrency(data.faturamento)} / mês
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
