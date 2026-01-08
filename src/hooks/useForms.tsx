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

// ==================== SCORING TYPES ====================

export interface FieldScoringOption {
  value: string;      // Valor da opção (ex: "Sim", "5", "Opção A")
  points: number;     // Pontos atribuídos
}

export interface FieldScoring {
  enabled: boolean;
  options: FieldScoringOption[];
}

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
  // Scoring configuration
  scoring?: FieldScoring;     // Pontuação por opção para qualificação de leads
}

export type FormDisplayMode = "single_page" | "conversational";

export type LogoPosition = "left" | "center" | "right";
export type LogoSize = "small" | "medium" | "large";
export type TransitionType = "slide" | "fade" | "zoom" | "scale";
export type EntryAnimation = "none" | "fade-up" | "fade-down" | "fade-left" | "fade-right" | "zoom-in" | "bounce" | "flip";
export type FontFamily = "inter" | "poppins" | "roboto" | "montserrat" | "playfair" | "lato" | "raleway" | "oswald";
export type FontWeight = "light" | "normal" | "medium" | "semibold" | "bold";
export type ValidationStyle = "subtle" | "prominent" | "minimal";
export type ProgressStyle = "bar" | "steps" | "dots" | "fraction";
export type ProgressPosition = "top" | "bottom" | "header";
export type ButtonStyle = "solid" | "outline" | "gradient" | "glass";
export type ButtonSize = "small" | "medium" | "large";
export type ButtonIcon = "none" | "check" | "arrow" | "send" | "rocket" | "star";

export type GradientDirection = "to-b" | "to-r" | "to-br" | "to-bl" | "radial";

