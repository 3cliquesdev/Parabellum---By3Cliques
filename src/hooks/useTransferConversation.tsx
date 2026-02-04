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

  // Roles elegíveis para receber distribuição automática.
  // IMPORTANT: consultores e financeiros NÃO devem receber por auto-distribuição.
  const AUTO_DISTRIBUTE_ROLES = [
    "support_agent",
    "sales_rep",
    "cs_manager",
    "support_manager",
    "manager",
    "general_manager",
    "admin",
  ] as const;

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
        // 1) Buscar IDs de usuários elegíveis por role
        const { data: eligibleRoles, error: eligibleRolesError } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", [...AUTO_DISTRIBUTE_ROLES]);

        if (eligibleRolesError) {
          console.error("[useTransferConversation] roles query error:", eligibleRolesError);
          throw eligibleRolesError;
        }

        const eligibleUserIds = (eligibleRoles || [])
          .map((r) => r.user_id)
          .filter(Boolean);

        if (eligibleUserIds.length === 0) {
          // Sem agentes elegíveis configurados - vai para pool
          finalToUserId = null;
          finalToUserName = "Pool do Departamento";
          console.log("[useTransferConversation] Nenhum agente elegível (roles), indo para pool do departamento");
        } else {

          // 2) Buscar 1 agente online no mesmo departamento (excluindo o remetente)
          const { data: onlineAgent, error: onlineAgentError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("department", departmentId)
            .in("id", eligibleUserIds)
            .eq("availability_status", "online")
            .neq("id", fromUserId)
            .limit(1)
            .maybeSingle();

          if (onlineAgentError) {
            console.error("[useTransferConversation] online agent query error:", onlineAgentError);
            throw onlineAgentError;
          }

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
      }

      // Log antes da chamada RPC
      console.log('[useTransferConversation] RPC call:', {
        conversationId,
        fromUserId,
        toUserId: finalToUserId,
        departmentId,
        autoDistribute
      });

      // Usar função SECURITY DEFINER para transferir (bypassa RLS com validação)
      const { data: result, error: rpcError } = await supabase
        .rpc('transfer_conversation_secure', {
          p_conversation_id: conversationId,
          p_to_user_id: finalToUserId,
          p_to_department_id: departmentId,
          p_transfer_note: transferNote || null,
        });

      if (rpcError) {
        console.error("[useTransferConversation] RPC error details:", {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          conversationId,
          toUserId: finalToUserId,
          departmentId
        });
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
