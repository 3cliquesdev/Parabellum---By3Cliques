import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCadenceSteps(cadenceId?: string) {
  return useQuery({
    queryKey: ["cadence-steps", cadenceId],
    queryFn: async () => {
      if (!cadenceId) return [];

      const { data, error } = await supabase
        .from("cadence_steps")
        .select(`
          *,
          template:email_templates(id, name, subject)
        `)
        .eq("cadence_id", cadenceId)
        .order("position", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!cadenceId,
  });
}