export interface FormSettings {
  background_color?: string;
  background_image?: string;
  // Gradiente de fundo
  background_gradient_enabled?: boolean;
  background_gradient_from?: string;
  background_gradient_to?: string;
  background_gradient_direction?: GradientDirection;
  logo_url?: string;
  logo_position?: LogoPosition;      // Posição do logo (esquerda/centro/direita)
  logo_size?: LogoSize;              // Tamanho do logo (pequeno/médio/grande)
  button_text?: string;
  button_color?: string;
  button_text_color?: string;       // Cor do texto do botão
  // Estilização avançada de botões
  button_style?: ButtonStyle;       // Estilo do botão (solid/outline/gradient/glass)
  button_size?: ButtonSize;         // Tamanho do botão (small/medium/large)
  button_icon?: ButtonIcon;         // Ícone do botão
  button_icon_position?: "left" | "right"; // Posição do ícone
  button_border_radius?: number;    // Arredondamento do botão (0-30px)
  button_gradient_to?: string;      // Segunda cor para gradiente
  button_border_color?: string;     // Cor da borda (para outline)
  button_border_width?: number;     // Espessura da borda
  button_shadow?: boolean;          // Sombra no botão
  button_shadow_color?: string;     // Cor da sombra
  button_full_width?: boolean;      // Botão largura total
  button_hover_effect?: "scale" | "glow" | "lift" | "none"; // Efeito hover específico
  card_background_color?: string;   // Cor do container/cartão
  card_opacity?: number;            // Opacidade (0-100) para glassmorphism
  card_shadow?: boolean;            // Habilitar sombra no container
  card_shadow_intensity?: number;   // Intensidade da sombra (1-5)
  card_border_color?: string;       // Cor da borda do container
  card_border_width?: number;       // Espessura da borda do container (0-5px)
  border_radius?: number;           // Arredondamento (0-30px)
  text_color?: string;              // Cor dos textos/labels
  title_color?: string;             // Cor do título do formulário
  description_color?: string;       // Cor da descrição do formulário
  input_background_color?: string;  // Fundo dos inputs
  input_text_color?: string;        // Texto dos inputs
  input_border_color?: string;      // Borda dos inputs
  selection_highlight_color?: string;    // Cor do destaque/borda de seleção
  selection_background_color?: string;   // Fundo da opção selecionada
  selection_text_color?: string;         // Texto da opção selecionada
  selection_border_width?: number;       // Espessura da borda de seleção (1-8px)
  // Tipografia avançada
  font_family?: FontFamily;         // Fonte do formulário
  title_size?: number;              // Tamanho do título (16-48px)
  description_size?: number;        // Tamanho da descrição (12-24px)
  title_weight?: FontWeight;        // Peso do título
  label_weight?: FontWeight;        // Peso dos labels
  letter_spacing?: number;          // Espaçamento entre letras (-2 a 4)
  line_height?: number;             // Altura de linha (1.0 a 2.0)
  // Animações
  transition_type?: TransitionType; // Tipo de transição entre campos
  transition_duration?: number;     // Duração da transição (0.2-0.8s)
  entry_animation?: EntryAnimation; // Animação de entrada dos elementos
  entry_stagger?: number;           // Delay entre elementos (0-200ms)
  // Efeitos de hover
  hover_effect_enabled?: boolean;   // Habilitar efeitos de hover
  hover_scale?: number;             // Escala no hover (1.00-1.10)
  hover_glow?: boolean;             // Brilho/glow no hover
  // Espaçamento avançado
  container_padding?: number;       // Padding interno do container (16-64px)
  field_gap?: number;               // Espaçamento entre campos (8-48px)
  // Validação Visual
  validation_style?: ValidationStyle;      // Estilo de validação (subtle/prominent/minimal)
  validation_error_color?: string;         // Cor de erro
  validation_success_color?: string;       // Cor de sucesso
  show_required_asterisk?: boolean;        // Mostrar asterisco em obrigatórios
  show_field_validation?: boolean;         // Mostrar validação em tempo real
  shake_on_error?: boolean;                // Animação shake no erro
  // Success
  thank_you_title?: string;
  thank_you_message?: string;
  redirect_url?: string;
  // Progress Indicator
  show_progress_bar?: boolean;
  progress_style?: ProgressStyle;           // Estilo do indicador (bar/steps/dots/fraction)
  progress_position?: ProgressPosition;     // Posição (top/bottom/header)
  progress_color?: string;                  // Cor do progresso
  progress_background_color?: string;       // Cor de fundo do progresso
  progress_height?: number;                 // Altura da barra (2-12px)
  progress_show_percentage?: boolean;       // Mostrar porcentagem
  progress_animate?: boolean;               // Animar transições
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

export type FormTargetType = "deal" | "ticket" | "internal_request" | "none";
export type FormDistributionRule = "round_robin" | "manager_only" | "specific_user";

export interface Form {
  id: string;
  name: string;
  title: string | null;
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
  max_submissions_per_contact: number | null;
}

// ==================== DEFAULT VALUES ====================

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  background_color: "#0a0a0a",
  background_gradient_enabled: false,
  background_gradient_from: "#1a1a2e",
  background_gradient_to: "#0a0a0a",
  background_gradient_direction: "to-b",
  button_text: "Continuar",
  button_color: "#2563EB",
  button_text_color: "#ffffff",
  button_style: "solid",
  button_size: "large",
  button_icon: "check",
  button_icon_position: "left",
  button_border_radius: 12,
  button_gradient_to: "#7c3aed",
  button_border_color: "#2563EB",
  button_border_width: 2,
  button_shadow: true,
  button_shadow_color: "#2563EB",
  button_full_width: true,
  button_hover_effect: "scale",
  card_background_color: "#1a1a2e",
  card_opacity: 90,
  card_shadow: true,
  card_shadow_intensity: 3,
  card_border_color: "",
  card_border_width: 0,
  border_radius: 16,
  text_color: "#ffffff",
  title_color: "#ffffff",
  description_color: "#ffffff",
  logo_position: "left",
  logo_size: "medium",
  input_background_color: "#ffffff",
  input_text_color: "#000000",
  input_border_color: "#e5e7eb",
  selection_highlight_color: "",
  selection_background_color: "",
  selection_text_color: "",
  selection_border_width: 3,
  // Tipografia
  font_family: "inter",
  title_size: 24,
  description_size: 14,
  title_weight: "bold",
  label_weight: "bold",
  letter_spacing: 0,
  line_height: 1.5,
  // Animações
  transition_type: "slide",
  transition_duration: 0.3,
  entry_animation: "fade-up",
  entry_stagger: 50,
  // Hover
  hover_effect_enabled: true,
  hover_scale: 1.02,
  hover_glow: true,
  // Espaçamento
  container_padding: 32,
  field_gap: 24,
  // Validação Visual
  validation_style: "prominent",
  validation_error_color: "#ef4444",
  validation_success_color: "#22c55e",
  show_required_asterisk: true,
  show_field_validation: true,
  shake_on_error: true,
  // Success
  thank_you_title: "Obrigado!",
  thank_you_message: "Suas respostas foram enviadas com sucesso.",
  // Progress Indicator
  show_progress_bar: true,
  progress_style: "bar",
  progress_position: "top",
  progress_color: "#2563EB",
  progress_background_color: "#374151",
  progress_height: 4,
  progress_show_percentage: false,
  progress_animate: true,
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
      title?: string;
      description?: string; 
      schema: FormSchema;
      target_type?: FormTargetType;
      target_department_id?: string;
      target_pipeline_id?: string;
      target_user_id?: string;
      distribution_rule?: FormDistributionRule;
      notify_manager?: boolean;
      max_submissions_per_contact?: number | null;
    }) => {
      const { data, error } = await supabase
        .from("forms")
        .insert({
          name: form.name,
          title: form.title || null,
          description: form.description || null,
          schema: form.schema as any,
          target_type: form.target_type || "deal",
          target_department_id: form.target_department_id || null,
          target_pipeline_id: form.target_pipeline_id || null,
          target_user_id: form.target_user_id || null,
          distribution_rule: form.distribution_rule || "round_robin",
          notify_manager: form.notify_manager ?? true,
          max_submissions_per_contact: form.max_submissions_per_contact ?? null,
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
        title?: string | null;
        description?: string; 
        schema?: FormSchema; 
        is_active?: boolean;
        target_type?: FormTargetType;
        target_department_id?: string | null;
        target_pipeline_id?: string | null;
        target_user_id?: string | null;
        distribution_rule?: FormDistributionRule;
        notify_manager?: boolean;
        max_submissions_per_contact?: number | null;
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
