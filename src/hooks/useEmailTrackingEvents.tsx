import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailTrackingEvent {
  id: string;
  email_id: string;
  customer_id: string | null;
  playbook_execution_id: string | null;
  event_type: string;
  metadata: Record<string, any>;
  created_at: string;
  contact?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface UseEmailTrackingEventsParams {
  eventType?: string;
  playbookExecutionId?: string;
  customerId?: string;
  dateRange?: { from: Date; to: Date };
  limit?: number;
}

export function useEmailTrackingEvents(params?: UseEmailTrackingEventsParams) {
  const { eventType, playbookExecutionId, customerId, dateRange, limit = 100 } = params || {};

  return useQuery({
    queryKey: ["email-tracking-events", eventType, playbookExecutionId, customerId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<EmailTrackingEvent[]> => {
      let query = supabase
        .from("email_tracking_events")
        .select(`
          *,
          contact:contacts!email_tracking_events_customer_id_fkey(first_name, last_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      if (playbookExecutionId) {
        query = query.eq('playbook_execution_id', playbookExecutionId);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailTrackingEvent[];
    },
  });
}

export function useEmailFunnelData(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ["email-funnel-data", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("email_tracking_events")
        .select("event_type");

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        query = query.lte('created_at', dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const counts: Record<string, number> = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
      };

      data?.forEach(event => {
        if (counts[event.event_type] !== undefined) {
          counts[event.event_type]++;
        }
      });

      return [
        { stage: 'Enviados', value: counts.sent, fill: 'hsl(var(--chart-1))' },
        { stage: 'Entregues', value: counts.delivered, fill: 'hsl(var(--chart-2))' },
        { stage: 'Abertos', value: counts.opened, fill: 'hsl(var(--chart-3))' },
        { stage: 'Clicados', value: counts.clicked, fill: 'hsl(var(--chart-4))' },
      ];
    },
  });
}

export function useEmailEvolutionData(days: number = 7) {
  return useQuery({
    queryKey: ["email-evolution-data", days],
    queryFn: async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const { data, error } = await supabase
        .from("email_tracking_events")
        .select("event_type, created_at")
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const dayMap = new Map<string, Record<string, number>>();

      data?.forEach(event => {
        const day = new Date(event.created_at).toISOString().split('T')[0];
        
        if (!dayMap.has(day)) {
          dayMap.set(day, { sent: 0, delivered: 0, opened: 0, clicked: 0 });
        }

        const dayData = dayMap.get(day)!;
        if (dayData[event.event_type] !== undefined) {
          dayData[event.event_type]++;
        }
      });

      return Array.from(dayMap.entries()).map(([date, counts]) => ({
        date,
        ...counts,
      }));
    },
  });
}
