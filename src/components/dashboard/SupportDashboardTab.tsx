import { Headphones, Clock, Target } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { KPICard } from "@/components/widgets/KPICard";
import { SLAAlertWidget } from "@/components/widgets/SLAAlertWidget";
import { SupportKPIsWidget } from "@/components/widgets/SupportKPIsWidget";
import { VolumeResolutionWidget } from "@/components/widgets/VolumeResolutionWidget";
import { SLAComplianceWidget } from "@/components/widgets/SLAComplianceWidget";
import { SentimentDistributionWidget } from "@/components/widgets/SentimentDistributionWidget";
import { TopTopicsWidget } from "@/components/widgets/TopTopicsWidget";
import { useSLAAlerts } from "@/hooks/useSLAAlerts";

interface SupportDashboardTabProps {
  dateRange?: DateRange;
}

export function SupportDashboardTab({ dateRange }: SupportDashboardTabProps) {
  const { data: slaAlerts } = useSLAAlerts();
  const activeSlaAlerts = slaAlerts?.length || 0;

  // Default date range if not provided
  const startDate = dateRange?.from || startOfMonth(new Date());
  const endDate = dateRange?.to || endOfMonth(new Date());

  return (
    <BentoGrid cols={4}>
      {/* ROW 1: 4 KPI Cards */}
      <BentoCard>
        <KPICard 
          title="SLA em Risco" 
          value={activeSlaAlerts.toString()}
          icon={Clock}
          description="alertas ativos"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Tickets Abertos" 
          value="--"
          icon={Headphones}
          description="aguardando resposta"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="FRT Médio" 
          value="--"
          icon={Clock}
          description="first response time"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="CSAT" 
          value="--"
          icon={Target}
          description="satisfação do cliente"
        />
      </BentoCard>
      
      {/* ROW 2: SLA Alert + Support KPIs */}
      <BentoCard span="2">
        <SLAAlertWidget />
      </BentoCard>
      <BentoCard span="2">
        <SupportKPIsWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
      
      {/* ROW 3: Volume & Resolution + SLA Compliance */}
      <BentoCard span="2">
        <VolumeResolutionWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
      <BentoCard span="2">
        <SLAComplianceWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
      
      {/* ROW 4: Sentiment + Topics */}
      <BentoCard span="2">
        <SentimentDistributionWidget />
      </BentoCard>
      <BentoCard span="2">
        <TopTopicsWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
    </BentoGrid>
  );
}
