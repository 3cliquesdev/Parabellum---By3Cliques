import { TrendingUp, Target, DollarSign, Clock } from "lucide-react";
import { DateRange } from "react-day-picker";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { KPICard } from "@/components/widgets/KPICard";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";

// Widgets de Vendas
import { SalesByRepWidget } from "@/components/widgets/SalesByRepWidget";
import { RevenueEvolutionWidget } from "@/components/widgets/RevenueEvolutionWidget";
import { SalesFunnelWidget } from "@/components/widgets/SalesFunnelWidget";
import { HotDealsWidget } from "@/components/widgets/HotDealsWidget";
import { ConversionFunnelCard } from "@/components/widgets/ConversionFunnelCard";
import { StageConversionChart } from "@/components/widgets/StageConversionChart";
import RottenDealsWidget from "@/components/widgets/RottenDealsWidget";
import LostReasonsWidget from "@/components/widgets/LostReasonsWidget";
import { FormLeadsChartWidget } from "@/components/widgets/FormLeadsChartWidget";

interface SalesDashboardTabProps {
  dateRange?: DateRange;
}

export function SalesDashboardTab({ dateRange }: SalesDashboardTabProps) {
  const { data: kiwifyFinancials } = useKiwifyFinancials();
  const { totalPipelineValue } = usePipelineValue();
  const { data: conversionData } = useDealsConversionAnalysis(dateRange);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <BentoGrid cols={4}>
      {/* ROW 1: 4 KPI Cards */}
      <BentoCard>
        <KPICard 
          title="Pipeline" 
          value={formatCurrency(totalPipelineValue)} 
          trend="+12%" 
          icon={TrendingUp}
          description="valor total"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Criados → Ganhos" 
          value={`${conversionData?.createdToWonRate?.toFixed(1) || 0}%`}
          trend="+3%"
          icon={Target}
          description={`${conversionData?.totalWon || 0} de ${conversionData?.totalCreated || 0}`}
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
          title="Ciclo Médio" 
          value={`${conversionData?.avgTimeToWinDays || 0} dias`}
          icon={Clock}
          description="tempo p/ ganhar"
        />
      </BentoCard>
      
      {/* ROW 2: Charts */}
      <BentoCard span="2">
        <SalesByRepWidget />
      </BentoCard>
      <BentoCard span="2">
        <RevenueEvolutionWidget />
      </BentoCard>
      
      {/* ROW 3: Funil + Hot Deals */}
      <BentoCard span="2">
        <SalesFunnelWidget />
      </BentoCard>
      <BentoCard span="2">
        <HotDealsWidget />
      </BentoCard>
      
      {/* ROW 4: Funil de Conversão */}
      <BentoCard span="2">
        <ConversionFunnelCard dateRange={dateRange} />
      </BentoCard>
      <BentoCard span="2">
        <StageConversionChart />
      </BentoCard>
      
      {/* ROW 5: Análises */}
      <BentoCard span="2">
        <RottenDealsWidget />
      </BentoCard>
      <BentoCard span="2">
        <LostReasonsWidget />
      </BentoCard>
      
      {/* ROW 6: Leads de Formulários */}
      <BentoCard span="full">
        <FormLeadsChartWidget dateRange={dateRange} />
      </BentoCard>
    </BentoGrid>
  );
}
