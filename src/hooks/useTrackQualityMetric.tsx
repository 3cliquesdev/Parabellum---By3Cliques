import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type QualityEvent = 'suggestion_used' | 'conversation_closed' | 'kb_gap_created';

interface TrackMetricParams {
  conversationId: string;
  event: QualityEvent;
  data?: {
    resolutionTime?: number;
    csatRating?: number;
    classification?: string;
    suggestionsAvailable?: number;
  };
}

export function useTrackQualityMetric() {
  return useMutation({
    mutationFn: async ({ conversationId, event, data }: TrackMetricParams) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[useTrackQualityMetric] Usuário não autenticado');
        return;
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from('agent_quality_metrics')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('agent_id', user.id)
        .maybeSingle();

      // Build update data based on event type
      const baseData: Record<string, unknown> = {
        agent_id: user.id,
        conversation_id: conversationId,
      };

      if (event === 'suggestion_used') {
        baseData.suggestions_used = (existing?.suggestions_used || 0) + 1;
        baseData.copilot_active = true;
        if (data?.suggestionsAvailable) {
          baseData.suggestions_available = data.suggestionsAvailable;
        }
      } else if (event === 'conversation_closed') {
        if (data?.resolutionTime !== undefined) {
          baseData.resolution_time_seconds = data.resolutionTime;
        }
        if (data?.csatRating !== undefined) {
          baseData.csat_rating = data.csatRating;
        }
        if (data?.classification) {
          baseData.classification_label = data.classification;
        }
      } else if (event === 'kb_gap_created') {
        baseData.created_kb_gap = true;
      }

      // Upsert the record
      const { error } = await supabase
        .from('agent_quality_metrics')
        .upsert(baseData as {
          agent_id: string;
          conversation_id: string;
          suggestions_used?: number;
          suggestions_available?: number;
          resolution_time_seconds?: number;
          created_kb_gap?: boolean;
          copilot_active?: boolean;
          csat_rating?: number;
          classification_label?: string;
        }, { 
          onConflict: 'agent_id,conversation_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('[useTrackQualityMetric] Erro ao registrar métrica:', error);
        throw error;
      }

      console.log(`[useTrackQualityMetric] ✅ Evento ${event} registrado para conversa ${conversationId}`);
    },
    // Silent - no user feedback needed
    onError: (error) => {
      console.warn('[useTrackQualityMetric] Erro silenciado:', error);
    },
  });
}

// Hook for reading agent quality metrics
export function useAgentQualityMetrics(agentId?: string) {
  // Will be implemented in dashboard component
}
