import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Consultant {
  id: string;
  full_name: string | null;
  job_title: string | null;
  avatar_url: string | null;
  is_blocked: boolean | null;
}

export function useConsultants(includeBlocked: boolean = false) {
  return useQuery({
    queryKey: ["consultants", includeBlocked],
    queryFn: async () => {
      console.log("[useConsultants] Fetching consultants...");
      
      // Primeiro buscar user_roles para pegar IDs de consultores
      const { data: consultantRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "consultant");

      if (rolesError) {
        console.error("[useConsultants] Error fetching consultant roles:", rolesError);
        throw rolesError;
      }

      const consultantIds = consultantRoles?.map(r => r.user_id) || [];

      if (consultantIds.length === 0) {
        return [];
      }

      // Buscar profiles dos consultores
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          job_title,
          avatar_url,
          is_blocked
        `)
        .in("id", consultantIds)
        .order("full_name");

      if (error) {
        console.error("[useConsultants] Error fetching consultants:", error);
        throw error;
      }
      
      // Filtrar consultores bloqueados se não incluir
      const filtered = includeBlocked 
        ? data 
        : data?.filter(c => !c.is_blocked);
      
      console.log("[useConsultants] Data fetched:", filtered);
      return filtered as Consultant[];
    },
  });
}

// Hook para obter apenas consultores ativos (não bloqueados) para seleção em dropdowns
export function useActiveConsultants() {
  return useConsultants(false);
}
