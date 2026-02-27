import { Headphones, Clock, Target, MessageSquare } from "lucide-react";
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
import { TopTagsWidget } from "@/components/widgets/TopTagsWidget";
import { useSupportMetrics, useSupportDashboardCounts } from "@/hooks/useSupportMetrics";

interface SupportDashboardTabProps {
  dateRange?: DateRange;
}

export function SupportDashboardTab({ dateRange }: SupportDashboardTabProps) {
  const startDate = dateRange?.from || startOfMonth(new Date());
  const endDate = dateRange?.to || endOfMonth(new Date());

  const { data: supportMetrics } = useSupportMetrics(startDate, endDate);
  const { data: counts } = useSupportDashboardCounts(startDate, endDate);

  const formatTime = (minutes: number | undefined) => {
    if (!minutes || minutes === 0) return "0s";
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    if (minutes >= 1) {
      const mins = Math.floor(minutes);
      const secs = Math.round((minutes - mins) * 60);
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    return `${Math.round(minutes * 60)}s`;
  };

  return (
    <BentoGrid cols={4}>
      {/* ROW 1: 4 KPI Cards */}
      <BentoCard>
        <KPICard 
          title="SLA em Risco" 
          value={(counts?.sla_risk || 0).toString()}
          icon={Clock}
          description="no período"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Tickets Abertos" 
          value={(counts?.tickets_open || 0).toString()}
          icon={Headphones}
          description="no período"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Conversas" 
          value={(counts?.conversations_open || 0).toString()}
          icon={MessageSquare}
          description={`${counts?.conversations_closed || 0} encerradas`}
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="CSAT" 
          value={supportMetrics?.avgCSAT ? `${supportMetrics.avgCSAT.toFixed(1)}/5` : "0/5"}
          icon={Target}
          description={`${supportMetrics?.totalRatings || 0} avaliações`}
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
      
      {/* ROW 4: Tags + Categorias */}
      <BentoCard span="2">
        <TopTagsWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
      <BentoCard span="2">
        <TopTopicsWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
      
      {/* ROW 5: Sentiment */}
      <BentoCard span="4">
        <SentimentDistributionWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
    </BentoGrid>
  );
}
