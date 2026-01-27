import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSandboxTrainingCount() {
  return useQuery({
    queryKey: ["sandbox-training-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("knowledge_articles")
        .select("id", { count: "exact", head: true })
        .eq("source", "sandbox_training");

      if (error) {
        console.error("Error fetching sandbox training count:", error);
        return 0;
      }

      return count || 0;
    },
  });
}
