import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStartOfDayString, getEndOfDayString } from "@/lib/dateUtils";

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
        query = query.gte('created_at', getStartOfDayString(dateRange.from));
      }

      if (dateRange?.to) {
        query = query.lte('created_at', getEndOfDayString(dateRange.to));
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
      // Usar email_sends como fonte de verdade
      let baseQuery = supabase.from("email_sends").select("id", { count: "exact", head: true });
      if (dateRange?.from) baseQuery = baseQuery.gte('sent_at', getStartOfDayString(dateRange.from));
      if (dateRange?.to) baseQuery = baseQuery.lte('sent_at', getEndOfDayString(dateRange.to));

      const { count: sent } = await baseQuery;

      let deliveredQuery = supabase.from("email_sends").select("id", { count: "exact", head: true }).is('bounced_at', null);
      if (dateRange?.from) deliveredQuery = deliveredQuery.gte('sent_at', getStartOfDayString(dateRange.from));
      if (dateRange?.to) deliveredQuery = deliveredQuery.lte('sent_at', getEndOfDayString(dateRange.to));

      const { count: delivered } = await deliveredQuery;

      let openedQuery = supabase.from("email_sends").select("id", { count: "exact", head: true }).not('opened_at', 'is', null);
      if (dateRange?.from) openedQuery = openedQuery.gte('sent_at', getStartOfDayString(dateRange.from));
      if (dateRange?.to) openedQuery = openedQuery.lte('sent_at', getEndOfDayString(dateRange.to));

      const { count: opened } = await openedQuery;

      let clickedQuery = supabase.from("email_sends").select("id", { count: "exact", head: true }).not('clicked_at', 'is', null);
      if (dateRange?.from) clickedQuery = clickedQuery.gte('sent_at', getStartOfDayString(dateRange.from));
      if (dateRange?.to) clickedQuery = clickedQuery.lte('sent_at', getEndOfDayString(dateRange.to));

      const { count: clicked } = await clickedQuery;

      return [
        { stage: 'Enviados', value: sent || 0, fill: 'hsl(var(--chart-1))' },
        { stage: 'Entregues', value: delivered || 0, fill: 'hsl(var(--chart-2))' },
        { stage: 'Abertos', value: opened || 0, fill: 'hsl(var(--chart-3))' },
        { stage: 'Clicados', value: clicked || 0, fill: 'hsl(var(--chart-4))' },
      ];
    },
  });
}

export function useEmailEvolutionData(days: number = 7, dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ["email-evolution-data", days, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const rpcParams: { p_days: number; p_start?: string; p_end?: string } = { p_days: days };
      if (dateRange?.from) rpcParams.p_start = getStartOfDayString(dateRange.from);
      if (dateRange?.to) rpcParams.p_end = getEndOfDayString(dateRange.to);

      const { data, error } = await supabase.rpc("get_email_evolution", rpcParams);

      if (error) throw error;

      return (data as any[] || []).map((row: any) => ({
        date: row.day,
        sent: Number(row.sent) || 0,
        delivered: Number(row.delivered) || 0,
        opened: Number(row.opened) || 0,
        clicked: Number(row.clicked) || 0,
      }));
    },
  });
}
