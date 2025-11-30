import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateProfileSkillsData {
  profileId: string;
  skillIds: string[];
}

export function useUpdateProfileSkills() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ profileId, skillIds }: UpdateProfileSkillsData) => {
      // 1. Remover todas as skills antigas
      const { error: deleteError } = await supabase
        .from("profiles_skills")
        .delete()
        .eq("profile_id", profileId);

      if (deleteError) throw deleteError;

      // 2. Inserir as novas skills
      if (skillIds.length > 0) {
        const { error: insertError } = await supabase
          .from("profiles_skills")
          .insert(
            skillIds.map(skillId => ({
              profile_id: profileId,
              skill_id: skillId,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile-skills", variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Habilidades atualizadas!",
        description: "As habilidades do agente foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar habilidades",
        description: error.message,
      });
    },
  });
}
