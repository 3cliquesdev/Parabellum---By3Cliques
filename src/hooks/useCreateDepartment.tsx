import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateDepartmentParams {
  name: string;
  description?: string;
  color?: string;
  whatsapp_number?: string;
  auto_close_enabled?: boolean;
  auto_close_minutes?: number | null;
  send_rating_on_close?: boolean;
  ai_auto_close_minutes?: number | null;
  human_auto_close_minutes?: number | null;
  human_auto_close_tag_id?: string | null;
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
          auto_close_enabled: params.auto_close_enabled ?? false,
          auto_close_minutes: params.auto_close_minutes ?? null,
          send_rating_on_close: params.send_rating_on_close ?? true,
          ai_auto_close_minutes: params.ai_auto_close_minutes ?? null,
          human_auto_close_minutes: params.human_auto_close_minutes ?? null,
          human_auto_close_tag_id: params.human_auto_close_tag_id ?? null,
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
