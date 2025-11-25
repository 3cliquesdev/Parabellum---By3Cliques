import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TransferConversationParams {
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  toUserName: string;
  contactId: string;
  departmentId: string;
  departmentName: string;
  transferNote: string;
}

export function useTransferConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      conversationId,
      fromUserId,
      toUserId,
      fromUserName,
      toUserName,
      contactId,
      departmentId,
      departmentName,
      transferNote,
    }: TransferConversationParams) => {
      // Atualizar assigned_to E department na conversa
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ 
          assigned_to: toUserId,
          department: departmentId,
        })
        .eq("id", conversationId);

      if (updateError) throw updateError;

      // Registrar interação de transferência com nota interna
      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          customer_id: contactId,
          type: "conversation_transferred",
          content: `🔄 Conversa transferida de ${fromUserName} para ${toUserName} (${departmentName})`,
          channel: "other",
          metadata: {
            from_user_id: fromUserId,
            to_user_id: toUserId,
            from_user_name: fromUserName,
            to_user_name: toUserName,
            to_department_id: departmentId,
            to_department_name: departmentName,
            conversation_id: conversationId,
            transfer_note: transferNote,
            is_internal: true, // Marcar como nota interna
          },
        });

      if (interactionError) throw interactionError;

      return { conversationId, toUserId, departmentId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ 
        queryKey: ["customer-timeline", variables.contactId] 
      });
      toast({
        title: "Conversa transferida",
        description: `Conversa transferida para ${variables.toUserName} com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao transferir conversa",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
