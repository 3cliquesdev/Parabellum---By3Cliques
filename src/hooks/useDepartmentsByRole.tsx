import { useMemo } from "react";
import { FULL_ACCESS_ROLES, hasFullAccess } from "@/config/roles";

// Re-exportar para compatibilidade com código existente
export { FULL_ACCESS_ROLES };

/**
 * Hook para retornar IDs de departamentos permitidos baseado no role do usuário
 * 
 * MUDANÇA V2: Usa departamento do PERFIL do usuário como fonte única da verdade
 * ao invés de filtrar por nomes hardcoded.
 * 
 * @param role - Role do usuário
 * @param userDepartmentId - Departamento do perfil do usuário (da tabela profiles)
 */
export function useDepartmentsByRole(role: string | null, userDepartmentId?: string | null) {
  const departmentIds = useMemo(() => {
    if (!role) return null;

    // Roles com acesso total (sem restrição de departamento)
    if (hasFullAccess(role)) {
      return null;
    }

    // Roles operacionais: usar departamento do próprio perfil
    // Se não tiver departamento configurado, retorna array vazio (só vê conversas atribuídas a ele)
    switch (role) {
      case "sales_rep":
      case "support_agent":
      case "financial_agent":
      case "consultant":
      case "cs_manager":
        // Retorna departamento do perfil do usuário
        return userDepartmentId ? [userDepartmentId] : [];

      default:
        // Role genérico 'user' ou desconhecido: sem acesso a departamentos
        return [];
    }
  }, [role, userDepartmentId]);

  return {
    departmentIds,
    isLoading: false, // Não precisa mais carregar departamentos do banco
    // Helper para verificar se um departamento está na lista permitida
    isDepartmentAllowed: (deptId: string | null) => {
      if (departmentIds === null) return true; // Acesso total
      if (!deptId) return true; // Conversas sem departamento são visíveis
      return departmentIds.includes(deptId);
    },
  };
}

// Helper para verificar se um role tem acesso total
// Usa a função centralizada de @/config/roles
export const hasFullInboxAccess = hasFullAccess;
