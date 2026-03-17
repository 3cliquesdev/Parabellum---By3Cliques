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
      const { data, error } = await supabase.functions.invoke("close-conversation", {
        body: {
          conversationId,
          userId,
          sendCsat: sendSurvey,
        },
      });

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
