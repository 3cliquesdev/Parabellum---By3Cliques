import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateUserData {
  user_id: string;
  role?: "admin" | "manager" | "sales_rep" | "consultant" | "support_agent" | "support_manager" | "financial_manager";
  department?: string;
  full_name?: string;
  job_title?: string;
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateUserData) => {
      console.log("[useUpdateUser] Updating user:", data);

      const { data: result, error } = await supabase.functions.invoke('update-user', {
        body: data,
      });

      if (error) {
        console.error("[useUpdateUser] Edge Function error:", error);
        throw new Error(error.message || "Erro ao chamar função de atualização");
      }

      if (!result?.success) {
        throw new Error(result?.error || "Falha ao atualizar usuário");
      }

      console.log("[useUpdateUser] User updated successfully");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Usuário atualizado com sucesso!",
        description: "As informações do usuário foram atualizadas.",
      });
    },
    onError: (error: Error) => {
      console.error("[useUpdateUser] Error:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar usuário",
        description: error.message,
      });
    },
  });
}
