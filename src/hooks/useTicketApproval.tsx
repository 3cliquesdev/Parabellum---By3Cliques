import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ApprovalData {
  ticket_id: string;
  approved: boolean;
  rejection_reason?: string;
}

export function useTicketApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ticket_id, approved, rejection_reason }: ApprovalData) => {
      const updateData: any = {
        status: approved ? 'resolved' : 'in_progress',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };

      if (!approved && rejection_reason) {
        updateData.rejection_reason = rejection_reason;
        updateData.assigned_to = null; // Devolve para o suporte
      }

      if (approved) {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("tickets")
        .update(updateData)
        .eq("id", ticket_id)
        .select()
        .single();

      if (error) throw error;

      // Criar comentário de aprovação/rejeição
      const commentContent = approved 
        ? "✅ Reembolso APROVADO pelo time financeiro."
        : `❌ Reembolso REJEITADO: ${rejection_reason}`;

      await supabase
        .from("ticket_comments")
        .insert({
          ticket_id,
          content: commentContent,
          is_internal: false,
          created_by: user?.id,
        });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-comments", variables.ticket_id] });
      
      toast({
        title: variables.approved ? "✅ Reembolso Aprovado" : "❌ Reembolso Rejeitado",
        description: variables.approved 
          ? "O cliente será notificado sobre a aprovação."
          : "O ticket foi devolvido ao suporte com observações.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao processar aprovação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
