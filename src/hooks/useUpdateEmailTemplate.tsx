import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type EmailTemplateUpdate = {
  id: string;
  name?: string;
  subject?: string;
  html_body?: string;
  trigger_type?: string | null;
  trigger_types?: string[] | null;
  variables?: any;
  is_active?: boolean;
  design_json?: any;
};

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: EmailTemplateUpdate) => {
      const { data: result, error } = await supabase
        .from("email_templates")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({
        title: "Template atualizado",
        description: "As alterações foram salvas com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
