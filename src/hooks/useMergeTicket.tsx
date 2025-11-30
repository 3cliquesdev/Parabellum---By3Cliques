import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface MergeTicketParams {
  sourceTicketId: string;
  destinationTicketId: string;
  transferComments?: boolean;
}

export function useMergeTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ sourceTicketId, destinationTicketId, transferComments = false }: MergeTicketParams) => {
      // 1. Fechar ticket de origem e marcar como mesclado
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "closed",
          merged_to_ticket_id: destinationTicketId,
        })
        .eq("id", sourceTicketId);

      if (updateError) throw updateError;

      // 2. Buscar dados do ticket de origem para o comentário
      const { data: sourceTicket } = await supabase
        .from("tickets")
        .select("subject")
        .eq("id", sourceTicketId)
        .single();

      // 3. Adicionar comentário interno no ticket destino
      const { error: commentError } = await supabase
        .from("ticket_comments")
        .insert({
          ticket_id: destinationTicketId,
          content: `🔗 <strong>Ticket Mesclado</strong><br/>O Ticket #${sourceTicketId.slice(0, 8)} ("${sourceTicket?.subject || 'Sem assunto'}") foi mesclado neste ticket.`,
          is_internal: true,
        });

      if (commentError) throw commentError;

      // 4. (Opcional) Transferir comentários
      if (transferComments) {
        const { data: comments } = await supabase
          .from("ticket_comments")
          .select("*")
          .eq("ticket_id", sourceTicketId)
          .order("created_at", { ascending: true });

        if (comments && comments.length > 0) {
          const transferredComments = comments.map(comment => ({
            ticket_id: destinationTicketId,
            content: `<em>[Do ticket mesclado]</em><br/>${comment.content}`,
            is_internal: true,
            created_by: comment.created_by,
          }));

          await supabase
            .from("ticket_comments")
            .insert(transferredComments);
        }
      }

      return { destinationTicketId };
    },
    onSuccess: ({ destinationTicketId }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
      
      toast({
        title: "✅ Tickets mesclados com sucesso",
        description: "Redirecionando para o ticket principal...",
      });

      // Redirecionar para o ticket destino
      setTimeout(() => {
        navigate(`/support?ticket=${destinationTicketId}`);
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao mesclar tickets",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}