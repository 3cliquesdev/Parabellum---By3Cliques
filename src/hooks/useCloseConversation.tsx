import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CloseConversationParams {
  conversationId: string;
  userId: string;
  sendSurvey: boolean;
}

export function useCloseConversation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, userId, sendSurvey }: CloseConversationParams) => {
      const payload = {
        conversationId,
        userId,
        sendCsat: sendSurvey,
      };

      let result = await supabase.functions.invoke("close-conversation", {
        body: payload,
      });

      // Retry 1x após 2s em caso de erro transiente (503/timeout)
      if (result.error) {
        const errMsg = result.error?.message || String(result.error);
        const isTransient = errMsg.includes('Failed to send') || 
                            errMsg.includes('503') ||
                            errMsg.includes('EDGE_RUNTIME');
        if (isTransient) {
          console.warn('[closeConversation] ⚠️ Retry em 2s...');
          await new Promise(r => setTimeout(r, 2000));
          result = await supabase.functions.invoke("close-conversation", {
            body: payload,
          });
        }
      }

      const { data, error } = result;

      if (error) throw error;
      
      // Handle structured errors from edge function (e.g. missing tags)
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast({
        title: "Conversa encerrada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao encerrar conversa",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
