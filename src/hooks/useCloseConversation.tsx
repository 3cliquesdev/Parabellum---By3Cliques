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
      // Update conversation status
      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          status: "closed",
          closed_by: userId,
          closed_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      if (updateError) throw updateError;

      // Send survey message if requested
      if (sendSurvey) {
        const { error: messageError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversationId,
            content: "Seu atendimento foi encerrado. Por favor, avalie nosso atendimento de 1 a 5 estrelas! ⭐",
            sender_type: "system",
          });

        if (messageError) throw messageError;
      }

      return { conversationId };
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
