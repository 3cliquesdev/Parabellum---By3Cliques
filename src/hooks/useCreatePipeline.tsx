import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatePipelineData {
  name: string;
  is_default?: boolean;
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePipelineData) => {
      // Criar pipeline
      const { data: pipeline, error: pipelineError } = await supabase
        .from("pipelines")
        .insert({
          name: data.name,
          is_default: data.is_default || false,
        })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      // Criar stages padrão
      const defaultStages = [
        { name: "Início", position: 0, pipeline_id: pipeline.id },
        { name: "Em Andamento", position: 1, pipeline_id: pipeline.id },
        { name: "Concluído", position: 2, pipeline_id: pipeline.id },
      ];

      const { error: stagesError } = await supabase
        .from("stages")
        .insert(defaultStages);

      if (stagesError) throw stagesError;

      return pipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      toast({
        title: "Pipeline criado com sucesso",
        description: "As etapas padrão foram adicionadas automaticamente.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar pipeline",
        description: error.message,
      });
    },
  });
}
