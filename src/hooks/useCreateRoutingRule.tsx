import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type DepartmentType = Database["public"]["Enums"]["department_type"];

export const useCreateRoutingRule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      channel: string;
      department?: DepartmentType;
      persona_id?: string;
      priority?: number;
      is_active?: boolean;
    }) => {
      const { data: rule, error } = await supabase
        .from("ai_routing_rules")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-routing-rules"] });
      toast({
        title: "Regra criada",
        description: "A regra de roteamento foi criada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar regra",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
