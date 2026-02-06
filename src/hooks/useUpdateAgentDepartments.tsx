import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateParams {
  profileId: string;
  primaryDepartmentId: string | null;
  additionalDepartmentIds: string[];
}

export function useUpdateAgentDepartments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ profileId, primaryDepartmentId, additionalDepartmentIds }: UpdateParams) => {
      const { data, error } = await supabase.rpc("set_agent_departments", {
        p_profile_id: profileId,
        p_primary_department_id: primaryDepartmentId,
        p_additional_department_ids: additionalDepartmentIds,
      });

      if (error) {
        console.error("[useUpdateAgentDepartments] Error:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-departments", variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users-by-department"] });
      toast({
        title: "✅ Departamentos atualizados",
        description: "Mudanças sincronizadas com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao atualizar",
        description: error?.message || "Tente novamente",
        variant: "destructive",
      });
    },
  });
}
