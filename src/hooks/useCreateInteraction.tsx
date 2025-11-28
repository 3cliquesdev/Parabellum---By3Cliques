import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type InteractionInsert = {
  customer_id: string;
  type: Tables<"interactions">["type"];
  content: string;
  channel: Tables<"interactions">["channel"];
  metadata?: any;
};

export function useCreateInteraction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InteractionInsert) => {
      const { data: result, error } = await supabase
        .from("interactions")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["customer-timeline", variables.customer_id] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["unified-timeline", variables.customer_id] 
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({ 
        title: "Interação registrada", 
        description: "Linha do tempo atualizada com sucesso" 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar interação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
