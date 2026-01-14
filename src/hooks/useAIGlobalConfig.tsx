import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAIGlobalConfig() {
  const queryClient = useQueryClient();

  const { data: isAIEnabled, isLoading } = useQuery({
    queryKey: ['ai-global-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_global_enabled')
        .maybeSingle();

      if (error) {
        console.error('[useAIGlobalConfig] Error fetching config:', error);
        return true; // Fallback: IA ligada
      }

      // Se não existir, assume true (IA ligada)
      return data?.value !== 'false';
    },
    staleTime: 30000, // 30 segundos
  });

  const toggleAIMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('system_configurations')
        .upsert({
          key: 'ai_global_enabled',
          value: enabled ? 'true' : 'false',
          category: 'ai',
          description: 'Toggle global para ligar/desligar a IA em todo o sistema',
        }, { onConflict: 'key' });

      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['ai-global-config'] });
      toast.success(
        enabled 
          ? '🤖 IA ativada globalmente' 
          : '⏸️ IA desativada globalmente'
      );
    },
    onError: (error) => {
      console.error('[useAIGlobalConfig] Error toggling:', error);
      toast.error('Erro ao alterar configuração da IA');
    },
  });

  return {
    isAIEnabled: isAIEnabled ?? true,
    isLoading,
    toggleAI: toggleAIMutation.mutate,
    isToggling: toggleAIMutation.isPending,
  };
}
