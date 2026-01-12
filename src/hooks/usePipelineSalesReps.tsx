import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function usePipelineSalesReps(pipelineId?: string) {
  return useQuery({
    queryKey: ["pipeline-sales-reps", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];

      const { data, error } = await supabase
        .from("pipeline_sales_reps")
        .select(`
          id,
          pipeline_id,
          user_id,
          profiles:user_id(
            id,
            full_name,
            job_title,
            avatar_url,
            availability_status
          )
        `)
        .eq("pipeline_id", pipelineId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!pipelineId,
  });
}

export function useUpdatePipelineSalesReps() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ pipelineId, userIds }: { pipelineId: string; userIds: string[] }) => {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from("pipeline_sales_reps")
        .delete()
        .eq("pipeline_id", pipelineId);

      if (deleteError) throw deleteError;

      // Insert new assignments if any
      if (userIds.length > 0) {
        const assignments = userIds.map(userId => ({
          pipeline_id: pipelineId,
          user_id: userId,
        }));

        const { error: insertError } = await supabase
          .from("pipeline_sales_reps")
          .insert(assignments);

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { pipelineId }) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline-sales-reps", pipelineId] });
      toast({
        title: "Equipe atualizada",
        description: "Vendedores do pipeline atualizados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar equipe",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
