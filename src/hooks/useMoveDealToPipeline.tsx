import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface MoveDealParams {
  dealId: string;
  targetPipelineId: string;
  targetStageId: string;
  sourcePipelineName: string;
  targetPipelineName: string;
  targetStageName: string;
  keepHistory?: boolean;
}

export function useMoveDealToPipeline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      dealId, 
      targetPipelineId, 
      targetStageId, 
      sourcePipelineName, 
      targetPipelineName,
      targetStageName,
    }: MoveDealParams) => {
      // 1. Update the deal with new pipeline and stage
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          pipeline_id: targetPipelineId,
          stage_id: targetStageId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      if (updateError) throw updateError;

      // 2. Get contact_id from deal for timeline registration
      const { data: deal } = await supabase
        .from("deals")
        .select("contact_id, title")
        .eq("id", dealId)
        .single();

      // 3. Register in timeline (interactions) if contact exists
      if (deal?.contact_id) {
        await supabase.from("interactions").insert({
          customer_id: deal.contact_id,
          type: "internal_note" as any,
          channel: "other",
          content: `🔄 Negócio "${deal.title}" movido de "${sourcePipelineName}" para "${targetPipelineName}" (etapa: ${targetStageName})`,
          created_by: user?.id,
          metadata: {
            action: "pipeline_migration",
            deal_id: dealId,
            source_pipeline: sourcePipelineName,
            target_pipeline: targetPipelineName,
            target_stage: targetStageName,
          },
        });
      }

      return { dealId, targetPipelineName, targetStageName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast({
        title: "Negócio migrado com sucesso",
        description: `Movido para ${data.targetPipelineName} → ${data.targetStageName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao migrar negócio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
