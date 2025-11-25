import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type DepartmentType = Database["public"]["Enums"]["department_type"];

export const useUpdateRoutingRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        channel?: string;
        department?: DepartmentType;
        persona_id?: string;
        priority?: number;
        is_active?: boolean;
      };
    }) => {
      const { data: rule, error } = await supabase
        .from("ai_routing_rules")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-routing-rules"] });
      toast({
        title: "Regra atualizada",
        description: "A regra de roteamento foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar regra",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
