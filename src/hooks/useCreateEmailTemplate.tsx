import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

interface EmailTemplateInsert {
  name: string;
  subject: string;
  html_body: string;
  trigger_type?: string | null;
  is_active?: boolean;
  variables?: Json | null;
  design_json?: Json | null;
  branding_id?: string | null;
  department_id?: string | null;
  sender_id?: string | null;
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: EmailTemplateInsert) => {
      const { data: result, error } = await supabase
        .from("email_templates")
        .insert({
          name: data.name,
          subject: data.subject,
          html_body: data.html_body,
          trigger_type: data.trigger_type || null,
          is_active: data.is_active ?? true,
          variables: data.variables || null,
          design_json: data.design_json || null,
          branding_id: data.branding_id || null,
          department_id: data.department_id || null,
          sender_id: data.sender_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({
        title: "Template criado",
        description: "O template de email foi criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
