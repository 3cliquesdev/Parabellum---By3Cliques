import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useDeleteRoutingRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_routing_rules").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-routing-rules"] });
      toast({
        title: "Regra deletada",
        description: "A regra de roteamento foi deletada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao deletar regra",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
