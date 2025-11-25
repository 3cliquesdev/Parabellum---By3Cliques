import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar se há usuários neste departamento
      const { data: profiles, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("department", id)
        .limit(1);

      if (checkError) throw checkError;

      if (profiles && profiles.length > 0) {
        throw new Error("Não é possível deletar departamento com usuários vinculados");
      }

      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({
        title: "Departamento deletado",
        description: "O departamento foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao deletar departamento",
        description: error.message,
      });
    },
  });
}
