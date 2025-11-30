import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateSkillData {
  id: string;
  name?: string;
  description?: string;
  color?: string;
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSkillData) => {
      const { data: skill, error } = await supabase
        .from("skills")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return skill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      toast({
        title: "Habilidade atualizada!",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar habilidade",
        description: error.message,
      });
    },
  });
}
