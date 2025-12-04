import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  trigger_type: string | null;
  is_active: boolean;
  variables: Json | null;
  design_json: Json | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  branding_id: string | null;
  department_id: string | null;
  sender_id: string | null;
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });
}

export function useEmailTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ["email-templates", templateId],
    queryFn: async () => {
      if (!templateId) throw new Error("Template ID is required");

      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!templateId,
  });
}

export function useEmailTemplateByTrigger(triggerType: string | undefined) {
  return useQuery({
    queryKey: ["email-templates", "trigger", triggerType],
    queryFn: async () => {
      if (!triggerType) throw new Error("Trigger type is required");

      const { data, error } = await supabase
        .from("email_templates")
        .select("*, email_branding(*), email_senders(*)")
        .eq("trigger_type", triggerType)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!triggerType,
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: {
      name: string;
      subject: string;
      html_body: string;
      trigger_type?: string | null;
      is_active?: boolean;
      variables?: Json;
      design_json?: Json | null;
      branding_id?: string | null;
      department_id?: string | null;
      sender_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          name: template.name,
          subject: template.subject,
          html_body: template.html_body,
          trigger_type: template.trigger_type || null,
          is_active: template.is_active ?? true,
          variables: template.variables || null,
          design_json: template.design_json || null,
          branding_id: template.branding_id || null,
          department_id: template.department_id || null,
          sender_id: template.sender_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({
        title: "Template criado",
        description: "Template de e-mail criado com sucesso.",
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

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        name?: string;
        subject?: string;
        html_body?: string;
        trigger_type?: string | null;
        is_active?: boolean;
        variables?: Json;
        design_json?: Json | null;
        branding_id?: string | null;
        department_id?: string | null;
        sender_id?: string | null;
      };
    }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({
        title: "Template atualizado",
        description: "Alterações salvas com sucesso.",
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

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast({
        title: "Template excluído",
        description: "Template removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
