import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrainingExample {
  id: string;
  persona_id: string;
  input_text: string;
  ideal_output: string;
  category: string | null;
  scenario_type: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface TrainingExampleInput {
  persona_id: string;
  input_text: string;
  ideal_output: string;
  category?: string;
  scenario_type?: string;
}

export const useTrainingExamples = (personaId: string | null) => {
  return useQuery({
    queryKey: ['training-examples', personaId],
    queryFn: async () => {
      if (!personaId) return [];
      
      const { data, error } = await supabase
        .from('ai_training_examples')
        .select('*')
        .eq('persona_id', personaId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TrainingExample[];
    },
    enabled: !!personaId,
  });
};

export const useCreateTrainingExample = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: TrainingExampleInput) => {
      const { data: result, error } = await supabase
        .from('ai_training_examples')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-examples'] });
      toast.success('✅ Exemplo salvo para treinamento!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar exemplo: ${error.message}`);
    },
  });
};

export const useUpdateTrainingExample = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TrainingExampleInput> }) => {
      const { data: result, error } = await supabase
        .from('ai_training_examples')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-examples'] });
      toast.success('Exemplo atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar exemplo: ${error.message}`);
    },
  });
};

export const useDeleteTrainingExample = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_training_examples')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-examples'] });
      toast.success('Exemplo removido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover exemplo: ${error.message}`);
    },
  });
};

export const useScenarioConfigs = () => {
  return useQuery({
    queryKey: ['scenario-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_scenario_configs')
        .select('*')
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};