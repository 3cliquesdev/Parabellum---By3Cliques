import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAIQueue } from "./useAIQueue";

interface Message {
  content: string;
  sender_type: 'user' | 'contact';
}

export type Sentiment = 'critico' | 'neutro' | 'promotor';

// Normaliza valores similares para os 3 tipos válidos
const normalizeSentiment = (raw: string): Sentiment => {
  const normalized = raw.toLowerCase().trim();
  
  // Mapa de valores similares para crítico
  const negativeMatches = ['critico', 'crítico', 'negativo', 'irritado', 'raiva', 'frustrado', 'angry', 'negative'];
  // Mapa de valores similares para promotor
  const positiveMatches = ['promotor', 'positivo', 'satisfeito', 'feliz', 'happy', 'positive'];
  
  if (negativeMatches.includes(normalized)) return 'critico';
  if (positiveMatches.includes(normalized)) return 'promotor';
  return 'neutro'; // Default seguro
};

export function useSentimentAnalysis() {
  const { enqueue } = useAIQueue();

  return useMutation({
    mutationFn: async (messages: Message[]) => {
      // Enfileirar requisição para evitar rate limiting
      return enqueue(async () => {
        const { data, error } = await supabase.functions.invoke('analyze-ticket', {
          body: { mode: 'sentiment', messages }
        });

        if (error) {
          // Handle rate limiting gracefully
          if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
            // Retornar neutro como fallback ao invés de error
            console.warn('[Sentiment] Rate limited, returning neutral');
            return 'neutro' as Sentiment;
          }
          throw error;
        }
        
        const rawSentiment = data.result.toLowerCase().trim();
        const sentiment = normalizeSentiment(rawSentiment);
        console.log('[Sentiment] AI returned:', rawSentiment, '→ normalized to:', sentiment);
        return sentiment;
      });
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
