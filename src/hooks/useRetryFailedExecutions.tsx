import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useRetryFailedExecutions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ playbookId }: { playbookId: string }) => {
      // Fetch failed executions for this playbook
      const { data: failedExecs, error: fetchError } = await supabase
        .from("playbook_executions")
        .select("id, contact_id, playbook_id")
        .eq("playbook_id", playbookId)
        .eq("status", "failed");

      if (fetchError) throw fetchError;
      if (!failedExecs || failedExecs.length === 0) {
        throw new Error("Nenhuma execução falha encontrada para este playbook");
      }

      // Re-trigger for each failed contact
      const contactIds = [...new Set(failedExecs.map(e => e.contact_id))];
      
      const { data, error } = await supabase.functions.invoke("bulk-trigger-playbook", {
        body: {
          contact_ids: contactIds,
          playbook_id: playbookId,
          skip_existing: false,
        },
      });

      if (error) throw error;
      return { retriedCount: contactIds.length, ...data };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-executions"] });
      queryClient.invalidateQueries({ queryKey: ["playbook-metrics"] });
      toast({
        title: "Reenvio iniciado",
        description: `${result.retriedCount} execuções reenviadas com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao reenviar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
