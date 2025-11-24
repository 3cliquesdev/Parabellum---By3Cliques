import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// TEMPORÁRIO: Retornando todos os usuários até termos sales_reps reais no sistema
// TODO: Reverter para filtrar apenas .eq("user_roles.role", "sales_rep") quando houver vendedores
export function useSalesReps() {
  return useQuery({
    queryKey: ["sales-reps"],
    queryFn: async () => {
      console.log("[useSalesReps] Fetching sales reps...");
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name, 
          job_title, 
          avatar_url,
          user_roles!inner(role)
        `)
        // .eq("user_roles.role", "sales_rep") // COMENTADO TEMPORARIAMENTE
        .order("full_name");

      if (error) {
        console.error("[useSalesReps] Error fetching sales reps:", error);
        throw error;
      }
      
      console.log("[useSalesReps] Data fetched:", data);
      return data;
    },
  });
}
