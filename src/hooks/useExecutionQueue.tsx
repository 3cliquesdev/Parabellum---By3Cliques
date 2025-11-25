import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useExecutionQueue(executionId?: string) {
  return useQuery({
    queryKey: ["execution-queue", executionId],
    queryFn: async () => {
      let query = supabase
        .from("playbook_execution_queue")
        .select("*")
        .order("created_at", { ascending: true });

      if (executionId) {
        query = query.eq("execution_id", executionId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!executionId,
  });
}
