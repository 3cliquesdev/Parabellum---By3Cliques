import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TransferConversationParams {
  conversationId: string;
  fromUserId: string;
  toUserId: string | null; // null = distribuição automática
  fromUserName: string;
  toUserName: string;
  contactId: string;
  departmentId: string;
  departmentName: string;
  transferNote: string;
  autoDistribute?: boolean;
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
      autoDistribute,
    }: TransferConversationParams) => {
      let finalToUserId = toUserId;
      let finalToUserName = toUserName;

      // Se autoDistribute, buscar um agente online do departamento
      if (autoDistribute) {
        const { data: onlineAgent } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("department", departmentId)
          .eq("availability_status", "online")
          .limit(1)
          .maybeSingle();

        if (onlineAgent) {
          finalToUserId = onlineAgent.id;
          finalToUserName = onlineAgent.full_name;
          console.log("[useTransferConversation] Auto-distribuído para:", onlineAgent.full_name);
        } else {
          // Nenhum agente online - vai para pool do departamento (assigned_to = null)
          finalToUserId = null;
          finalToUserName = "Pool do Departamento";
          console.log("[useTransferConversation] Nenhum agente online, indo para pool do departamento");
        }
      }

      // Atualizar assigned_to E department na conversa
      const { error: updateError } = await supabase
        .from("conversations")
        .update({ 
          assigned_to: finalToUserId,
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
          content: `🔄 Conversa transferida de ${fromUserName} para ${finalToUserName} (${departmentName})${autoDistribute ? " [Distribuição Automática]" : ""}`,
          channel: "other",
          metadata: {
            from_user_id: fromUserId,
            to_user_id: finalToUserId,
            from_user_name: fromUserName,
            to_user_name: finalToUserName,
            to_department_id: departmentId,
            to_department_name: departmentName,
            conversation_id: conversationId,
            transfer_note: transferNote,
            is_internal: true,
            auto_distributed: autoDistribute,
          },
        });

      if (interactionError) throw interactionError;

      return { conversationId, toUserId: finalToUserId, departmentId };
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
