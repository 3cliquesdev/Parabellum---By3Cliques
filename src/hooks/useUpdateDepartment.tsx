import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateDepartmentParams {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  is_active?: boolean;
  whatsapp_number?: string;
  auto_close_enabled?: boolean;
  auto_close_minutes?: number | null;
  send_rating_on_close?: boolean;
  ai_auto_close_minutes?: number | null;
  human_auto_close_minutes?: number | null;
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...params }: UpdateDepartmentParams) => {
      const { data, error } = await supabase
        .from("departments")
        .update(params)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({
        title: "Departamento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar departamento",
        description: error.message,
      });
    },
  });
}
