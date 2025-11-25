import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useTogglePersonaTool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      personaId,
      toolId,
      isLinked,
    }: {
      personaId: string;
      toolId: string;
      isLinked: boolean;
    }) => {
      if (isLinked) {
        // Remove tool from persona
        const { error } = await supabase
          .from("ai_persona_tools")
          .delete()
          .eq("persona_id", personaId)
          .eq("tool_id", toolId);

        if (error) throw error;
      } else {
        // Add tool to persona
        const { error } = await supabase
          .from("ai_persona_tools")
          .insert({
            persona_id: personaId,
            tool_id: toolId,
          });

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["persona-tools", variables.personaId] });
      toast.success(
        variables.isLinked ? "Tool removida da persona" : "Tool adicionada à persona"
      );
    },
    onError: (error) => {
      console.error("Error toggling persona tool:", error);
      toast.error("Erro ao atualizar tools da persona");
    },
  });
};
