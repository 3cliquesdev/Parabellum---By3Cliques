import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  content: string;
  sender_type: 'user' | 'contact';
}

export type Sentiment = 'critico' | 'neutro' | 'promotor';

export function useSentimentAnalysis() {
  return useMutation({
    mutationFn: async (messages: Message[]) => {
      const { data, error } = await supabase.functions.invoke('analyze-ticket', {
        body: { mode: 'sentiment', messages }
      });

      if (error) {
        // Handle rate limiting gracefully
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          throw new Error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
        }
        throw error;
      }
      
      const sentiment = data.result.toLowerCase().trim() as Sentiment;
      return sentiment;
    },
    onSuccess: async (sentiment) => {
      // Log AI usage
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('ai_usage_logs').insert({
          user_id: user.id,
          feature_type: 'sentiment',
          result_data: { sentiment }
        });
      }
    },
  });
}
