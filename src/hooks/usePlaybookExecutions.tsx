import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlaybookExecutions() {
  return useQuery({
    queryKey: ["playbook-executions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbook_executions")
        .select(`
          *,
          playbook:onboarding_playbooks(name, description),
          contact:contacts(first_name, last_name, email, consultant_id),
          triggered_by_user:profiles!playbook_executions_triggered_by_user_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });
}
