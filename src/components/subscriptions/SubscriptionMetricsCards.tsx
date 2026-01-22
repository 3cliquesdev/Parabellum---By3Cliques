import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionMetrics, ProductCategory } from "@/hooks/useKiwifySubscriptions";
import { Users, ShoppingCart, DollarSign, RotateCcw, UserPlus, Repeat, Star, Package, Info } from "lucide-react";
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
  value: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  percent?: string;
  percentColor?: string;
  tooltip?: {
    brutas?: number;
    reembolsadas?: number;
    liquidas?: number;
    note?: string;
  };
}

export function SubscriptionMetricsCards({ data }: SubscriptionMetricsCardsProps) {
  if (!data) return null;

  const vendasBrutas = data.vendasBrutas ?? 0;
  const vendasLiquidas = data.vendasLiquidas ?? 0;
  const totalReembolsos = data.reembolsos?.length ?? 0;
  const totalClientes = data.totalAssinaturas ?? 0;
  const clientesNovos = data.clientesNovos ?? 0;
  const novasAssinaturas = data.novasAssinaturas ?? 0;
  const renovacoes = data.renovacoes ?? 0;
  const produtosUnicos = data.produtosUnicos ?? 0;

  // Calcular percentuais
  const percentLiquidas = vendasBrutas > 0 ? ((vendasLiquidas / vendasBrutas) * 100).toFixed(1) : '0';
  const percentReembolsos = vendasBrutas > 0 ? ((totalReembolsos / vendasBrutas) * 100).toFixed(1) : '0';
  const percentClientesNovos = totalClientes > 0 ? ((clientesNovos / totalClientes) * 100).toFixed(0) : '0';
  const percentNovasAssinaturas = vendasLiquidas > 0 ? ((novasAssinaturas / vendasLiquidas) * 100).toFixed(0) : '0';
  const percentRenovacoes = vendasLiquidas > 0 ? ((renovacoes / vendasLiquidas) * 100).toFixed(0) : '0';
  const percentProdutosUnicos = vendasLiquidas > 0 ? ((produtosUnicos / vendasLiquidas) * 100).toFixed(0) : '0';

  // Calcular reembolsos por tipo
  const reembolsosNovasAssinaturas = (data.novasAssinaturasBrutas ?? 0) - (data.novasAssinaturas ?? 0);
  const reembolsosRenovacoes = (data.renovacoesBrutas ?? 0) - (data.renovacoes ?? 0);
  const reembolsosProdutosUnicos = (data.produtosUnicosBrutos ?? 0) - (data.produtosUnicos ?? 0);

  // Linha 1: Resumo do Período
  const resumoMetrics: MetricCardData[] = [
    {
      title: 'Clientes Únicos',
      value: totalClientes.toLocaleString('pt-BR'),
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      tooltip: {
        note: 'Emails únicos que compraram no período. Diferente do Kiwify que mostra assinaturas ativas agora (snapshot).',
      },
    },
    {
      title: 'Vendas Brutas',
      value: vendasBrutas.toLocaleString('pt-BR'),
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      tooltip: {
        note: 'Total de pedidos aprovados no período (antes de reembolsos). Fluxo de vendas.',
      },
    },
    {
      title: 'Vendas Líquidas',
      value: vendasLiquidas.toLocaleString('pt-BR'),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      percent: `${percentLiquidas}%`,
      percentColor: 'text-green-600',
      tooltip: {
        brutas: vendasBrutas,
        reembolsadas: totalReembolsos,
        liquidas: vendasLiquidas,
        note: 'Vendas brutas menos reembolsos processados.',
      },
    },
    {
      title: 'Reembolsos',
      value: totalReembolsos.toLocaleString('pt-BR'),
      icon: RotateCcw,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      percent: `${percentReembolsos}%`,
      percentColor: 'text-red-500',
      tooltip: {
        note: 'Pedidos reembolsados que tiveram aprovação no período selecionado.',
      },
    },
  ];

  // Linha 2: Detalhamento
  const detalhamentoMetrics: MetricCardData[] = [
    {
      title: 'Clientes Novos',
      value: clientesNovos.toLocaleString('pt-BR'),
      icon: UserPlus,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      percent: `${percentClientesNovos}%`,
      percentColor: 'text-emerald-600',
      tooltip: {
        note: `${percentClientesNovos}% dos clientes únicos são novos (primeira compra)`,
      },
    },
    {
      title: 'Novas Assinaturas',
      value: novasAssinaturas.toLocaleString('pt-BR'),
      icon: Star,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      percent: `${percentNovasAssinaturas}%`,
      percentColor: 'text-amber-600',
      tooltip: {
        brutas: data.novasAssinaturasBrutas ?? 0,
        reembolsadas: reembolsosNovasAssinaturas,
        liquidas: novasAssinaturas,
        note: 'Primeira cobrança de assinatura no período (fluxo). Kiwify mostra "Assinaturas" como total ativo agora (snapshot).',
      },
    },
    {
      title: 'Renovações',
      value: renovacoes.toLocaleString('pt-BR'),
      icon: Repeat,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      percent: `${percentRenovacoes}%`,
      percentColor: 'text-cyan-600',
      tooltip: {
        brutas: data.renovacoesBrutas ?? 0,
        reembolsadas: reembolsosRenovacoes,
        liquidas: renovacoes,
        note: 'Cobranças recorrentes de assinaturas existentes.',
      },
    },
    {
      title: 'Produtos Únicos',
      value: produtosUnicos.toLocaleString('pt-BR'),
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      percent: `${percentProdutosUnicos}%`,
      percentColor: 'text-orange-600',
      tooltip: {
        brutas: data.produtosUnicosBrutos ?? 0,
        reembolsadas: reembolsosProdutosUnicos,
        liquidas: produtosUnicos,
        note: 'Vendas de produtos sem recorrência.',
      },
    },
  ];

  const renderCompactCard = (metric: MetricCardData) => (
    <Card key={metric.title} className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${metric.bgColor}`}>
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold leading-none">{metric.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{metric.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {metric.percent && (
              <span className={`text-sm font-medium ${metric.percentColor || 'text-muted-foreground'}`}>
                {metric.percent}
              </span>
            )}
            {metric.tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <Info className="h-3.5 w-3.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <div className="text-xs space-y-1">
                      {metric.tooltip.brutas !== undefined && (
                        <>
                          <p className="font-medium">
                            Brutas: {metric.tooltip.brutas} | Reembolsadas: {metric.tooltip.reembolsadas}
                          </p>
                          <p className="text-muted-foreground">
                            = <span className="font-semibold text-foreground">{metric.tooltip.liquidas}</span> líquidas
                          </p>
                        </>
                      )}
                      {metric.tooltip.note && (
                        <p className={`text-muted-foreground/80 ${metric.tooltip.brutas !== undefined ? 'pt-1 border-t border-border/50 mt-1' : ''}`}>
                          {metric.tooltip.note}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      {/* Linha 1: Resumo do Período */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Resumo do Período</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {resumoMetrics.map(renderCompactCard)}
        </div>
      </div>

      {/* Linha 2: Detalhamento */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Detalhamento por Tipo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {detalhamentoMetrics.map(renderCompactCard)}
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
