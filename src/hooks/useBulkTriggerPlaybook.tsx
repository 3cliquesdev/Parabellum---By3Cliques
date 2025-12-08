import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkTriggerParams {
  contactIds: string[];
  dealIds?: string[];
  playbookId: string;
  skipExisting?: boolean;
}

interface BulkTriggerResult {
  success: boolean;
  jobId: string;
  total: number;
  processed: number;
  skipped: number;
  leadsConverted?: number;
}

export function useBulkTriggerPlaybook() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: BulkTriggerParams): Promise<BulkTriggerResult> => {
      const { data, error } = await supabase.functions.invoke("bulk-trigger-playbook", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-executions"] });
      queryClient.invalidateQueries({ queryKey: ["sync-jobs"] });
      toast({
        title: "Disparo em massa iniciado",
        description: `${result.processed} de ${result.total} clientes serão processados. ${result.skipped} pulados.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao disparar playbook",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
