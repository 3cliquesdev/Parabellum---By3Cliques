import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ==================== TIPOS EXPANDIDOS PARA FORMULÁRIOS 2.0 ====================

export type FormFieldType = 
  | "text" 
  | "email" 
  | "phone" 
  | "select" 
  | "rating"      // Escala 0-10
  | "long_text"   // Textarea
  | "yes_no"      // Botões Sim/Não
  | "date"        // Calendário
  | "number"      // Número
  | "file";       // Upload de arquivos

export interface FieldLogic {
  condition: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string;
  jump_to: string; // ID do campo de destino
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  description?: string;       // Texto de ajuda abaixo da pergunta
  placeholder?: string;
  required?: boolean;
  options?: string[];         // Para campos select
  image_url?: string;         // Imagem de fundo da pergunta
  logic?: FieldLogic;         // Lógica condicional
  min?: number;               // Para rating/number
  max?: number;               // Para rating/number
  // File field specific
  accept?: string;            // Tipos de arquivo aceitos (ex: "image/*,.pdf")
  max_size_mb?: number;       // Tamanho máximo em MB
  max_files?: number;         // Número máximo de arquivos
  // Ticket mapping
  ticket_field?: "subject" | "description" | "priority"; // Mapear para campo do ticket
}

export type FormDisplayMode = "single_page" | "conversational";

export interface FormSettings {
  background_color?: string;
  background_image?: string;
  logo_url?: string;
  button_text?: string;
  button_color?: string;
  button_text_color?: string;       // Cor do texto do botão
  card_background_color?: string;   // Cor do container/cartão
  card_opacity?: number;            // Opacidade (0-100) para glassmorphism
  border_radius?: number;           // Arredondamento (0-30px)
  text_color?: string;              // Cor dos textos/labels
  input_background_color?: string;  // Fundo dos inputs
  input_text_color?: string;        // Texto dos inputs
  input_border_color?: string;      // Borda dos inputs
  thank_you_title?: string;
  thank_you_message?: string;
  redirect_url?: string;
  show_progress_bar?: boolean;
  allow_back_navigation?: boolean;
  display_mode?: FormDisplayMode;   // Página única ou conversacional
}

export interface TicketSettings {
  default_priority?: "low" | "medium" | "high" | "urgent";
  default_category?: "financeiro" | "tecnico" | "bug" | "outro";
  send_auto_reply?: boolean;
  auto_reply_template?: string;
}

export interface FormSchema {
  fields: FormField[];
  settings?: FormSettings;
  ticket_settings?: TicketSettings;
}

export type FormTargetType = "deal" | "ticket" | "internal_request";
export type FormDistributionRule = "round_robin" | "manager_only" | "specific_user";

export interface Form {
  id: string;
  name: string;
  description: string | null;
  schema: FormSchema;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Routing fields
  target_type: FormTargetType;
  target_department_id: string | null;
  target_pipeline_id: string | null;
  target_user_id: string | null;
  distribution_rule: FormDistributionRule;
  notify_manager: boolean;
}

// ==================== DEFAULT VALUES ====================

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  background_color: "#0a0a0a",
  button_text: "Continuar",
  button_color: "#2563EB",
  button_text_color: "#ffffff",
  card_background_color: "#1a1a2e",
  card_opacity: 90,
  border_radius: 16,
  text_color: "#ffffff",
  input_background_color: "#ffffff",
  input_text_color: "#000000",
  input_border_color: "#e5e7eb",
  thank_you_title: "Obrigado!",
  thank_you_message: "Suas respostas foram enviadas com sucesso.",
  show_progress_bar: true,
  allow_back_navigation: true,
  display_mode: "conversational",
};

export const DEFAULT_TICKET_SETTINGS: TicketSettings = {
  default_priority: "medium",
  default_category: "outro",
  send_auto_reply: true,
  auto_reply_template: "Recebemos sua solicitação. Ticket #{{ticket_number}} criado. Nossa equipe entrará em contato em breve.",
};

export const createDefaultField = (type: FormFieldType = "text"): FormField => ({
  id: crypto.randomUUID(),
  type,
  label: getDefaultLabel(type),
  placeholder: getDefaultPlaceholder(type),
  required: false,
  ...(type === "file" ? { accept: "image/*,.pdf,.doc,.docx", max_size_mb: 10 } : {}),
});

function getDefaultLabel(type: FormFieldType): string {
  const labels: Record<FormFieldType, string> = {
    text: "Qual é o seu nome?",
    email: "Qual é o seu e-mail?",
    phone: "Qual é o seu telefone?",
    select: "Escolha uma opção",
    rating: "De 0 a 10, como você avalia?",
    long_text: "Conte-nos mais",
    yes_no: "Você concorda?",
    date: "Selecione uma data",
    number: "Informe um número",
    file: "Anexe um arquivo",
  };
  return labels[type];
}

function getDefaultPlaceholder(type: FormFieldType): string {
  const placeholders: Record<FormFieldType, string> = {
    text: "Digite aqui...",
    email: "seu@email.com",
    phone: "(00) 00000-0000",
    select: "Selecione...",
    rating: "",
    long_text: "Escreva sua resposta...",
    yes_no: "",
    date: "DD/MM/AAAA",
    number: "0",
    file: "",
  };
  return placeholders[type];
}

// ==================== HOOKS ====================

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
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return data as unknown as Form;
    },
    enabled: !!formId,
  });
}

export function useFormById(formId: string | undefined) {
  return useQuery({
    queryKey: ["forms", formId, "any"],
    queryFn: async () => {
      if (!formId) throw new Error("Form ID is required");

      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq("id", formId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return data as unknown as Form;
    },
    enabled: !!formId,
  });
}

export function useCreateForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (form: { 
      name: string; 
      description?: string; 
      schema: FormSchema;
      target_type?: FormTargetType;
      target_department_id?: string;
      target_pipeline_id?: string;
      target_user_id?: string;
      distribution_rule?: FormDistributionRule;
      notify_manager?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("forms")
        .insert({
          name: form.name,
          description: form.description || null,
          schema: form.schema as any,
          target_type: form.target_type || "deal",
          target_department_id: form.target_department_id || null,
          target_pipeline_id: form.target_pipeline_id || null,
          target_user_id: form.target_user_id || null,
          distribution_rule: form.distribution_rule || "round_robin",
          notify_manager: form.notify_manager ?? true,
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
      updates: { 
        name?: string; 
        description?: string; 
        schema?: FormSchema; 
        is_active?: boolean;
        target_type?: FormTargetType;
        target_department_id?: string | null;
        target_pipeline_id?: string | null;
        target_user_id?: string | null;
        distribution_rule?: FormDistributionRule;
        notify_manager?: boolean;
      };
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
