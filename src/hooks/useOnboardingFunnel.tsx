import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  drop_off?: number;
}

export function useOnboardingFunnel(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['onboarding-funnel', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<FunnelStage[]> => {
      // Stage 1: Purchase Approved (contacts with status=customer)
      const { count: purchaseCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'customer')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Stage 2: First Login (playbook_executions started)
      const { data: executions } = await supabase
        .from('playbook_executions')
        .select('contact_id')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());

      const uniqueLogins = new Set(executions?.map(e => e.contact_id)).size;

      // Stage 3: Email Delivered (email tracking events with delivered status)
      const { data: emailEvents } = await supabase
        .from('email_tracking_events')
        .select('customer_id')
        .eq('event_type', 'delivered')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const uniqueEmailReceivers = new Set(emailEvents?.map(e => e.customer_id)).size;

      // Stage 4: Completed Onboarding (playbook_executions with status=completed)
      const { data: completions } = await supabase
        .from('playbook_executions')
        .select('contact_id')
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString());

      const uniqueCompletions = new Set(completions?.map(c => c.contact_id)).size;

      const stages = [
        { stage: 'Compra Aprovada', count: purchaseCount || 0 },
        { stage: 'Primeiro Login', count: uniqueLogins },
        { stage: 'Email Entregue', count: uniqueEmailReceivers },
        { stage: 'Concluiu Onboarding', count: uniqueCompletions }
      ];

      // Calculate percentages and drop-offs
      const total = stages[0].count;
      const result: FunnelStage[] = stages.map((stage, index) => {
        const percentage = total > 0 ? (stage.count / total) * 100 : 0;
        const drop_off = index > 0 
          ? stages[index - 1].count - stage.count 
          : undefined;

        return {
          ...stage,
          percentage,
          drop_off
        };
      });

      return result;
    },
  });
}
