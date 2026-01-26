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

      // Usar função SECURITY DEFINER para transferir (bypassa RLS com validação)
      const { data: result, error: rpcError } = await supabase
        .rpc('transfer_conversation_secure', {
          p_conversation_id: conversationId,
          p_to_user_id: finalToUserId,
          p_to_department_id: departmentId,
          p_transfer_note: transferNote || null,
        });

      if (rpcError) {
        console.error("[useTransferConversation] RPC error:", rpcError);
        throw rpcError;
      }

      // Cast result to expected type
      const transferResult = result as { success: boolean; error?: string } | null;

      if (!transferResult?.success) {
        console.error("[useTransferConversation] Transfer failed:", transferResult?.error);
        throw new Error(transferResult?.error || 'Erro ao transferir conversa');
      }

      console.log("[useTransferConversation] Transferência realizada com sucesso:", transferResult);

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
