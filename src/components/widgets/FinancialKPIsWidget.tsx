import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { DollarSign, TrendingUp, CreditCard, Users, HelpCircle } from "lucide-react";

interface FinancialKPIsWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function FinancialKPIsWidget({ startDate, endDate }: FinancialKPIsWidgetProps) {
  const { data, isLoading, error } = useKiwifyFinancials(startDate, endDate);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">Erro ao carregar KPIs financeiros</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const kpis = [
    {
      title: "Receita Bruta Total",
      value: data?.totalGrossRevenue || 0,
      icon: DollarSign,
      description: "Valor total recebido pelos clientes",
      tooltip: "Soma de todos os valores pagos pelos clientes antes de qualquer dedução.",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Receita Líquida Total",
      value: data?.totalNetRevenue || 0,
      icon: TrendingUp,
      description: "Valor depositado pela Kiwify",
      tooltip: `Valor que você efetivamente recebe após todas as deduções:\n\nReceita Bruta: ${formatCurrency(data?.totalGrossRevenue || 0)}\n- Taxas Kiwify: ${formatCurrency(data?.totalKiwifyFees || 0)}\n- Comissões: ${formatCurrency(data?.totalAffiliateCommissions || 0)}\n= Líquido: ${formatCurrency(data?.totalNetRevenue || 0)}`,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Taxas Kiwify",
      value: data?.totalKiwifyFees || 0,
      icon: CreditCard,
      description: "Total pago em taxas da plataforma",
      tooltip: "Valor retido pela Kiwify como taxa de transação (aproximadamente 8,99% + IOF).",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Comissões Afiliados",
      value: data?.totalAffiliateCommissions || 0,
      icon: Users,
      description: "Total pago em comissões",
      tooltip: "Valor pago aos afiliados que promoveram suas vendas.",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <TooltipProvider>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs whitespace-pre-line">{kpi.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(kpi.value)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpi.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
