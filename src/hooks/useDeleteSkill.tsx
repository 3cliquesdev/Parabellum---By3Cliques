import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (skillId: string) => {
      const { error } = await supabase
        .from("skills")
        .delete()
        .eq("id", skillId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["profile-skills"] });
      toast({
        title: "Habilidade excluída",
        description: "A habilidade foi removida do sistema.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir habilidade",
        description: error.message,
      });
    },
  });
}
