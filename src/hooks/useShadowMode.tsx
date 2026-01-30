import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useShadowMode() {
  const queryClient = useQueryClient();

  const { data: isShadowMode, isLoading } = useQuery({
    queryKey: ['ai-shadow-mode'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_configurations')
        .select('value')
        .eq('key', 'ai_shadow_mode')
        .maybeSingle();

      if (error) {
        console.error('[useShadowMode] Error fetching config:', error);
        return true; // Fallback: Shadow Mode ATIVO por padrão (segurança)
      }

      // Se não existir, assume true (segurança primeiro)
      return data?.value !== 'false';
    },
    staleTime: 30000, // 30 segundos
  });

  const toggleShadowModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('system_configurations')
        .upsert({
          key: 'ai_shadow_mode',
          value: enabled ? 'true' : 'false',
          category: 'ai',
          description: 'Shadow Mode: IA sugere mas não aplica automaticamente',
        }, { onConflict: 'key' });

      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['ai-shadow-mode'] });
      toast.success(
        enabled 
          ? '👁️ Shadow Mode ativado - IA apenas sugere' 
          : '⚡ Shadow Mode desativado - IA pode executar ações'
      );
    },
    onError: (error) => {
      console.error('[useShadowMode] Error toggling:', error);
      toast.error('Erro ao alterar Shadow Mode');
    },
  });

  return {
    isShadowMode: isShadowMode ?? true, // Padrão seguro
    isLoading,
    toggleShadowMode: toggleShadowModeMutation.mutate,
    isToggling: toggleShadowModeMutation.isPending,
  };
}
