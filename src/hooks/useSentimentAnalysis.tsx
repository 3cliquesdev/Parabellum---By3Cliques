import { useRef } from "react";
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

  // Track if last result was a fallback (skip logging)
  const lastWasFallbackRef = useRef(false);

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
            console.warn('[Sentiment] Rate limited, returning neutral (not logged)');
            lastWasFallbackRef.current = true;
            return 'neutro' as Sentiment;
          }
          throw error;
        }

        // Check if edge function returned a fallback
        if (data.fallback) {
          console.warn('[Sentiment] Fallback result, not logging:', data.reason);
          lastWasFallbackRef.current = true;
          return normalizeSentiment(data.result || 'neutro');
        }
        
        lastWasFallbackRef.current = false;
        const rawSentiment = data.result.toLowerCase().trim();
        const sentiment = normalizeSentiment(rawSentiment);
        console.log('[Sentiment] AI returned:', rawSentiment, '→ normalized to:', sentiment);
        return sentiment;
      });
    },
    onSuccess: async (sentiment) => {
      // Don't log fallback results — they pollute metrics with fake "neutro"
      if (lastWasFallbackRef.current) return;

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
