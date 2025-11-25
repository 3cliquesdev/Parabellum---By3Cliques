import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ExecutePlaybookData {
  playbook_id: string;
  contact_id: string;
}

export function useExecutePlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ExecutePlaybookData) => {
      const { data: result, error } = await supabase.functions.invoke(
        "execute-playbook",
        {
          body: data,
        }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-executions"] });
      toast({
        title: "Playbook iniciado",
        description: "O playbook foi iniciado com sucesso e está sendo executado",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao executar playbook",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
