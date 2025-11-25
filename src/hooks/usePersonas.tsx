import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePersonas = () => {
  return useQuery({
    queryKey: ["ai-personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_personas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};
