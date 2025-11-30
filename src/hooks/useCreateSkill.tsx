import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateSkillData {
  name: string;
  description?: string;
  color: string;
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSkillData) => {
      const { data: skill, error } = await supabase
        .from("skills")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      toast({
        title: "Habilidade criada com sucesso!",
        description: "A nova habilidade está disponível para atribuição.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar habilidade",
        description: error.message,
      });
    },
  });
}
