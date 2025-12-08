import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function usePlaybooks() {
  return useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_playbooks")
        .select(`
          *,
          product:products(id, name),
          creator:profiles(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Re-export from dedicated file for backwards compatibility
export { useBulkTriggerPlaybook } from "./useBulkTriggerPlaybook";
