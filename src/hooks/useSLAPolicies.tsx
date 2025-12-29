import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SLAPolicy {
  id: string;
  category_id: string | null;
  priority: string | null;
  response_time_value: number;
  response_time_unit: 'hours' | 'business_hours' | 'business_days';
  resolution_time_value: number;
  resolution_time_unit: 'hours' | 'business_hours' | 'business_days';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: {
    id: string;
    name: string;
  };
}

export interface SLAPolicyInput {
  category_id: string | null;
  priority: string | null;
  response_time_value: number;
  response_time_unit: 'hours' | 'business_hours' | 'business_days';
  resolution_time_value: number;
  resolution_time_unit: 'hours' | 'business_hours' | 'business_days';
  is_active?: boolean;
}

export function useSLAPolicies() {
  return useQuery({
    queryKey: ['sla-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sla_policies')
        .select(`
          *,
          category:ticket_categories(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SLAPolicy[];
    },
  });
}

export function useCreateSLAPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SLAPolicyInput) => {
      const { data, error } = await supabase
        .from('sla_policies')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      toast.success('Política de SLA criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar política: ${error.message}`);
    },
  });
}

export function useUpdateSLAPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: SLAPolicyInput & { id: string }) => {
      const { data, error } = await supabase
        .from('sla_policies')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      toast.success('Política de SLA atualizada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar política: ${error.message}`);
    },
  });
}

export function useDeleteSLAPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sla_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
      toast.success('Política de SLA removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover política: ${error.message}`);
    },
  });
}

// Hook para buscar política de SLA baseado em categoria e prioridade
export function useSLAPolicyForTicket(categoryId: string | null, priority: string | null) {
  return useQuery({
    queryKey: ['sla-policy', categoryId, priority],
    queryFn: async () => {
      if (!categoryId) return null;

      // Primeiro tenta buscar política específica para categoria + prioridade
      let { data, error } = await supabase
        .from('sla_policies')
        .select('*')
        .eq('category_id', categoryId)
        .eq('priority', priority)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      // Se não encontrar, busca política padrão da categoria (priority = null)
      if (!data) {
        const { data: defaultPolicy, error: defaultError } = await supabase
          .from('sla_policies')
          .select('*')
          .eq('category_id', categoryId)
          .is('priority', null)
          .eq('is_active', true)
          .maybeSingle();

        if (defaultError) throw defaultError;
        data = defaultPolicy;
      }

      return data;
    },
    enabled: !!categoryId,
  });
}
