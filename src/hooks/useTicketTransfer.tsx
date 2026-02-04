import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TransferData {
  ticket_id: string;
  department_id: string;
  internal_note: string;
  assigned_to?: string | null;
}

/**
 * Hook para transferir tickets entre departamentos/agentes
 * Usa RPC SECURITY DEFINER para bypassar RLS com validação
 */
export function useTicketTransfer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ticket_id, department_id, internal_note, assigned_to }: TransferData) => {
      console.log('[useTicketTransfer] RPC call:', {
        ticket_id,
        department_id,
        assigned_to,
        internal_note: internal_note?.substring(0, 50)
      });

      // Chamar RPC SECURITY DEFINER - bypassa RLS com validação
      const { data: result, error } = await supabase
        .rpc('transfer_ticket_secure', {
          p_ticket_id: ticket_id,
          p_department_id: department_id,
          p_assigned_to: assigned_to ?? null,
          p_internal_note: internal_note || null
        });

      if (error) {
        console.error('[useTicketTransfer] RPC error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          ticket_id,
          department_id,
          assigned_to
        });
        throw error;
      }

      // Cast result para tipo esperado
      const transferResult = result as { 
        success: boolean; 
        error?: string; 
        ticket_id?: string; 
        department_id?: string; 
        department_name?: string;
        assigned_to?: string;
        assignee_name?: string;
      } | null;

      if (!transferResult?.success) {
        console.error('[useTicketTransfer] Transfer failed:', transferResult?.error);
        throw new Error(transferResult?.error || 'Erro ao transferir ticket');
      }

      console.log('[useTicketTransfer] ✅ Ticket transferido com sucesso:', transferResult);

      // Notificar stakeholders via edge function
      try {
        await supabase.functions.invoke('notify-ticket-event', {
          body: {
            ticket_id,
            event_type: 'transferred',
            actor_id: user?.id,
            old_value: null,
            new_value: department_id,
            metadata: {
              to_department: transferResult.department_name,
              assigned_to: transferResult.assigned_to,
              assignee_name: transferResult.assignee_name,
              internal_note,
            },
          },
        });
        console.log('[useTicketTransfer] Stakeholders notified');
      } catch (notifyError) {
        console.error('[useTicketTransfer] Failed to notify stakeholders:', notifyError);
      }

      return {
        id: ticket_id,
        department: { name: transferResult.department_name }
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", data.id] });
      
      toast({
        title: "✅ Ticket Transferido",
        description: `Enviado para ${data.department?.name || 'novo departamento'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao transferir ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
