import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Users, ShoppingCart, CreditCard, Package, RefreshCcw } from "lucide-react";
import { KiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";

interface ConversionFunnelWidgetProps {
  leadMetrics?: {
    totalCreated: number;
  };
  kiwifyMetrics?: KiwifyCompleteMetrics;
  isLoading: boolean;
}

export function ConversionFunnelWidget({ leadMetrics, kiwifyMetrics, isLoading }: ConversionFunnelWidgetProps) {
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

  const totalLeads = leadMetrics?.totalCreated || 0;
  const totalSales = kiwifyMetrics?.vendasAprovadas || 0;
  const activeSubscriptions = kiwifyMetrics?.clientesUnicos || 0;
  const uniqueProducts = kiwifyMetrics?.porProduto?.length || 0;
  const totalRefunds = (kiwifyMetrics?.reembolsos?.quantidade || 0) + (kiwifyMetrics?.chargebacks?.quantidade || 0);

  // Calculate conversion rates between stages
  const leadsToSalesRate = totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : "0.0";
  const churnRate = kiwifyMetrics?.taxaChurn?.toFixed(1) || "0.0";

  const stages = [
    {
      label: "Leads",
      value: totalLeads,
      icon: Users,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgLight: "bg-blue-50",
    },
    {
      label: "Vendas",
      value: totalSales,
      icon: ShoppingCart,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgLight: "bg-green-50",
      conversionRate: leadsToSalesRate,
    },
    {
      label: "Assinaturas",
      value: activeSubscriptions,
      icon: CreditCard,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgLight: "bg-purple-50",
    },
    {
      label: "Produtos",
      value: uniqueProducts,
      icon: Package,
      color: "bg-amber-500",
      textColor: "text-amber-600",
      bgLight: "bg-amber-50",
    },
    {
      label: "Reembolsos",
      value: totalRefunds,
      icon: RefreshCcw,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgLight: "bg-red-50",
      churnRate: churnRate,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch justify-between gap-1 md:gap-3">
          {stages.map((stage, index) => (
            <div key={stage.label} className="flex items-center gap-1 md:gap-3 flex-1">
              {/* Stage Card */}
              <div className={`flex-1 rounded-lg p-3 md:p-4 ${stage.bgLight} border border-border/50 text-center transition-all hover:shadow-md`}>
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
                {stage.churnRate && (
                  <div className="text-xs text-red-600 font-medium mt-1">
                    {stage.churnRate}% churn
                  </div>
                )}
              </div>
              
              {/* Arrow connector */}
              {index < stages.length - 1 && (
                <ArrowRight className="h-5 w-5 text-muted-foreground/50 shrink-0 hidden md:block" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
