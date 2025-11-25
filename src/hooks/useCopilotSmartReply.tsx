import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type AISuggestion = Tables<"ai_suggestions">;

/**
 * Hook para buscar a sugestão de resposta mais recente não utilizada (modo Copilot)
 */
export function useLatestCopilotReply(conversationId: string | null) {
  return useQuery({
    queryKey: ["copilot-reply", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as AISuggestion | null;
    },
    enabled: !!conversationId,
  });
}

/**
 * Hook para gerar nova sugestão de resposta via Edge Function
 */
export function useGenerateCopilotReply() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      console.log('[useGenerateCopilotReply] Solicitando sugestão...');
      
      const { data, error } = await supabase.functions.invoke('generate-smart-reply', {
        body: { 
          conversationId,
          maxMessages: 10
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["copilot-reply", conversationId] });
      console.log('[useGenerateCopilotReply] ✅ Sugestão gerada e cache invalidado');
      
      toast({
        title: "💡 Sugestão de resposta gerada",
        description: "Revise e personalize antes de enviar",
      });
    },
    onError: (error: Error) => {
      console.error('[useGenerateCopilotReply] Erro:', error);
      toast({
        title: "Erro ao gerar sugestão",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para marcar sugestão como utilizada (quando humano clica em "Usar esta resposta")
 */
export function useMarkCopilotReplyAsUsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("ai_suggestions")
        .update({ used: true })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: (_, suggestionId) => {
      queryClient.invalidateQueries({ queryKey: ["copilot-reply"] });
      console.log('[useMarkCopilotReplyAsUsed] ✅ Sugestão marcada como usada:', suggestionId);
    },
  });
}
