import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdatePlaybookData {
  id: string;
  name?: string;
  description?: string;
  product_id?: string;
  flow_definition?: any;
  is_active?: boolean;
}

export function useUpdatePlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePlaybookData) => {
      const { data: result, error } = await supabase
        .from("onboarding_playbooks")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      toast({
        title: "Playbook atualizado",
        description: "O playbook foi atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar playbook",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
