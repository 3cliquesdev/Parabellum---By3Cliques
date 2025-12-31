import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { Loader2, TrendingUp, Target, DollarSign, Briefcase, Clock, Users, PlusCircle, BarChart3 } from "lucide-react";
import { OnboardingWidget } from "@/components/widgets/OnboardingWidget";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-container";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DashboardExportPDF } from "@/components/premium/DashboardExportPDF";

// Premium Widgets
import { PremiumKPICard } from "@/components/widgets/premium/PremiumKPICard";
import { RevenueTimelineChart } from "@/components/widgets/premium/RevenueTimelineChart";
import { TopPerformersWidget } from "@/components/widgets/premium/TopPerformersWidget";
import { TeamActivitiesWidget } from "@/components/widgets/premium/TeamActivitiesWidget";
import { PipelineFunnelChart } from "@/components/widgets/premium/PipelineFunnelChart";

// Widgets Legacy
import { SLAAlertWidget } from "@/components/widgets/SLAAlertWidget";
import { WhatsAppStatusWidget } from "@/components/admin/WhatsAppStatusWidget";
import { HotDealsWidget } from "@/components/widgets/HotDealsWidget";
import RottenDealsWidget from "@/components/widgets/RottenDealsWidget";
import LostReasonsWidget from "@/components/widgets/LostReasonsWidget";

// Widgets Sales Rep
import { MySalesWidget } from "@/components/widgets/MySalesWidget";
import { MyActivitiesWidget } from "@/components/widgets/MyActivitiesWidget";
import { MyLeadsWidget } from "@/components/widgets/MyLeadsWidget";
import { MyPerformanceWidget } from "@/components/widgets/MyPerformanceWidget";
import { SalesFunnelWidget } from "@/components/widgets/SalesFunnelWidget";
import { KPICard } from "@/components/widgets/KPICard";
import { usePipelineValue } from "@/hooks/usePipelineValue";

