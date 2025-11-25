import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AutoHandoffParams {
  conversationId: string;
  lastMessages: Array<{
    content: string;
    sender_type: 'customer' | 'agent' | 'system';
    created_at: string;
  }>;
}

export function useAutoHandoff() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ conversationId, lastMessages }: AutoHandoffParams) => {
      console.log('[useAutoHandoff] Verificando necessidade de handoff...');
      
      const { data, error } = await supabase.functions.invoke('auto-handoff', {
        body: { 
          conversationId,
          lastMessages
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === 'handoff_executed') {
        console.log('[useAutoHandoff] ✅ Handoff executado:', data.reason);
        
        const reasonMessages: Record<string, string> = {
          critical_sentiment: 'Cliente com sentimento crítico detectado - conversa transferida para atendimento humano',
          error_loop: 'IA não conseguiu resolver - conversa transferida para atendimento humano'
        };

        toast({
          title: "🤖 → 👤 Transbordo Automático",
          description: reasonMessages[data.reason] || 'Conversa transferida para modo assistido',
        });
      }
    },
    onError: (error: Error) => {
      console.error('[useAutoHandoff] Erro:', error);
      // Não mostrar toast de erro para não poluir UX, já que é processo automático em background
    },
  });
}
