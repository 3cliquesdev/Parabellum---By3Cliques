import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "select";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select fields
}

export interface FormSchema {
  fields: FormField[];
}

export interface Form {
  id: string;
  name: string;
  description: string | null;
  schema: FormSchema;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useForms() {
  return useQuery({
    queryKey: ["forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Form[];
    },
  });
}

export function useForm(formId: string | undefined) {
  return useQuery({
    queryKey: ["forms", formId],
    queryFn: async () => {
      if (!formId) throw new Error("Form ID is required");

      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", formId)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return data as unknown as Form;
    },
    enabled: !!formId,
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (form: { name: string; description?: string; schema: FormSchema }) => {
      const { data, error } = await supabase
        .from("forms")
        .insert({
          name: form.name,
          description: form.description || null,
          schema: form.schema as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast({
        title: "Formulário criado",
        description: "Formulário criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: { name?: string; description?: string; schema?: FormSchema; is_active?: boolean };
    }) => {
      const updatePayload: any = { ...updates };
      if (updates.schema) {
        updatePayload.schema = updates.schema as any;
      }

      const { data, error } = await supabase
        .from("forms")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast({
        title: "Formulário atualizado",
        description: "Alterações salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forms").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] });
      toast({
        title: "Formulário excluído",
        description: "Formulário removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSubmitForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (submission: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
      company?: string;
    }) => {
      // Validar email antes de enviar
      if (!submission.email) {
        throw new Error('Email é obrigatório');
      }

      const { data: result, error } = await supabase.functions.invoke('upsert-contact', {
        body: {
          email: submission.email,
          first_name: submission.first_name,
          last_name: submission.last_name,
          phone: submission.phone,
          company: submission.company,
          source: 'form',
        },
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error || 'Erro ao processar contato');

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["customer-timeline", result.contact_id] });

      const message = result.is_new_contact
        ? "Obrigado pelo seu interesse. Entraremos em contato em breve."
        : "Obrigado por voltar! Atualizamos suas informações.";

      toast({
        title: "Formulário enviado!",
        description: message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar formulário",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
