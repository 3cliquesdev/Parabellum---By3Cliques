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

interface UseUsersByDepartmentOptions {
  onlineOnly?: boolean;
}

export function useUsersByDepartment(departmentId?: string, options: UseUsersByDepartmentOptions = {}) {
  const { onlineOnly = false } = options;
  
  return useQuery({
    queryKey: ["users-by-department", departmentId, onlineOnly],
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
      let query = supabase
        .from("profiles")
        .select("id, full_name, job_title, avatar_url, department, availability_status")
        .eq("department", departmentId)
        .in("id", internalUserIds);
      
      // 3. Filtrar apenas online se solicitado
      if (onlineOnly) {
        query = query.eq("availability_status", "online");
      }
      
      const { data, error } = await query.order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });
}
