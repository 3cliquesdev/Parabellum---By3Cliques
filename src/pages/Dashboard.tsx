import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, TrendingUp, Target, DollarSign, Briefcase } from "lucide-react";
import { useConversionMetrics } from "@/hooks/useConversionMetrics";
import { useFinancialStats } from "@/hooks/useFinancialStats";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { useDeals } from "@/hooks/useDeals";

// KPI Card Component
import { KPICard } from "@/components/widgets/KPICard";

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
  const { totalPipelineValue, weightedValue } = usePipelineValue();
  const { data: deals } = useDeals();

  // Helper function
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openDeals = deals?.filter(d => d.status === 'open').length || 0;

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // VENDEDOR: Dashboard Pessoal - Bento Grid
  if (role && (role as string) === "sales_rep") {
    return (
      <div className="min-h-screen p-4">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Meu Dashboard</h1>
          <p className="text-sm text-slate-500">Suas métricas e atividades pessoais</p>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min">
          {/* ROW 1: 4 KPI Cards (full width on mobile, 1 col each on desktop) */}
          <MySalesWidget userId={user?.id} />
          <MyLeadsWidget userId={user?.id} />
          <div className="col-span-1">
            <KPICard 
              title="Pipeline" 
              value={formatCurrency(weightedValue)} 
              icon={TrendingUp}
              description="ponderado"
            />
          </div>
          <MyPerformanceWidget userId={user?.id} />
          
          {/* ROW 2: Activities + Hot Deals (2x2) */}
          <div className="col-span-full lg:col-span-2">
            <MyActivitiesWidget />
          </div>
          <div className="col-span-full lg:col-span-2">
            <HotDealsWidget />
          </div>
          
          {/* ROW 3: Funil (full width) */}
          <div className="col-span-full">
            <SalesFunnelWidget />
          </div>
          
          {/* ROW 4: Rotten Deals (full width) */}
          <div className="col-span-full">
            <RottenDealsWidget />
          </div>
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

  // ADMIN/MANAGER: Dashboard Geral com Business Intelligence - Bento Grid
  return (
    <div className="min-h-screen p-4">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Dashboard de Vendas</h1>
        <p className="text-sm text-slate-500">Inteligência de negócios em tempo real</p>
      </div>

      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min">
        {/* ROW 1: 4 KPI Cards */}
        <KPICard 
          title="Pipeline" 
          value={formatCurrency(totalPipelineValue)} 
          trend="+12%" 
          icon={TrendingUp}
          description="ponderado"
        />
        <KPICard 
          title="Conversão" 
          value={`${conversionStats?.conversionRate?.toFixed(1) || 0}%`}
          trend="+3%"
          icon={Target}
        />
        <KPICard 
          title="Saldo Líquido" 
          value={formatCurrency(financialStats.balance)}
          trend="+8%"
          icon={DollarSign}
        />
        <KPICard 
          title="Deals Ativos" 
          value={openDeals}
          trend="-2"
          trendUp={false}
          icon={Briefcase}
        />
        
        {/* ROW 2: SLA Alert (full width) */}
        {(role === "admin" || role === "manager") && (
          <div className="col-span-full">
            <SLAAlertWidget />
          </div>
        )}
        
        {/* ROW 3: Charts 2x2 */}
        <div className="col-span-full lg:col-span-2">
          <SalesByRepWidget />
        </div>
        <div className="col-span-full lg:col-span-2">
          <RevenueEvolutionWidget />
        </div>
        
        {/* ROW 4: Funil + Hot Deals */}
        <div className="col-span-full lg:col-span-2">
          <SalesFunnelWidget />
        </div>
        <div className="col-span-full lg:col-span-2">
          <HotDealsWidget />
        </div>
        
        {/* ROW 5: Análises + Ações */}
        <div className="col-span-full lg:col-span-2">
          <RottenDealsWidget />
        </div>
        <div className="col-span-full sm:col-span-1">
          <LostReasonsWidget />
        </div>
        <div className="col-span-full sm:col-span-1">
          <RecentActionsWidget />
        </div>
      </div>
    </div>
  );
}
