import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateRLHFFeedbackParams {
  personaId: string;
  messageContent: string;
  userMessage: string;
  feedbackType: "positive" | "negative";
  feedbackComment?: string;
  toolCalls?: any[];
}

export const useCreateRLHFFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateRLHFFeedbackParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("rlhf_feedback")
        .insert({
          persona_id: params.personaId,
          message_content: params.messageContent,
          user_message: params.userMessage,
          feedback_type: params.feedbackType,
          feedback_comment: params.feedbackComment || null,
          tool_calls: params.toolCalls || [],
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rlhf-metrics"] });
      toast.success("Feedback registrado com sucesso");
    },
    onError: (error) => {
      console.error("Error creating RLHF feedback:", error);
      toast.error("Erro ao registrar feedback");
    },
  });
};
