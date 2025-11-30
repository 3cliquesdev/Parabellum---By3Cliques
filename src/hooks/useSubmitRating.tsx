import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPublicChatClient } from "@/lib/publicSupabaseClient";
import { useToast } from "@/hooks/use-toast";

interface SubmitRatingParams {
  conversationId: string;
  rating: number;
  feedbackText: string | null;
  channel: "web_chat" | "whatsapp";
}

export function useSubmitRating() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const supabase = createPublicChatClient();

  return useMutation({
    mutationFn: async ({ conversationId, rating, feedbackText, channel }: SubmitRatingParams) => {
      const { data, error } = await supabase
        .from("conversation_ratings")
        .insert({
          conversation_id: conversationId,
          rating,
          feedback_text: feedbackText,
          channel,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation_ratings"] });
      toast({
        title: "Avaliação enviada com sucesso!",
        description: "Obrigado pelo seu feedback.",
      });
    },
    onError: (error: Error) => {
      console.error("[useSubmitRating] Error:", error);
      toast({
        title: "Erro ao enviar avaliação",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
