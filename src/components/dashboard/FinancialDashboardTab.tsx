import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { KPICard } from "@/components/widgets/KPICard";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { LTVWidget } from "@/components/widgets/LTVWidget";
import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { FinancialKPIsWidget } from "@/components/widgets/FinancialKPIsWidget";
import { TopAffiliatesWidget } from "@/components/widgets/TopAffiliatesWidget";
import { RevenueBreakdownWidget } from "@/components/widgets/RevenueBreakdownWidget";
import { DateRange } from "react-day-picker";

interface FinancialDashboardTabProps {
  dateRange?: DateRange;
}

export function FinancialDashboardTab({ dateRange }: FinancialDashboardTabProps) {
  const { data: kiwifyFinancials } = useKiwifyFinancials(dateRange?.from, dateRange?.to);

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
          title="Receita Líquida" 
          value={formatCurrency(kiwifyFinancials?.totalNetRevenue || 0)}
          icon={DollarSign}
          description="depositado"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Receita Bruta" 
          value={formatCurrency(kiwifyFinancials?.totalGrossRevenue || 0)}
          icon={TrendingUp}
          description="vendas totais"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Taxas" 
          value={formatCurrency(kiwifyFinancials?.totalKiwifyFees || 0)}
          icon={Percent}
          description="Kiwify + gateway"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Comissões" 
          value={formatCurrency(kiwifyFinancials?.totalAffiliateCommissions || 0)}
          icon={Users}
          description="afiliados"
        />
      </BentoCard>
      
      {/* ROW 2: Financial Status */}
      <BentoCard span="full">
        <FinancialStatusWidget startDate={dateRange?.from} endDate={dateRange?.to} />
      </BentoCard>
      
      {/* ROW 3: LTV + Conversion */}
      <BentoCard span="2">
        <LTVWidget startDate={dateRange?.from} endDate={dateRange?.to} />
      </BentoCard>
      <BentoCard span="2">
        <ConversionRateWidget startDate={dateRange?.from} endDate={dateRange?.to} />
      </BentoCard>
      
      {/* ROW 4: KPIs + Affiliates */}
      <BentoCard span="2">
        <FinancialKPIsWidget startDate={dateRange?.from} endDate={dateRange?.to} />
      </BentoCard>
      <BentoCard span="2">
        <TopAffiliatesWidget startDate={dateRange?.from} endDate={dateRange?.to} />
      </BentoCard>
      
      {/* ROW 5: Revenue Breakdown */}
      <BentoCard span="full">
        <RevenueBreakdownWidget startDate={dateRange?.from} endDate={dateRange?.to} />
      </BentoCard>
    </BentoGrid>
  );
}
