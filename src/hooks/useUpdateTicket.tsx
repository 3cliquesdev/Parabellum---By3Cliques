import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface UpdateTicketData {
  status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string | null;
  subject?: string;
  description?: string;
  department_id?: string;
  attachments?: any[];
}

export function useUpdateTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates, statusNote }: { id: string; updates: UpdateTicketData; statusNote?: string }) => {
      // Buscar status anterior para comparação
      const { data: currentTicket } = await supabase
        .from("tickets")
        .select("status")
        .eq("id", id)
        .single();
      
      const previousStatus = currentTicket?.status;
      const updateData: any = { ...updates };
      
      // Se status mudou para resolved ou closed, adicionar resolved_at
      if (updates.status === 'resolved' || updates.status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("tickets")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Notificar stakeholders internamente via edge function
      if (updates.status && previousStatus !== updates.status) {
        const eventType = updates.status === 'resolved' ? 'resolved' :
                          updates.status === 'closed' ? 'closed' : 'status_changed';
        
        try {
          await supabase.functions.invoke('notify-ticket-event', {
            body: {
              ticket_id: id,
              event_type: eventType,
              actor_id: user?.id,
              old_value: previousStatus,
              new_value: updates.status,
            },
          });
          console.log(`[useUpdateTicket] Internal notification sent for ${eventType}`);
        } catch (notifyError) {
          console.error('[useUpdateTicket] Failed to notify stakeholders:', notifyError);
        }
      }

      // Enviar notificação de status para o cliente externo
      const notifiableStatuses = ['waiting_customer', 'resolved', 'closed'];
      if (updates.status && notifiableStatuses.includes(updates.status)) {
        try {
          await supabase.functions.invoke('send-ticket-status-notification', {
            body: {
              ticket_id: id,
              new_status: updates.status,
              note: statusNote,
            },
          });
          console.log(`[useUpdateTicket] Customer notification sent for ${updates.status}`);
        } catch (notifError) {
          console.error('[useUpdateTicket] Failed to send customer notification:', notifError);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", data.id] });
      queryClient.invalidateQueries({ queryKey: ["ticket-counts"] });
      toast({
        title: "Ticket atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
