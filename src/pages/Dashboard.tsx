import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConversionMetrics } from "@/hooks/useConversionMetrics";
import { useFinancialStats } from "@/hooks/useFinancialStats";

// Widgets BI - KPIs
import { PipelineValueWidget } from "@/components/widgets/PipelineValueWidget";

// Widgets BI - Gráficos
import { SalesByRepWidget } from "@/components/widgets/SalesByRepWidget";
import { RevenueEvolutionWidget } from "@/components/widgets/RevenueEvolutionWidget";
import { SalesFunnelWidget } from "@/components/widgets/SalesFunnelWidget";
import { HotDealsWidget } from "@/components/widgets/HotDealsWidget";

// Widgets Legacy
import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { LTVWidget } from "@/components/widgets/LTVWidget";
import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { RecentActionsWidget } from "@/components/widgets/RecentActionsWidget";
import RottenDealsWidget from "@/components/widgets/RottenDealsWidget";
import LostReasonsWidget from "@/components/widgets/LostReasonsWidget";
import { SLAAlertWidget } from "@/components/widgets/SLAAlertWidget";

// Widgets Sales Rep
import { MySalesWidget } from "@/components/widgets/MySalesWidget";
import { MyActivitiesWidget } from "@/components/widgets/MyActivitiesWidget";
import { MyLeadsWidget } from "@/components/widgets/MyLeadsWidget";
import { MyPerformanceWidget } from "@/components/widgets/MyPerformanceWidget";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "overview";
  const { role, loading } = useUserRole();
  const { user } = useAuth();
  
  // ✅ Todos os hooks no topo - antes de qualquer return condicional
  const { data: conversionStats } = useConversionMetrics();
  const financialStats = useFinancialStats();

  // Helper function
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // VENDEDOR: Dashboard Pessoal
  if (role && (role as string) === "sales_rep") {
    return (
      <div className="min-h-screen p-4 flex flex-col gap-4">
        <div className="mb-2">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Meu Dashboard</h1>
          <p className="text-sm text-slate-500">Suas métricas e atividades pessoais</p>
        </div>

        {/* Linha 1: Vendas + Pipeline Ponderado */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <MySalesWidget userId={user?.id} />
          <PipelineValueWidget />
        </div>

        {/* Linha 2: Leads + Atividades */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <MyLeadsWidget userId={user?.id} />
          <MyActivitiesWidget />
        </div>

        {/* Linha 3: Hot Deals + Performance */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <HotDealsWidget />
          <MyPerformanceWidget userId={user?.id} />
        </div>

        {/* Linha 4: Funil Pessoal */}
        <div className="w-full">
          <SalesFunnelWidget />
        </div>

        {/* Linha 5: Negócios Estagnados */}
        <div className="w-full">
          <RottenDealsWidget />
        </div>
      </div>
    );
  }

  // Visualização Financeira - apenas widgets financeiros
  if (view === "financial") {
    return (
      <div className="min-h-screen p-4 flex flex-col gap-4">
        <div className="w-full">
          <FinancialStatusWidget />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
          <div className="min-h-[400px]">
            <LTVWidget />
          </div>
          <div className="min-h-[400px]">
            <ConversionRateWidget />
          </div>
        </div>
      </div>
    );
  }

  // ADMIN/MANAGER: Dashboard Geral com Business Intelligence
  return (
    <div className="min-h-screen p-4 flex flex-col gap-4">
      <div className="mb-2">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Dashboard de Vendas</h1>
        <p className="text-sm text-slate-500">Inteligência de negócios em tempo real</p>
      </div>

      {/* LINHA 0: SLA Alerts (Admin/Manager only) */}
      {(role === "admin" || role === "manager") && (
        <div className="w-full">
          <SLAAlertWidget />
        </div>
      )}

      {/* LINHA 1: KPIs Cards (3 colunas) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PipelineValueWidget />
        
        {/* Taxa de Conversão simplificada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎯 Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {conversionStats?.conversionRate?.toFixed(1) || 0}%
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {conversionStats?.wonDeals || 0} ganhos /{" "}
              {(conversionStats?.wonDeals || 0) + (conversionStats?.lostDeals || 0)}{" "}
              finalizados
            </p>
          </CardContent>
        </Card>

        {/* Saldo Líquido simplificado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💵 Saldo Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {formatCurrency(financialStats.balance)}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Lucro acumulado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* LINHA 2: Gráficos Principais (2 colunas) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SalesByRepWidget />
        <RevenueEvolutionWidget />
      </div>

      {/* LINHA 3: Funil + Hot Deals (2 colunas) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SalesFunnelWidget />
        <HotDealsWidget />
      </div>

      {/* LINHA 4: Análises Complementares (2 colunas) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RottenDealsWidget />
        <LostReasonsWidget />
      </div>

      {/* LINHA 5: Ações Recentes (Full Width) */}
      <div className="w-full">
        <RecentActionsWidget />
      </div>
    </div>
  );
}
