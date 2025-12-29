import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BusinessHoliday {
  id: string;
  date: string;
  description: string;
  is_recurring: boolean;
  created_at: string;
}

export interface BusinessHolidayInput {
  date: string;
  description: string;
  is_recurring?: boolean;
}

export interface BusinessHoursConfig {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working_day: boolean;
  created_at: string;
  updated_at: string;
}

export function useBusinessHolidays() {
  return useQuery({
    queryKey: ['business-holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_holidays')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      return data as BusinessHoliday[];
    },
  });
}

export function useCreateBusinessHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BusinessHolidayInput) => {
      const { data, error } = await supabase
        .from('business_holidays')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-holidays'] });
      toast.success('Feriado adicionado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar feriado: ${error.message}`);
    },
  });
}

export function useDeleteBusinessHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('business_holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-holidays'] });
      toast.success('Feriado removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover feriado: ${error.message}`);
    },
  });
}

export function useBusinessHoursConfig() {
  return useQuery({
    queryKey: ['business-hours-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_hours_config')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      return data as BusinessHoursConfig[];
    },
  });
}

export function useUpdateBusinessHoursConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<BusinessHoursConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('business_hours_config')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours-config'] });
      toast.success('Horário comercial atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar horário: ${error.message}`);
    },
  });
}

// Função helper para obter nome do dia da semana
export function getDayName(dayOfWeek: number): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[dayOfWeek] || '';
}

// Função helper para formatar horário
export function formatTime(time: string): string {
  return time.slice(0, 5); // "09:00:00" -> "09:00"
}
