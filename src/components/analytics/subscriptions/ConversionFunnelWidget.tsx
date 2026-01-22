import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Users, ShoppingCart, CreditCard, Package, RefreshCcw, Info } from "lucide-react";
import { SubscriptionMetrics } from "@/hooks/useKiwifySubscriptions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConversionFunnelWidgetProps {
  leadMetrics?: {
    totalCreated: number;
  };
  subscriptionData?: SubscriptionMetrics;
  isLoading: boolean;
}

export function ConversionFunnelWidget({ leadMetrics, subscriptionData, isLoading }: ConversionFunnelWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <Skeleton className="h-24 flex-1" />
                {i < 5 && <Skeleton className="h-6 w-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Métricas do período - FLUXO (vendas ocorridas no período)
  const totalLeads = leadMetrics?.totalCreated || 0;
  const vendasBrutas = subscriptionData?.vendasBrutas || 0;
  const vendasLiquidas = subscriptionData?.vendasLiquidas || 0;
  const totalReembolsos = subscriptionData?.reembolsos?.length || 0;
  
  // Clientes únicos no período
  const clientesUnicos = subscriptionData?.totalAssinaturas || 0;
  const clientesNovos = subscriptionData?.clientesNovos || 0;
  const clientesRecorrentes = subscriptionData?.clientesRecorrentes || 0;
  
  // Vendas por tipo
  const novasAssinaturas = subscriptionData?.novasAssinaturas || 0;
  const renovacoes = subscriptionData?.renovacoes || 0;
  const produtosUnicos = subscriptionData?.produtosUnicos || 0;
  
  // Métricas brutas para tooltips
  const novasAssinaturasBrutas = subscriptionData?.novasAssinaturasBrutas || 0;
  const renovacoesBrutas = subscriptionData?.renovacoesBrutas || 0;
  
  // Contar produtos únicos e ofertas únicas
  const uniqueProducts = new Set(subscriptionData?.subscriptions?.map(s => s.productName) || []).size;
  const uniqueOffers = new Set(subscriptionData?.subscriptions?.map(s => s.offerName).filter(Boolean) || []).size;

  // Calculate conversion rates between stages
  const leadsToSalesRate = totalLeads > 0 ? ((vendasBrutas / totalLeads) * 100).toFixed(1) : "0.0";
  
  // Churn rate baseado em reembolsos vs vendas brutas
  const churnRate = vendasBrutas > 0 ? ((totalReembolsos / vendasBrutas) * 100).toFixed(1) : "0.0";

  const stages = [
    {
      label: "Leads",
      value: totalLeads,
      icon: Users,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
      tooltip: "Total de leads criados no período selecionado (deals no CRM).",
    },
    {
      label: "Vendas Brutas",
      value: vendasBrutas,
      icon: ShoppingCart,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgLight: "bg-green-50",
      conversionRate: leadsToSalesRate,
      tooltip: `Pedidos aprovados no período. Líquidas (após reembolsos): ${vendasLiquidas.toLocaleString("pt-BR")}.`,
    },
    {
      label: "Clientes Únicos",
      value: clientesUnicos,
      icon: CreditCard,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
      subtext: `${clientesNovos} novos | ${clientesRecorrentes} recorrentes`,
      tooltip: `Emails únicos que compraram no período. Novos: primeira compra ever. Recorrentes: já compraram antes.`,
    },
    {
      label: "Assinaturas",
      value: novasAssinaturas + renovacoes,
      icon: Package,
      color: "bg-amber-500",
      textColor: "text-amber-600",
      bgLight: "bg-amber-50",
      subtext: `${novasAssinaturas} novas | ${renovacoes} renov.`,
      tooltip: `Vendas de planos no período. Novas: 1ª cobrança (brutas: ${novasAssinaturasBrutas}). Renovações: cobranças recorrentes (brutas: ${renovacoesBrutas}). + ${produtosUnicos} produtos únicos.`,
    },
    {
      label: "Reembolsos",
      value: totalReembolsos,
      icon: RefreshCcw,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgLight: "bg-red-50",
      churnRate: churnRate,
      tooltip: `Pedidos reembolsados que foram originalmente aprovados no período selecionado.`,
    },
  ];

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Funil de Conversão
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Métricas de <strong>fluxo</strong>: vendas que ocorreram no período selecionado. 
                  Diferente do dashboard Kiwify que mostra <strong>snapshot</strong> de assinaturas ativas agora.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch justify-between gap-1 md:gap-3">
            {stages.map((stage, index) => (
              <div key={stage.label} className="flex items-center gap-1 md:gap-3 flex-1">
                {/* Stage Card */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex-1 rounded-lg p-3 md:p-4 ${stage.bgLight} border border-border/50 text-center transition-all hover:shadow-md cursor-help`}>
                      <div className={`mx-auto w-8 h-8 md:w-10 md:h-10 rounded-full ${stage.color} flex items-center justify-center mb-2`}>
                        <stage.icon className="h-4 w-4 md:h-5 md:w-5 text-white" />
                      </div>
                      <div className={`text-xl md:text-2xl font-bold ${stage.textColor}`}>
                        {stage.value.toLocaleString("pt-BR")}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        {stage.label}
                      </div>
                      {stage.conversionRate && (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          {stage.conversionRate}% conv.
                        </div>
                      )}
                      {stage.subtext && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {stage.subtext}
                        </div>
                      )}
                      {stage.churnRate && (
                        <div className="text-xs text-red-600 font-medium mt-1">
                          {stage.churnRate}% churn
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-xs">{stage.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
                
                {/* Arrow connector */}
                {index < stages.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground/50 shrink-0 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
