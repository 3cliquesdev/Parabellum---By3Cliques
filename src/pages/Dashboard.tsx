import { useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, TrendingUp, Target, DollarSign, Briefcase } from "lucide-react";
import { OnboardingWidget } from "@/components/widgets/OnboardingWidget";
import { useConversionMetrics } from "@/hooks/useConversionMetrics";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { useDeals } from "@/hooks/useDeals";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-container";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";

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
import { WhatsAppStatusWidget } from "@/components/admin/WhatsAppStatusWidget";
import { TeamOnlineWidget } from "@/components/widgets/TeamOnlineWidget";

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
  const { data: kiwifyFinancials } = useKiwifyFinancials();
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
      <PageContainer>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  // VENDEDOR: Dashboard Pessoal - Bento Grid
  // Garantir que user.id existe antes de renderizar widgets
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

  // ADMIN/MANAGER: Dashboard Geral com Business Intelligence - Bento Grid
  return (
    <PageContainer>
      <PageHeader 
        title="Dashboard de Vendas" 
        description="Inteligência de negócios em tempo real" 
      />
      <PageContent>
        <BentoGrid cols={4}>
          {/* ROW 1: 4 KPI Cards */}
          <BentoCard>
            <KPICard 
              title="Pipeline" 
              value={formatCurrency(totalPipelineValue)} 
              trend="+12%" 
              icon={TrendingUp}
              description="ponderado"
            />
          </BentoCard>
          <BentoCard>
            <KPICard 
              title="Conversão" 
              value={`${conversionStats?.conversionRate?.toFixed(1) || 0}%`}
              trend="+3%"
              icon={Target}
            />
          </BentoCard>
          <BentoCard>
            <KPICard 
              title="Receita Líquida" 
              value={formatCurrency(kiwifyFinancials?.totalNetRevenue || 0)}
              trend="+8%"
              icon={DollarSign}
              description="depositado pela Kiwify"
            />
          </BentoCard>
          <BentoCard>
            <KPICard 
              title="Deals Ativos" 
              value={openDeals}
              trend="-2"
              trendUp={false}
              icon={Briefcase}
            />
          </BentoCard>
          
          {/* ROW 2: SLA Alert + WhatsApp Status */}
          {(role === "admin" || role === "manager" || role === "support_manager") && (
            <>
              <BentoCard span="2">
                <SLAAlertWidget />
              </BentoCard>
              <BentoCard span="2">
                <WhatsAppStatusWidget />
              </BentoCard>
              <BentoCard span="2">
                <TeamOnlineWidget />
              </BentoCard>
            </>
          )}
          
          {/* ROW 3: Charts */}
          <BentoCard span="2">
            <SalesByRepWidget />
          </BentoCard>
          <BentoCard span="2">
            <RevenueEvolutionWidget />
          </BentoCard>
          
          {/* ROW 4: Funil + Hot Deals */}
          <BentoCard span="2">
            <SalesFunnelWidget />
          </BentoCard>
          <BentoCard span="2">
            <HotDealsWidget />
          </BentoCard>
          
          {/* ROW 5: Análises + Ações */}
          <BentoCard span="2">
            <RottenDealsWidget />
          </BentoCard>
          <BentoCard>
            <LostReasonsWidget />
          </BentoCard>
          <BentoCard>
            <RecentActionsWidget />
          </BentoCard>
          
          {/* ROW 6: Onboarding Progress (apenas se não completou) */}
          <BentoCard span="full">
            <OnboardingWidget />
          </BentoCard>
        </BentoGrid>
      </PageContent>
    </PageContainer>
  );
}
