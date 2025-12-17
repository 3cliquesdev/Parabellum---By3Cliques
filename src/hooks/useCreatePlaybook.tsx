import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatePlaybookData {
  name: string;
  description?: string;
  product_id?: string;
  support_phone?: string;
  flow_definition: any;
  is_active?: boolean;
}

export function useCreatePlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePlaybookData) => {
      const { data: result, error } = await supabase
        .from("onboarding_playbooks")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      toast({
        title: "Playbook criado",
        description: "O playbook foi criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar playbook",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
