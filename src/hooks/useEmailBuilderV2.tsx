import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import type { 
  EmailTemplateV2, 
  EmailBlock, 
  BlockCondition, 
  EmailTemplateVariant,
  EmailTemplateTranslation,
  EmailLayout,
  EmailVariable,
  EmailSend
} from "@/types/emailBuilderV2";

// =============================================
// TEMPLATES V2
// =============================================

export function useEmailTemplatesV2() {
  return useQuery({
    queryKey: ["email-templates-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates_v2")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailTemplateV2[];
    },
  });
}

export function useEmailTemplateV2(id: string | undefined) {
  return useQuery({
    queryKey: ["email-template-v2", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("email_templates_v2")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as EmailTemplateV2;
    },
    enabled: !!id,
  });
}

export function useCreateEmailTemplateV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: Omit<EmailTemplateV2, 'id' | 'created_at' | 'updated_at' | 'version'>) => {
      const { data, error } = await supabase
        .from("email_templates_v2")
        .insert({
          name: template.name,
          description: template.description,
          category: template.category,
          trigger_type: template.trigger_type,
          default_subject: template.default_subject,
          default_preheader: template.default_preheader,
          is_active: template.is_active ?? true,
          branding_id: template.branding_id,
          sender_id: template.sender_id,
          department_id: template.department_id,
          legacy_template_id: template.legacy_template_id,
          ab_testing_enabled: template.ab_testing_enabled ?? false,
          created_by: template.created_by,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplateV2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates-v2"] });
      toast({ title: "Template V2 criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar template", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateEmailTemplateV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmailTemplateV2> }) => {
      const { data, error } = await supabase
        .from("email_templates_v2")
        .update({
          name: updates.name,
          description: updates.description,
          category: updates.category,
          trigger_type: updates.trigger_type,
          default_subject: updates.default_subject,
          default_preheader: updates.default_preheader,
          is_active: updates.is_active,
          branding_id: updates.branding_id,
          sender_id: updates.sender_id,
          department_id: updates.department_id,
          ab_testing_enabled: updates.ab_testing_enabled,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplateV2;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates-v2"] });
      queryClient.invalidateQueries({ queryKey: ["email-template-v2", id] });
      toast({ title: "Template atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

export function useToggleEmailTemplateV2Status() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("email_templates_v2")
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as EmailTemplateV2;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates-v2"] });
      queryClient.invalidateQueries({ queryKey: ["email-template-v2", data.id] });
      toast({ 
        title: data.is_active ? "Template ativado!" : "Template desativado!",
        description: data.is_active 
          ? "O template está pronto para uso" 
          : "O template não será usado em automações"
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao alterar status", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteEmailTemplateV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates_v2")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates-v2"] });
      toast({ title: "Template excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
}

export function useDuplicateEmailTemplateV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // 1. Fetch original template
      const { data: original, error: fetchError } = await supabase
        .from("email_templates_v2")
        .select("*")
        .eq("id", templateId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Create copy of template
      const { data: newTemplate, error: insertError } = await supabase
        .from("email_templates_v2")
        .insert({
          name: `${original.name} (Cópia)`,
          description: original.description,
          category: original.category,
          trigger_type: null, // Remove trigger to avoid conflicts
          default_subject: original.default_subject,
          default_preheader: original.default_preheader,
          is_active: false, // Inactive by default
          branding_id: original.branding_id,
          sender_id: original.sender_id,
          department_id: original.department_id,
          ab_testing_enabled: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Duplicate template blocks
      const { data: blocks } = await supabase
        .from("email_template_blocks")
        .select("*")
        .eq("template_id", templateId)
        .order("position", { ascending: true });

      if (blocks && blocks.length > 0) {
        const newBlocks = blocks.map((block) => ({
          template_id: newTemplate.id,
          block_type: block.block_type,
          position: block.position,
          content: block.content,
          styles: block.styles,
          responsive: block.responsive,
          parent_block_id: null,
          column_index: block.column_index,
        }));

        await supabase.from("email_template_blocks").insert(newBlocks);
      }

      return newTemplate;
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates-v2"] });
      toast({
        title: "Template duplicado!",
        description: `"${newTemplate.name}" criado com sucesso`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao duplicar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// =============================================
// BLOCKS
// =============================================

export function useEmailBlocks(templateId: string | undefined) {
  return useQuery({
    queryKey: ["email-blocks", templateId],
    queryFn: async () => {
      if (!templateId) return [];

      const { data, error } = await supabase
        .from("email_template_blocks")
        .select("*")
        .eq("template_id", templateId)
        .order("position", { ascending: true });

      if (error) throw error;
      return data as unknown as EmailBlock[];
    },
    enabled: !!templateId,
  });
}

export function useSaveEmailBlocks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ templateId, blocks }: { templateId: string; blocks: Omit<EmailBlock, 'id' | 'created_at' | 'updated_at'>[] }) => {
      // Delete existing blocks
      await supabase
        .from("email_template_blocks")
        .delete()
        .eq("template_id", templateId);

      // Insert new blocks
      if (blocks.length > 0) {
        const blocksToInsert = blocks.map((block, index) => ({
          template_id: templateId,
          block_type: block.block_type,
          position: index,
          content: block.content as unknown as Json,
          styles: block.styles as unknown as Json,
          responsive: block.responsive as unknown as Json,
          parent_block_id: block.parent_block_id,
          column_index: block.column_index,
        }));

        const { data, error } = await supabase
          .from("email_template_blocks")
          .insert(blocksToInsert)
          .select();

        if (error) throw error;
        return data as unknown as EmailBlock[];
      }

      return [];
    },
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: ["email-blocks", templateId] });
      toast({ title: "Blocos salvos!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar blocos", description: error.message, variant: "destructive" });
    },
  });
}

// =============================================
// BLOCK CONDITIONS
// =============================================

export function useBlockConditions(blockId: string | undefined) {
  return useQuery({
    queryKey: ["block-conditions", blockId],
    queryFn: async () => {
      if (!blockId) return [];

      const { data, error } = await supabase
        .from("email_block_conditions")
        .select("*")
        .eq("block_id", blockId)
        .order("group_index", { ascending: true });

      if (error) throw error;
      return data as unknown as BlockCondition[];
    },
    enabled: !!blockId,
  });
}

export function useSaveBlockConditions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ blockId, conditions }: { blockId: string; conditions: Omit<BlockCondition, 'id' | 'created_at'>[] }) => {
      // Delete existing conditions
      await supabase
        .from("email_block_conditions")
        .delete()
        .eq("block_id", blockId);

      // Insert new conditions
      if (conditions.length > 0) {
        const { data, error } = await supabase
          .from("email_block_conditions")
          .insert(conditions.map(c => ({ ...c, block_id: blockId })))
          .select();

        if (error) throw error;
        return data as unknown as BlockCondition[];
      }

      return [];
    },
    onSuccess: (_, { blockId }) => {
      queryClient.invalidateQueries({ queryKey: ["block-conditions", blockId] });
    },
  });
}

// =============================================
// VARIANTS (A/B Testing)
// =============================================

export function useTemplateVariants(templateId: string | undefined) {
  return useQuery({
    queryKey: ["template-variants", templateId],
    queryFn: async () => {
      if (!templateId) return [];

      const { data, error } = await supabase
        .from("email_template_variants")
        .select("*")
        .eq("template_id", templateId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as EmailTemplateVariant[];
    },
    enabled: !!templateId,
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (variant: { template_id: string; variant_name: string; subject: string; preheader?: string; weight_percent?: number; is_control?: boolean }) => {
      const { data, error } = await supabase
        .from("email_template_variants")
        .insert({
          template_id: variant.template_id,
          variant_name: variant.variant_name,
          subject: variant.subject,
          preheader: variant.preheader,
          weight_percent: variant.weight_percent ?? 50,
          is_control: variant.is_control ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as EmailTemplateVariant;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["template-variants", data.template_id] });
      toast({ title: "Variante criada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar variante", description: error.message, variant: "destructive" });
    },
  });
}

// =============================================
// TRANSLATIONS
// =============================================

export function useTemplateTranslations(templateId: string | undefined) {
  return useQuery({
    queryKey: ["template-translations", templateId],
    queryFn: async () => {
      if (!templateId) return [];

      const { data, error } = await supabase
        .from("email_template_translations")
        .select("*")
        .eq("template_id", templateId);

      if (error) throw error;
      return data as unknown as EmailTemplateTranslation[];
    },
    enabled: !!templateId,
  });
}

export function useSaveTranslation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (translation: { template_id: string; language_code: string; subject: string; preheader?: string; translated_blocks?: Record<string, any> }) => {
      const { data, error } = await supabase
        .from("email_template_translations")
        .upsert({
          template_id: translation.template_id,
          language_code: translation.language_code,
          subject: translation.subject,
          preheader: translation.preheader,
          translated_blocks: translation.translated_blocks as unknown as Json,
        }, { onConflict: 'template_id,language_code' })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as EmailTemplateTranslation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["template-translations", data.template_id] });
      toast({ title: "Tradução salva!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar tradução", description: error.message, variant: "destructive" });
    },
  });
}

