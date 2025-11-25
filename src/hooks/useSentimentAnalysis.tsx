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

      if (error) throw error;
      
      const sentiment = data.result.toLowerCase().trim() as Sentiment;
      return sentiment;
    },
  });
}
