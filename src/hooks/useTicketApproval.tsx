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
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };

      if (approved) {
        // Status intermediário: aprovado para pagamento, mas não resolvido
        updateData.status = 'approved';
        // NÃO define resolved_at - será definido quando concluir o reembolso
      } else {
        // Rejeitado: volta para in_progress para correção
        updateData.status = 'in_progress';
        updateData.rejection_reason = rejection_reason;
        updateData.assigned_to = null; // Devolve para a fila geral
      }

      const { data, error } = await supabase
        .from("tickets")
        .update(updateData)
        .eq("id", ticket_id)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Se UPDATE funcionou mas SELECT retornou vazio (RLS), retornar objeto mínimo
      if (!data) {
        console.warn('[useTicketApproval] Update succeeded but SELECT returned empty (RLS restriction)');
        return { id: ticket_id, ...updateData } as any;
      }

      // Criar comentário de aprovação/rejeição
      const commentContent = approved 
        ? "✅ Reembolso APROVADO pelo financeiro. Aguardando execução do pagamento."
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
          ? "Execute o pagamento e marque como concluído."
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
