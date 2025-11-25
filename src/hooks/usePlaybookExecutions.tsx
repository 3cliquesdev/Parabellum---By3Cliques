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
          contact:contacts(first_name, last_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });
}
