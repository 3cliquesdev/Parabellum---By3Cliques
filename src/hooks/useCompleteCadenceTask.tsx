import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CompleteCadenceTaskData {
  task_id: string;
  skip?: boolean; // true = skip, false = complete
}

export function useCompleteCadenceTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ task_id, skip = false }: CompleteCadenceTaskData) => {
      const { error } = await supabase
        .from("cadence_tasks")
        .update({
          status: skip ? "skipped" : "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", task_id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cadence-tasks"] });
      toast({
        title: variables.skip ? "Tarefa pulada" : "Tarefa concluída",
        description: variables.skip 
          ? "A tarefa foi marcada como pulada." 
          : "A tarefa foi concluída com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar tarefa",
        description: error.message,
      });
    },
  });
}
