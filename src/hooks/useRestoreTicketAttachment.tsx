import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { hasFullAccess } from "@/config/roles";

interface RestoreAttachmentParams {
  ticketId: string;
  attachment: {
    file_name: string;
    file_type: string;
    file_url: string;
  };
  eventId: string;
}

export function useRestoreTicketAttachment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role } = useUserRole();

  return useMutation({
    mutationFn: async ({ ticketId, attachment, eventId }: RestoreAttachmentParams) => {
      // Verificar permissão no frontend
      if (!hasFullAccess(role)) {
        throw new Error("Apenas administradores e gerentes podem restaurar evidências");
      }

      // 1. Buscar attachments atuais do ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("attachments")
        .eq("id", ticketId)
        .single();

      if (ticketError) throw ticketError;

      // 2. Adicionar attachment restaurado ao array
      const currentAttachments = (ticket?.attachments as any[]) || [];
      const restoredAttachment = {
        url: attachment.file_url,
        type: attachment.file_type,
        name: attachment.file_name,
        uploaded_at: new Date().toISOString(),
        restored_at: new Date().toISOString(),
        restored_by: user?.id,
      };

      // 3. Atualizar ticket com novo array (trigger validará se é admin)
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ 
          attachments: [...currentAttachments, restoredAttachment],
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (updateError) {
        // Erro do trigger de validação
        if (updateError.message?.includes("administradores")) {
          throw new Error("Apenas administradores podem restaurar evidências removidas.");
        }
        throw updateError;
      }

      // 4. Registrar evento de restauração
      await supabase.functions.invoke("notify-ticket-event", {
        body: {
          ticket_id: ticketId,
          event_type: "attachment_restored",
          actor_id: user?.id,
          metadata: {
            file_name: attachment.file_name,
            file_type: attachment.file_type,
            file_url: attachment.file_url,
            original_removal_event_id: eventId,
          },
        },
      });

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ticket", variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ["ticket-events", variables.ticketId] });
      toast({
        title: "Evidência restaurada",
        description: "O arquivo foi restaurado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao restaurar",
        description: error.message || "Não foi possível restaurar a evidência.",
        variant: "destructive",
      });
    },
  });
}
