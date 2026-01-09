import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Roles que podem receber conversas/transferências (funcionários internos)
const INTERNAL_ROLES = [
  'admin',
  'general_manager', 
  'manager',
  'sales_rep',
  'consultant',
  'support_agent',
  'support_manager',
  'financial_manager',
  'financial_agent',
  'cs_manager',
  'ecommerce_analyst'
] as const;

export function useUsersByDepartment(departmentId?: string) {
  return useQuery({
    queryKey: ["users-by-department", departmentId],
    queryFn: async () => {
      if (!departmentId) return [];
      
      // 1. Buscar user_ids com roles internos (não-clientes)
      const { data: internalUserRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", INTERNAL_ROLES);

      if (rolesError) throw rolesError;
      
      const internalUserIds = internalUserRoles?.map(r => r.user_id) || [];
      
      if (internalUserIds.length === 0) return [];
      
      // 2. Buscar profiles que são internos E pertencem ao departamento
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, avatar_url, department")
        .eq("department", departmentId)
        .in("id", internalUserIds)
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });
}
