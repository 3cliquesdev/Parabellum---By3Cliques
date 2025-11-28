import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SLAComplianceData {
  on_time: number;
  overdue: number;
  total: number;
  compliance_rate: number;
}

export function useSLACompliance(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['sla-compliance', startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<SLAComplianceData> => {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, created_at, resolved_at, due_date')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const total = tickets?.length || 0;
      let on_time = 0;
      let overdue = 0;

      tickets?.forEach(ticket => {
        if (!ticket.resolved_at || !ticket.due_date) {
          // Consider unresolved tickets as potentially overdue if past due date
          if (ticket.due_date && new Date(ticket.due_date) < new Date()) {
            overdue++;
          }
          return;
        }

        const resolvedDate = new Date(ticket.resolved_at);
        const dueDate = new Date(ticket.due_date);

        if (resolvedDate <= dueDate) {
          on_time++;
        } else {
          overdue++;
        }
      });

      const compliance_rate = total > 0 ? (on_time / total) * 100 : 0;

      return {
        on_time,
        overdue,
        total,
        compliance_rate
      };
    },
  });
}