// =============================================
// LAYOUTS
// =============================================

export function useEmailLayouts(category?: string) {
  return useQuery({
    queryKey: ["email-layouts", category],
    queryFn: async () => {
      let query = supabase
        .from("email_layout_library")
        .select("*")
        .eq("is_active", true)
        .order("usage_count", { ascending: false });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as EmailLayout[];
    },
  });
}

// =============================================
// VARIABLES
// =============================================

export function useEmailVariables(category?: string) {
  return useQuery({
    queryKey: ["email-variables", category],
    queryFn: async () => {
      let query = supabase
        .from("email_variable_definitions")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailVariable[];
    },
  });
}

// =============================================
// EMAIL SENDS & METRICS
// =============================================

export function useEmailSends(templateId: string | undefined, limit = 100) {
  return useQuery({
    queryKey: ["email-sends", templateId, limit],
    queryFn: async () => {
      if (!templateId) return [];

      const { data, error } = await supabase
        .from("email_sends")
        .select("*")
        .eq("template_id", templateId)
        .order("sent_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as unknown as EmailSend[];
    },
    enabled: !!templateId,
  });
}

export function useTemplateMetrics(templateId: string | undefined) {
  return useQuery({
    queryKey: ["template-metrics", templateId],
    queryFn: async () => {
      if (!templateId) return null;

      const { data, error } = await supabase
        .from("email_sends")
        .select("status")
        .eq("template_id", templateId);

      if (error) throw error;

      const metrics = {
        total_sent: data.length,
        delivered: data.filter(s => s.status === 'delivered' || s.status === 'opened' || s.status === 'clicked').length,
        opened: data.filter(s => s.status === 'opened' || s.status === 'clicked').length,
        clicked: data.filter(s => s.status === 'clicked').length,
        bounced: data.filter(s => s.status === 'bounced').length,
        spam: data.filter(s => s.status === 'spam').length,
        open_rate: 0,
        ctr: 0,
      };

      if (metrics.delivered > 0) {
        metrics.open_rate = Math.round((metrics.opened / metrics.delivered) * 100);
      }
      if (metrics.opened > 0) {
        metrics.ctr = Math.round((metrics.clicked / metrics.opened) * 100);
      }

      return metrics;
    },
    enabled: !!templateId,
  });
}
