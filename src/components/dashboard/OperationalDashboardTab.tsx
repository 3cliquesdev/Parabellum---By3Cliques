import { MessageSquare, Users, Clock } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { KPICard } from "@/components/widgets/KPICard";
import { WhatsAppStatusWidget } from "@/components/admin/WhatsAppStatusWidget";
import { TeamOnlineWidget } from "@/components/widgets/TeamOnlineWidget";
import { TeamEfficiencyWidget } from "@/components/widgets/TeamEfficiencyWidget";
import { BusyHoursHeatmap } from "@/components/widgets/BusyHoursHeatmap";
import { ChannelPerformanceComparison } from "@/components/widgets/ChannelPerformanceComparison";
import { AIUsageWidget } from "@/components/widgets/AIUsageWidget";
import { DispatchQueueWidget } from "@/components/widgets/DispatchQueueWidget";
import { SystemHealthWidget } from "@/components/widgets/SystemHealthWidget";
import { useWhatsAppInstances } from "@/hooks/useWhatsAppInstances";
import { useConversations } from "@/hooks/useConversations";
import { useTeamOnlineCount } from "@/hooks/useTeamOnlineCount";
import { useAverageResponseTime } from "@/hooks/useAverageResponseTime";

interface OperationalDashboardTabProps {
  dateRange?: DateRange;
}

export function OperationalDashboardTab({ dateRange }: OperationalDashboardTabProps) {
  // Default date range if not provided
  const startDate = dateRange?.from || startOfMonth(new Date());
  const endDate = dateRange?.to || endOfMonth(new Date());

  const { data: whatsappInstances } = useWhatsAppInstances();
  const { data: conversations } = useConversations({ status: ['open'], channels: [], tags: [], search: '', slaExpired: false });
  const { data: teamOnlineCount } = useTeamOnlineCount();
  const { data: avgResponseTime } = useAverageResponseTime(startDate, endDate);

  const connectedInstances = whatsappInstances?.filter(i => i.status === 'connected').length || 0;
  const totalInstances = whatsappInstances?.length || 0;
  const activeConversations = conversations?.length || 0;

  const formatTime = (minutes: number | undefined) => {
    if (!minutes || minutes === 0) return "0m";
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${Math.round(minutes)}m`;
  };

  return (
    <BentoGrid cols={4}>
      {/* ROW 1: 4 KPI Cards */}
      <BentoCard>
        <KPICard 
          title="Instâncias WhatsApp" 
          value={`${connectedInstances}/${totalInstances}`}
          icon={MessageSquare}
          description="ativas"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Equipe Online" 
          value={(teamOnlineCount || 0).toString()}
          icon={Users}
          description="agentes disponíveis"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Conversas Ativas" 
          value={activeConversations.toString()}
          icon={MessageSquare}
          description="em atendimento"
        />
      </BentoCard>
      <BentoCard>
        <KPICard 
          title="Tempo Médio Resposta" 
          value={formatTime(avgResponseTime)}
          icon={Clock}
          description="min"
        />
      </BentoCard>
      
      {/* ROW 2: WhatsApp + Team Online */}
      <BentoCard span="2">
        <WhatsAppStatusWidget />
      </BentoCard>
      <BentoCard span="2">
        <TeamOnlineWidget />
      </BentoCard>
      
      {/* ROW 3: Team Efficiency + Busy Hours */}
      <BentoCard span="2">
        <TeamEfficiencyWidget startDate={startDate} endDate={endDate} />
      </BentoCard>
      <BentoCard span="2">
        <BusyHoursHeatmap startDate={startDate} endDate={endDate} />
      </BentoCard>
      
      {/* ROW 4: Channel Performance + AI Usage */}
      <BentoCard span="2">
        <ChannelPerformanceComparison startDate={startDate} endDate={endDate} />
      </BentoCard>
      <BentoCard span="2">
        <AIUsageWidget />
      </BentoCard>

      {/* ROW 5: System Health */}
      <BentoCard span="2">
        <SystemHealthWidget />
      </BentoCard>

      {/* ROW 5: Dispatch Queue Monitoring */}
      <BentoCard span="2">
        <DispatchQueueWidget />
      </BentoCard>
    </BentoGrid>
  );
}
