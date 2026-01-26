import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useStrictRAGMode() {
  const queryClient = useQueryClient();

  const { data: isStrictMode, isLoading } = useQuery({
    queryKey: ['ai-strict-rag-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_strict_rag_mode')
        .maybeSingle();

      if (error) {
        console.error('[useStrictRAGMode] Error fetching config:', error);
        return false; // Fallback: desativado
      }

      return data?.value === 'true';
    },
    staleTime: 30000, // 30 segundos
  });

  const toggleStrictModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('system_configurations')
        .upsert({
          key: 'ai_strict_rag_mode',
          value: enabled ? 'true' : 'false',
          category: 'ai',
          description: 'Modo RAG Estrito - Usa exclusivamente OpenAI GPT-4o com thresholds altos de confiança',
        }, { onConflict: 'key' });

      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['ai-strict-rag-mode'] });
      toast.success(
        enabled 
          ? '🎯 Modo RAG Estrito ativado - GPT-4o exclusivo' 
          : '📊 Modo padrão restaurado'
      );
    },
    onError: (error) => {
      console.error('[useStrictRAGMode] Error toggling:', error);
      toast.error('Erro ao alterar modo RAG');
    },
  });

  return {
    isStrictMode: isStrictMode ?? false,
    isLoading,
    toggleStrictMode: toggleStrictModeMutation.mutate,
    isToggling: toggleStrictModeMutation.isPending,
  };
}
