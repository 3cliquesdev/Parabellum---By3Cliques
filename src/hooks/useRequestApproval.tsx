import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function useRequestApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ticketId: string) => {
      // 1. Atualizar status para pending_approval
      const { data, error } = await supabase
        .from("tickets")
        .update({ status: "pending_approval" } as any)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;

      // 2. Criar comentário interno
      await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        content: "📋 Solicitação de aprovação gerencial enviada. Aguardando análise.",
        is_internal: true,
        created_by: user?.id,
      });

      // 3. Criar evento canônico para deduplicação
      const { data: createdEvent } = await supabase
        .from("ticket_events")
        .insert({
          ticket_id: ticketId,
          event_type: "approval_requested" as any,
          actor_id: user?.id || null,
          old_value: data.status,
          new_value: "pending_approval",
          metadata: { subject: data.subject, priority: data.priority },
        })
        .select("id")
        .single();

      // 4. Notificar gestores via edge function (com deduplicação e email)
      try {
        await supabase.functions.invoke("notify-ticket-event", {
          body: {
            ticket_id: ticketId,
            event_type: "approval_requested",
            actor_id: user?.id,
            old_value: data.status,
            new_value: "pending_approval",
            ticket_event_id: createdEvent?.id,
            channels: ["email", "in_app"],
          },
        });
      } catch (notifyError) {
        console.error("[useRequestApproval] Failed to notify managers:", notifyError);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-counts"] });
      toast({
        title: "📋 Aprovação Solicitada",
        description: "O ticket foi enviado para aprovação gerencial. Você será notificado quando houver uma decisão.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao solicitar aprovação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
