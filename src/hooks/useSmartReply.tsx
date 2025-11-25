import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useSmartReply() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ description, subject }: { description: string; subject: string }) => {
      const { data, error } = await supabase.functions.invoke('analyze-ticket', {
        body: { 
          mode: 'reply', 
          description,
          ticketSubject: subject
        }
      });

      if (error) throw error;
      return data.result as string;
    },
    onSuccess: async (result) => {
      // Log AI usage
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('ai_usage_logs').insert({
          user_id: user.id,
          feature_type: 'reply',
          result_data: { reply_length: result.length }
        });
      }

      toast({
        title: "✨ Resposta gerada com sucesso",
        description: "Revise e personalize antes de enviar",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar resposta",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
