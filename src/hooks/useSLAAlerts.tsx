import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface SLAAlert {
  id: string;
  conversation_id: string;
  alert_type: string;
  threshold_minutes: number;
  actual_minutes: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  conversations: {
    contact_id: string;
    department: string;
    contacts: {
      first_name: string;
      last_name: string;
    };
  };
}

export function useSLAAlerts() {
  const queryClient = useQueryClient();

  // Query for active alerts
  const query = useQuery({
    queryKey: ['sla-alerts', 'active'],
    queryFn: async (): Promise<SLAAlert[]> => {
      const { data, error } = await supabase
        .from('sla_alerts')
        .select(`
          *,
          conversations (
            contact_id,
            department,
            contacts (
              first_name,
              last_name
            )
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SLAAlert[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Realtime listener for new alerts
  useEffect(() => {
    const channel = supabase
      .channel('sla-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sla_alerts',
        },
        () => {
          console.log('[useSLAAlerts] Alert changed, invalidating queries');
          queryClient.invalidateQueries({ queryKey: ['sla-alerts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, conversationId }: { alertId: string; conversationId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update alert status
      const { error: alertError } = await supabase
        .from('sla_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (alertError) throw alertError;

      // Assign conversation to manager
      const { error: convError } = await supabase
        .from('conversations')
        .update({
          assigned_to: user.id
        })
        .eq('id', conversationId);

      if (convError) throw convError;

      return { alertId, conversationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });
}