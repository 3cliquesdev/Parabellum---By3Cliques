import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useDeletePersona = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_personas").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-personas"] });
      toast({
        title: "Persona deletada",
        description: "A persona foi deletada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao deletar persona",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
