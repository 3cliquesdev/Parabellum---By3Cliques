import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PlaybookMetrics {
  totalExecutions: number;
  running: number;
  completed: number;
  failed: number;
  completionRate: number;
  emails: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
  byPlaybook: Array<{
    playbook_id: string;
    playbook_name: string;
    executions: number;
    completed: number;
    failed: number;
    emails_sent: number;
    emails_opened: number;
    open_rate: number;
  }>;
}

export function usePlaybookMetrics(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ["playbook-metrics", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<PlaybookMetrics> => {
      // Fetch KPIs via RPC with date filtering
      const rpcParams: { p_start?: string; p_end?: string } = {};
      if (dateRange?.from) rpcParams.p_start = dateRange.from.toISOString();
      if (dateRange?.to) rpcParams.p_end = dateRange.to.toISOString();

      const { data: kpis, error: kpiError } = await supabase.rpc("get_playbook_kpis", rpcParams);
      if (kpiError) throw kpiError;

      const k = kpis as any;
      const totalExecutions = Number(k.totalExecutions) || 0;
      const running = Number(k.running) || 0;
      const completed = Number(k.completed) || 0;
      const failed = Number(k.failed) || 0;
      const completionRate = totalExecutions > 0 ? (completed / totalExecutions) * 100 : 0;

      const sent = Number(k.emails?.sent) || 0;
      const delivered = Number(k.emails?.delivered) || 0;
      const opened = Number(k.emails?.opened) || 0;
      const clicked = Number(k.emails?.clicked) || 0;
      const bounced = Number(k.emails?.bounced) || 0;

      const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
      const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
      const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

      // Fetch performance por playbook via RPC with date filtering
      const { data: perfData, error: perfError } = await supabase.rpc("get_playbook_performance", rpcParams);
      if (perfError) throw perfError;

      const byPlaybook = (perfData as any[] || []).map((p: any) => ({
        playbook_id: p.playbook_id,
        playbook_name: p.playbook_name,
        executions: Number(p.executions) || 0,
        completed: Number(p.completed) || 0,
        failed: Number(p.failed) || 0,
        emails_sent: Number(p.emails_sent) || 0,
        emails_opened: Number(p.emails_opened) || 0,
        open_rate: Number(p.open_rate) || 0,
      }));

      return {
        totalExecutions,
        running,
        completed,
        failed,
        completionRate,
        emails: {
          sent,
          delivered,
          opened,
          clicked,
          bounced,
          deliveryRate,
          openRate,
          clickRate,
        },
        byPlaybook,
      };
    },
  });
}
