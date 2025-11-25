import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePersonaTools = (personaId: string | null) => {
  return useQuery({
    queryKey: ["persona-tools", personaId],
    queryFn: async () => {
      if (!personaId) return [];

      const { data, error } = await supabase
        .from("ai_persona_tools")
        .select(`
          tool_id,
          ai_tools (
            id,
            name,
            description,
            is_enabled
          )
        `)
        .eq("persona_id", personaId);

      if (error) throw error;
      return data.map((item: any) => item.ai_tools);
    },
    enabled: !!personaId,
  });
};
