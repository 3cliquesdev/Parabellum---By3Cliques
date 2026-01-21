import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportAgent {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  availability_status: string | null;
}

export function useSupportAgents() {
  return useQuery({
    queryKey: ["support-agents"],
    queryFn: async (): Promise<SupportAgent[]> => {
      // Buscar user_ids com roles de suporte
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", [
          // Gestores
          "admin",
          "manager", 
          "general_manager",
          "financial_manager",
          // Suporte/Atendimento
          "support_agent", 
          "sales_rep", 
          "consultant", 
          "support_manager", 
          "cs_manager"
        ]);

      if (rolesError) throw rolesError;

      const userIds = [...new Set(userRoles?.map((r) => r.user_id) || [])];

      if (userIds.length === 0) return [];

      // Buscar profiles correspondentes
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, job_title, availability_status")
        .in("id", userIds)
        .order("full_name");

      if (error) throw error;

      return data || [];
    },
  });
}
