import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type AISuggestion = Tables<"ai_suggestions">;

interface CopilotSuggestions {
  replies: AISuggestion[];
  kbGaps: AISuggestion[];
  classifications: AISuggestion[];
  all: AISuggestion[];
}

/**
 * Hook para buscar todas as sugestões Copilot por tipo
 */
export function useCopilotSuggestions(conversationId: string | null) {
  return useQuery({
    queryKey: ["copilot-suggestions", conversationId],
    queryFn: async (): Promise<CopilotSuggestions> => {
      if (!conversationId) {
        return { replies: [], kbGaps: [], classifications: [], all: [] };
      }

      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("used", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const suggestions = data || [];

      return {
        replies: suggestions.filter(s => s.suggestion_type === 'reply'),
        kbGaps: suggestions.filter(s => s.suggestion_type === 'kb_gap'),
        classifications: suggestions.filter(s => s.suggestion_type === 'classification'),
        all: suggestions
      };
    },
    enabled: !!conversationId,
    refetchInterval: 30000, // Refetch every 30 seconds for new suggestions
  });
}

/**
 * Hook para gerar novas sugestões Copilot via Edge Function
 */
export function useGenerateCopilotSuggestions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      console.log('[useGenerateCopilotSuggestions] Solicitando sugestões...');
      
      const { data, error } = await supabase.functions.invoke('generate-smart-reply', {
        body: { 
          conversationId,
          maxMessages: 15,
          includeKBSearch: true
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["copilot-suggestions", conversationId] });
      console.log('[useGenerateCopilotSuggestions] ✅ Sugestões geradas:', data?.suggestions_count);
      
      if (data?.suggestions_count > 0) {
        toast({
          title: "💡 Novas sugestões geradas",
          description: `${data.suggestions_count} sugestão(ões) disponível(is)`,
        });
      }
    },
    onError: (error: Error) => {
      console.error('[useGenerateCopilotSuggestions] Erro:', error);
      toast({
        title: "Erro ao gerar sugestões",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para marcar sugestão como utilizada
 */
export function useMarkSuggestionAsUsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("ai_suggestions")
        .update({ used: true })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["copilot-suggestions"] });
      console.log('[useMarkSuggestionAsUsed] ✅ Sugestão marcada como usada');
    },
  });
}

/**
 * Hook para buscar KB Gaps para dashboard de gestores
 */
export function useKBGapsDashboard(limit: number = 50) {
  return useQuery({
    queryKey: ["kb-gaps-dashboard", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select(`
          *,
          conversations:conversation_id (
            id,
            department,
            status,
            contact:contact_id (first_name, last_name)
          )
        `)
        .eq("suggestion_type", "kb_gap")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Hook para contar KB Gaps pendentes (para badges)
 */
export function useKBGapsCount() {
  return useQuery({
    queryKey: ["kb-gaps-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ai_suggestions")
        .select("*", { count: "exact", head: true })
        .eq("suggestion_type", "kb_gap")
        .eq("used", false);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
