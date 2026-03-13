import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, TrendingUp, LayoutGrid, Headphones, DollarSign, Settings, UserMinus, Target, Sparkles, Activity } from "lucide-react";
import { OnboardingWidget } from "@/components/widgets/OnboardingWidget";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-container";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// KPI Card Component
import { KPICard } from "@/components/widgets/KPICard";

// Widgets Sales Rep
import { MySalesWidget } from "@/components/widgets/MySalesWidget";
import { MyActivitiesWidget } from "@/components/widgets/MyActivitiesWidget";
import { MyLeadsWidget } from "@/components/widgets/MyLeadsWidget";
import { MyPerformanceWidget } from "@/components/widgets/MyPerformanceWidget";
import { HotDealsWidget } from "@/components/widgets/HotDealsWidget";
import { SalesFunnelWidget } from "@/components/widgets/SalesFunnelWidget";
import RottenDealsWidget from "@/components/widgets/RottenDealsWidget";

// Dashboard Tabs (existing)
import {
  OverviewDashboardTab,
  SalesDashboardTab,
  SupportDashboardTab,
  FinancialDashboardTab,
  OperationalDashboardTab,
} from "@/components/dashboard";

// Premium Tabs (absorbed from AnalyticsPremium)
import { ChurnAnalysisTab } from "@/components/analytics/ChurnAnalysisTab";
import { PerformanceTab } from "@/components/analytics/PerformanceTab";
import { AdvancedTab } from "@/components/analytics/AdvancedTab";

// AI Telemetry (absorbed into dashboard)
import { AITelemetryContent } from "@/pages/AITelemetry";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "overview";
  
  // Deep-link: /?tab=sales ou /?tab=vendas
  const tabParam = searchParams.get("tab");
  const TAB_ALIAS: Record<string, string> = { vendas: "sales" };
  const VALID_TABS = ["overview", "sales", "support", "financial", "operations", "churn", "performance", "advanced", "ai-telemetry"];
  const resolvedTab = TAB_ALIAS[tabParam || ""] || tabParam || "";
  const initialTab = VALID_TABS.includes(resolvedTab) ? resolvedTab : "overview";
  const { role, loading } = useUserRole();
  const { user } = useAuth();
  
  // Date range state for filtering
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));

  // Derived start/end dates for premium tabs
  const { startDate, endDate } = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { startDate: start, endDate: end };
  }, [dateRange]);
  
  const { weightedValue } = usePipelineValue();

  // Helper function
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
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

  // ADMIN/MANAGER: Dashboard Unificado com Tabs por Área
  return (
    <PageContainer>
      <PageHeader 
        title="Dashboard" 
        description="Visão geral do sistema"
      >
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </PageHeader>
      <PageContent>
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="mb-6 bg-muted/50 p-1 flex-wrap h-auto">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <Headphones className="h-4 w-4" />
              Suporte
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-2">
              <Settings className="h-4 w-4" />
              Operacional
            </TabsTrigger>
            <TabsTrigger value="churn" className="gap-2">
              <UserMinus className="h-4 w-4" />
              Churn
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Target className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Avançado
            </TabsTrigger>
            <TabsTrigger value="ai-telemetry" className="gap-2">
              <Activity className="h-4 w-4" />
              AI Telemetria
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <OverviewDashboardTab dateRange={dateRange} />
          </TabsContent>
          
          <TabsContent value="sales">
            <SalesDashboardTab dateRange={dateRange} />
          </TabsContent>
          
          <TabsContent value="support">
            <SupportDashboardTab dateRange={dateRange} />
          </TabsContent>
          
          <TabsContent value="financial">
            <FinancialDashboardTab dateRange={dateRange} />
          </TabsContent>
          
          <TabsContent value="operations">
            <OperationalDashboardTab dateRange={dateRange} />
          </TabsContent>
          
          <TabsContent value="churn">
            <ChurnAnalysisTab startDate={startDate} endDate={endDate} />
          </TabsContent>
          
          <TabsContent value="performance">
            <PerformanceTab startDate={startDate} endDate={endDate} />
          </TabsContent>
          
          <TabsContent value="advanced">
            <AdvancedTab startDate={startDate} endDate={endDate} />
          </TabsContent>
          
          <TabsContent value="ai-telemetry">
            <AITelemetryContent />
          </TabsContent>
        </Tabs>
        
        {/* Onboarding Widget - aparece em todas as tabs se não completou */}
        <div className="mt-6">
          <OnboardingWidget />
        </div>
      </PageContent>
    </PageContainer>
  );
}
