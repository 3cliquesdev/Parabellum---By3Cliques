import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConsultants() {
  return useQuery({
    queryKey: ["consultants"],
    queryFn: async () => {
      console.log("[useConsultants] Fetching consultants...");
      
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          job_title,
          avatar_url,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "consultant")
        .order("full_name");

      if (error) {
        console.error("[useConsultants] Error fetching consultants:", error);
        throw error;
      }
      
      console.log("[useConsultants] Data fetched:", data);
      return data;
    },
  });
}
