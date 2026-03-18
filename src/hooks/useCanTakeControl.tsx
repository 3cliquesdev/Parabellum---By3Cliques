import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FULL_ACCESS_ROLES, hasFullAccess } from "@/config/roles";
import { isDepartmentAllowedByName } from "@/utils/departmentMatch";

// Mapeamento de roles para departamentos permitidos (por nome)
const ROLE_DEPARTMENT_MAP: Record<string, string[]> = {
  sales_rep: ["Comercial", "Vendas", "Sales"],
  support_agent: ["Suporte", "Support", "Atendimento"],
  financial_agent: ["Financeiro", "Finance", "Financial"],
  consultant: [], // Consultant pode assumir qualquer conversa atribuída a ele
};

interface CanTakeControlResult {
  canTake: boolean;
  reason?: string;
  isLoading: boolean;
}

type ConversationTakeControlContext = {
  departmentId: string | null;
  assignedTo: string | null;
  aiMode: string | null;
  status: string | null;
};

/**
 * Hook para verificar se o usuário pode assumir uma conversa específica
 * Usado para desabilitar/ocultar o botão "Assumir" quando não permitido
 * 
 * Regras:
 * - admin, manager, general_manager, support_manager, cs_manager: podem assumir qualquer conversa
 * - sales_rep: só pode assumir conversas do departamento Comercial/Vendas
 * - support_agent: só pode assumir conversas do departamento Suporte
 * - financial_agent: só pode assumir conversas do departamento Financeiro
 */
export function useCanTakeControl(conversation: ConversationTakeControlContext): CanTakeControlResult {
  const { user } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['can-take-control', user?.id, conversation.departmentId, conversation.assignedTo, conversation.aiMode, conversation.status],
    queryFn: async (): Promise<{ canTake: boolean; reason?: string }> => {
      if (!user?.id) return { canTake: false, reason: 'Não autenticado' };

      // ✅ Regra solicitada: qualquer usuário pode assumir conversas "disponíveis" vindas da IA
      // (não atribuídas) — isso destrava vendedores e suporte.
      // FIXED: Verificar aiMode (não status) para waiting_human, pois status é 'open' no banco
      const isAvailableAIConversation =
        !conversation.assignedTo &&
        (conversation.aiMode === 'autopilot' || conversation.aiMode === 'waiting_human');
      if (isAvailableAIConversation) {
        return { canTake: true };
      }

      // ✅ Bug 37: Se a conversa já está atribuída ao próprio usuário, sempre pode assumir
      if (conversation.assignedTo === user.id) {
        return { canTake: true };
      }
      
      // Buscar role do usuário
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (roleError) {
        console.error('[useCanTakeControl] Erro ao buscar role:', roleError);
      }
      
      const userRole = roleData?.role || null;
      
      // 🔒 Usar lista centralizada de roles com acesso total
      const isManagerOrAdmin = hasFullAccess(userRole);
      
      console.log('[useCanTakeControl] Verificação de permissão:', { 
        userId: user.id, 
        userRole, 
        isManagerOrAdmin,
        conversationDeptId: conversation.departmentId,
        assignedTo: conversation.assignedTo,
        aiMode: conversation.aiMode
      });
      
      // Roles com acesso total sempre podem assumir
      if (!userRole || isManagerOrAdmin) {
        console.log('[useCanTakeControl] ✅ Acesso total concedido:', { userRole, isManagerOrAdmin });
        return { canTake: true };
      }
      
      // Se conversa não tem departamento, permitir
      if (!conversation.departmentId) {
        return { canTake: true };
      }
      
      // Buscar nome do departamento da conversa
      const { data: dept } = await supabase
        .from('departments')
        .select('name')
        .eq('id', conversation.departmentId)
        .maybeSingle();
      
      const conversationDeptName = dept?.name || null;
      
      if (!conversationDeptName) {
        return { canTake: true };
      }
      
      const allowedDepartments = ROLE_DEPARTMENT_MAP[userRole];
      
      if (!allowedDepartments || allowedDepartments.length === 0) {
        // Role não tem restrições de departamento específicas
        return { canTake: true };
      }
      
      const isAllowed = isDepartmentAllowedByName(allowedDepartments, conversationDeptName);
      
      if (!isAllowed) {
        return { 
          canTake: false, 
          reason: `Você só pode assumir conversas do departamento ${allowedDepartments.join(' ou ')}`
        };
      }
      
      return { canTake: true };
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // Cache por 1 minuto
  });
  
  return {
    canTake: data?.canTake ?? true,
    reason: data?.reason,
    isLoading,
  };
}
