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
      // Fetch executions
      let executionsQuery = supabase
        .from("playbook_executions")
        .select(`
          *,
          playbook:onboarding_playbooks(id, name)
        `);

      if (dateRange?.from) {
        executionsQuery = executionsQuery.gte('started_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        executionsQuery = executionsQuery.lte('started_at', dateRange.to.toISOString());
      }

      const { data: executions, error: execError } = await executionsQuery;

      if (execError) throw execError;

      // Fetch email tracking events
      let trackingQuery = supabase
        .from("email_tracking_events")
        .select("*");

      if (dateRange?.from) {
        trackingQuery = trackingQuery.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        trackingQuery = trackingQuery.lte('created_at', dateRange.to.toISOString());
      }

      const { data: trackingEvents, error: trackError } = await trackingQuery;

      if (trackError) throw trackError;

      // Calculate execution metrics
      const totalExecutions = executions?.length || 0;
      const running = executions?.filter(e => e.status === 'running').length || 0;
      const completed = executions?.filter(e => e.status?.includes('completed')).length || 0;
      const failed = executions?.filter(e => e.status === 'failed').length || 0;
      const completionRate = totalExecutions > 0 ? (completed / totalExecutions) * 100 : 0;

      // Calculate email metrics
      const sent = trackingEvents?.filter(e => e.event_type === 'sent').length || 0;
      const delivered = trackingEvents?.filter(e => e.event_type === 'delivered').length || 0;
      const opened = trackingEvents?.filter(e => e.event_type === 'opened').length || 0;
      const clicked = trackingEvents?.filter(e => e.event_type === 'clicked').length || 0;
      const bounced = trackingEvents?.filter(e => e.event_type === 'bounced').length || 0;

      const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
      const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
      const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;

      // Calculate by playbook
      const playbookMap = new Map<string, any>();
      
      executions?.forEach(exec => {
        const playbookId = exec.playbook?.id;
        const playbookName = exec.playbook?.name || 'Desconhecido';
        
        if (!playbookId) return;

        if (!playbookMap.has(playbookId)) {
          playbookMap.set(playbookId, {
            playbook_id: playbookId,
            playbook_name: playbookName,
            executions: 0,
            completed: 0,
            failed: 0,
            emails_sent: 0,
            emails_opened: 0,
          });
        }

        const entry = playbookMap.get(playbookId);
        entry.executions++;
        if (exec.status?.includes('completed')) entry.completed++;
        if (exec.status === 'failed') entry.failed++;
      });

      // Add email stats per playbook
      trackingEvents?.forEach(event => {
        if (event.playbook_execution_id) {
          const exec = executions?.find(e => e.id === event.playbook_execution_id);
          if (exec?.playbook?.id) {
            const entry = playbookMap.get(exec.playbook.id);
            if (entry) {
              if (event.event_type === 'sent') entry.emails_sent++;
              if (event.event_type === 'opened') entry.emails_opened++;
            }
          }
        }
      });

      const byPlaybook = Array.from(playbookMap.values()).map(p => ({
        ...p,
        open_rate: p.emails_sent > 0 ? (p.emails_opened / p.emails_sent) * 100 : 0,
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
