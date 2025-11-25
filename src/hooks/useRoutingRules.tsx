import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useRoutingRules = () => {
  return useQuery({
    queryKey: ["ai-routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_routing_rules")
        .select(`
          *,
          ai_personas (
            id,
            name,
            role
          )
        `)
        .order("priority", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};
