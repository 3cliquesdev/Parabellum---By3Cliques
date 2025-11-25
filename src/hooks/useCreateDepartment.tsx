import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateDepartmentParams {
  name: string;
  description?: string;
  color?: string;
  whatsapp_number?: string;
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: CreateDepartmentParams) => {
      const { data, error } = await supabase
        .from("departments")
        .insert({
          name: params.name,
          description: params.description,
          color: params.color || "#3B82F6",
          whatsapp_number: params.whatsapp_number,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({
        title: "Departamento criado",
        description: "O departamento foi criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar departamento",
        description: error.message,
      });
    },
  });
}
