import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionMetrics, ProductCategory } from "@/hooks/useKiwifySubscriptions";
import { Users, ShoppingCart, DollarSign, RotateCcw, UserPlus, UserCheck, Repeat, Star, Package, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SubscriptionMetricsCardsProps {
  data?: SubscriptionMetrics;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

interface MetricCardData {
  title: string;
  subtitle: string;
  value: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  tooltip?: {
    brutas: number;
    reembolsadas: number;
    liquidas: number;
    note?: string;
  };
}

export function SubscriptionMetricsCards({ data }: SubscriptionMetricsCardsProps) {
  if (!data) return null;

  // Calcular reembolsos por tipo
  const reembolsosNovasAssinaturas = (data.novasAssinaturasBrutas ?? 0) - (data.novasAssinaturas ?? 0);
  const reembolsosRenovacoes = (data.renovacoesBrutas ?? 0) - (data.renovacoes ?? 0);
  const reembolsosProdutosUnicos = (data.produtosUnicosBrutos ?? 0) - (data.produtosUnicos ?? 0);

  // Primeira linha: Clientes
  const clientesMetrics: MetricCardData[] = [
    {
      title: 'Clientes Únicos',
      subtitle: 'Emails distintos',
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
  ];

  // Segunda linha: Vendas
  const vendasMetrics: MetricCardData[] = [
    {
      title: 'Vendas Brutas',
      subtitle: 'Total de orders',
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

  // Terceira linha: Classificação por Tipo (alinhado com Kiwify) - COM TOOLTIPS
  const tipoVendaMetrics: MetricCardData[] = [
    {
      title: 'Vendas de Assinatura',
      subtitle: 'Primeira cobrança',
      value: (data.novasAssinaturas ?? 0).toLocaleString('pt-BR'),
      icon: Star,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      tooltip: {
        brutas: data.novasAssinaturasBrutas ?? 0,
        reembolsadas: reembolsosNovasAssinaturas,
        liquidas: data.novasAssinaturas ?? 0,
        note: 'Kiwify mostra assinaturas ativas agora. Aqui mostramos vendas criadas no período.',
      },
    },
    {
      title: 'Renovações',
      subtitle: 'Cobranças recorrentes',
      value: (data.renovacoes ?? 0).toLocaleString('pt-BR'),
      icon: Repeat,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      tooltip: {
        brutas: data.renovacoesBrutas ?? 0,
        reembolsadas: reembolsosRenovacoes,
        liquidas: data.renovacoes ?? 0,
      },
    },
    {
      title: 'Produtos Únicos',
      subtitle: 'Sem recorrência',
      value: (data.produtosUnicos ?? 0).toLocaleString('pt-BR'),
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      tooltip: {
        brutas: data.produtosUnicosBrutos ?? 0,
        reembolsadas: reembolsosProdutosUnicos,
        liquidas: data.produtosUnicos ?? 0,
      },
    },
  ];

  const renderMetricCard = (metric: MetricCardData) => (
    <Card key={metric.title}>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col items-center text-center relative">
          {/* Tooltip indicator for cards with tooltip data */}
          {metric.tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute top-0 right-0 cursor-help">
                    <Info className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px]">
                  <div className="text-xs space-y-1">
                    <p className="font-medium">
                      Brutas: {metric.tooltip.brutas} | Reembolsadas: {metric.tooltip.reembolsadas}
                    </p>
                    <p className="text-muted-foreground">
                      = <span className="font-semibold text-foreground">{metric.tooltip.liquidas}</span> líquidas
                    </p>
                    {metric.tooltip.note && (
                      <p className="text-muted-foreground/80 pt-1 border-t border-border/50 mt-1">
                        {metric.tooltip.note}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <div className={`p-2 rounded-full ${metric.bgColor} mb-2`}>
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
          </div>
          <p className="text-2xl font-bold">{metric.value}</p>
          <p className="text-xs font-medium text-muted-foreground">{metric.title}</p>
          <p className="text-xs text-muted-foreground/70">{metric.subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Linha 1: Clientes */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Clientes</p>
        <div className="grid grid-cols-3 gap-4">
          {clientesMetrics.map(renderMetricCard)}
        </div>
      </div>

      {/* Linha 2: Vendas */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Vendas</p>
        <div className="grid grid-cols-3 gap-4">
          {vendasMetrics.map(renderMetricCard)}
        </div>
      </div>

      {/* Linha 3: Tipo de Venda (métricas Kiwify) */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Tipo de Venda</p>
        <div className="grid grid-cols-3 gap-4">
          {tipoVendaMetrics.map(renderMetricCard)}
        </div>
      </div>
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