// Widgets Financeiros
import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { LTVWidget } from "@/components/widgets/LTVWidget";
import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "overview";
  const { role, loading } = useUserRole();
  const { user } = useAuth();
  
  // Default date range: This Month
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  
  // Dashboard metrics based on date range
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(dateRange);
  const { weightedValue } = usePipelineValue();

  // Helper function
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  // VENDEDOR: Dashboard Pessoal - Bento Grid
  if (role && (role as string) === "sales_rep" && user?.id) {
    return (
      <PageContainer>
        <PageHeader 
          title="Meu Dashboard" 
          description="Suas métricas e atividades pessoais" 
        />
        <PageContent>
          <BentoGrid cols={4}>
            {/* ROW 1: 4 KPI Cards */}
            <BentoCard>
              <MySalesWidget userId={user?.id} />
            </BentoCard>
            <BentoCard>
              <MyLeadsWidget userId={user?.id} />
            </BentoCard>
            <BentoCard>
              <KPICard 
                title="Pipeline" 
                value={formatCurrency(weightedValue)} 
                icon={TrendingUp}
                description="ponderado"
              />
            </BentoCard>
            <BentoCard>
              <MyPerformanceWidget userId={user?.id} />
            </BentoCard>
            
            {/* ROW 2: Activities + Hot Deals */}
            <BentoCard span="2">
              <MyActivitiesWidget />
            </BentoCard>
            <BentoCard span="2">
              <HotDealsWidget />
            </BentoCard>
            
            {/* ROW 3: Funil */}
            <BentoCard span="full">
              <SalesFunnelWidget />
            </BentoCard>
            
            {/* ROW 4: Rotten Deals */}
            <BentoCard span="full">
              <RottenDealsWidget />
            </BentoCard>
          </BentoGrid>
        </PageContent>
      </PageContainer>
    );
  }

  // Visualização Financeira - widgets financeiros
  if (view === "financial") {
    return (
      <PageContainer>
        <PageHeader title="Dashboard Financeiro" description="Análise de receitas e vendas" />
        <PageContent>
          <div className="space-y-6">
            <FinancialStatusWidget />
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="min-h-[400px]">
                <LTVWidget />
              </div>
              <div className="min-h-[400px]">
                <ConversionRateWidget />
              </div>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  // ADMIN/MANAGER: Dashboard Premium com Filtro Global
  return (
    <PageContainer>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Vendas</h1>
          <p className="text-sm text-muted-foreground">Métricas em tempo real com filtro por período</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker 
            value={dateRange} 
            onChange={setDateRange}
          />
          <DashboardExportPDF 
            containerId="dashboard-premium-content" 
            dateRange={dateRange}
          />
        </div>
      </div>
      
      <PageContent>
        <div id="dashboard-premium-content" className="space-y-4">
          {/* ROW 1: KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PremiumKPICard
              title="Receita Fechada"
              value={formatCurrency(metrics?.revenueWon || 0)}
              subtitle="no período"
              change={metrics?.revenueChange}
              icon={DollarSign}
              iconColor="text-emerald-600"
              isLoading={metricsLoading}
              variant="success"
              tooltip="Receita total de deals ganhos no período selecionado"
            />
            <PremiumKPICard
              title="Pipeline Previsto"
              value={formatCurrency(metrics?.weightedPipeline || 0)}
              subtitle="ponderado por probabilidade"
              icon={BarChart3}
              iconColor="text-blue-600"
              isLoading={metricsLoading}
              tooltip="Soma dos valores de deals abertos multiplicados pela probabilidade"
            />
            <PremiumKPICard
              title="Taxa de Conversão"
              value={`${(metrics?.conversionRate || 0).toFixed(1)}%`}
              subtitle={`${metrics?.dealsWon || 0} ganhos / ${(metrics?.dealsWon || 0) + (metrics?.dealsLost || 0)} fechados`}
              change={metrics?.conversionChange}
              icon={Target}
              iconColor="text-purple-600"
              isLoading={metricsLoading}
              tooltip="Percentual de deals ganhos sobre total de deals fechados"
            />
            <PremiumKPICard
              title="Ciclo de Vendas"
              value={`${metrics?.avgSalesCycle || 0} dias`}
              subtitle="tempo médio até fechamento"
              change={metrics?.salesCycleChange}
              changeLabel="dias vs anterior"
              icon={Clock}
              iconColor="text-amber-600"
              isLoading={metricsLoading}
              tooltip="Média de dias desde criação até fechamento do deal"
            />
          </div>
          
          {/* ROW 2: KPIs Secundários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PremiumKPICard
              title="Pipeline Total"
              value={formatCurrency(metrics?.pipelineTotal || 0)}
              subtitle={`${metrics?.dealsOpen || 0} deals abertos`}
              icon={Briefcase}
              iconColor="text-primary"
              isLoading={metricsLoading}
            />
            <PremiumKPICard
              title="Deals Ganhos"
              value={metrics?.dealsWon || 0}
              subtitle="no período"
              icon={TrendingUp}
              iconColor="text-emerald-600"
              isLoading={metricsLoading}
              variant="success"
            />
            <PremiumKPICard
              title="Deals Perdidos"
              value={metrics?.dealsLost || 0}
              subtitle="no período"
              icon={Target}
              iconColor="text-red-500"
              isLoading={metricsLoading}
              variant="danger"
            />
            <PremiumKPICard
              title="Novos Deals"
              value={metrics?.newDealsCreated || 0}
              subtitle="criados no período"
              change={metrics?.newDealsChange}
              icon={PlusCircle}
              iconColor="text-blue-600"
              isLoading={metricsLoading}
            />
          </div>
          
          {/* ROW 3: Admin Alerts (only for admin/manager) */}
          {(role === "admin" || role === "manager") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SLAAlertWidget />
              <WhatsAppStatusWidget />
            </div>
          )}
          
          {/* ROW 4: Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueTimelineChart dateRange={dateRange} />
            <PipelineFunnelChart />
          </div>
          
          {/* ROW 5: Rankings + Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopPerformersWidget dateRange={dateRange} />
            <TeamActivitiesWidget dateRange={dateRange} />
          </div>
          
          {/* ROW 6: Hot Deals + Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HotDealsWidget />
            <RottenDealsWidget />
          </div>
          
          {/* ROW 7: Lost Reasons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LostReasonsWidget />
            <OnboardingWidget />
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
}
