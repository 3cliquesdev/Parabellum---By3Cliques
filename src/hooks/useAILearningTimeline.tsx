import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AILearningEvent {
  id: string;
  learned_at: string;
  learning_type: 'kb' | 'routing' | 'reply' | 'draft';
  summary: string;
  source_conversations: number;
  source_conversation_ids: string[] | null;
  confidence: 'alta' | 'média' | 'baixa';
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  related_article_id: string | null;
  department_id: string | null;
  metadata: Record<string, unknown>;
}

interface UseAILearningTimelineOptions {
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  type?: 'kb' | 'routing' | 'reply' | 'draft' | 'all';
  limit?: number;
}

export function useAILearningTimeline(options: UseAILearningTimelineOptions = {}) {
  const { status = 'all', type = 'all', limit = 50 } = options;
  const queryClient = useQueryClient();

  const { data: timeline, isLoading, error } = useQuery({
    queryKey: ['ai-learning-timeline', status, type, limit],
    queryFn: async () => {
      let query = supabase
        .from('ai_learning_timeline')
        .select('*')
        .order('learned_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (type !== 'all') {
        query = query.eq('learning_type', type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useAILearningTimeline] Error fetching:', error);
        throw error;
      }

      return data as AILearningEvent[];
    },
    staleTime: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ai_learning_timeline')
        .update({
          status: 'approved',
          reviewed_by: userData.user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (error) throw error;
      return eventId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-learning-timeline'] });
      toast.success('✅ Aprendizado aprovado');
    },
    onError: (error) => {
      console.error('[useAILearningTimeline] Error approving:', error);
      toast.error('Erro ao aprovar aprendizado');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ai_learning_timeline')
        .update({
          status: 'rejected',
          reviewed_by: userData.user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', eventId);

      if (error) throw error;
      return eventId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-learning-timeline'] });
      toast.success('❌ Aprendizado rejeitado');
    },
    onError: (error) => {
      console.error('[useAILearningTimeline] Error rejecting:', error);
      toast.error('Erro ao rejeitar aprendizado');
    },
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ['ai-learning-timeline-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_learning_timeline')
        .select('status');

      if (error) {
        console.error('[useAILearningTimeline] Error fetching stats:', error);
        return { pending: 0, approved: 0, rejected: 0, total: 0 };
      }

      const pending = data.filter(e => e.status === 'pending').length;
      const approved = data.filter(e => e.status === 'approved').length;
      const rejected = data.filter(e => e.status === 'rejected').length;

      return {
        pending,
        approved,
        rejected,
        total: data.length,
      };
    },
    staleTime: 30000,
  });

  return {
    timeline: timeline ?? [],
    stats: stats ?? { pending: 0, approved: 0, rejected: 0, total: 0 },
    isLoading,
    error,
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}

// Type labels for UI
export const LEARNING_TYPE_LABELS: Record<string, string> = {
  kb: 'Base de Conhecimento',
  routing: 'Roteamento',
  reply: 'Resposta',
  draft: 'Rascunho',
};

export const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  alta: { label: 'Alta', color: 'text-success' },
  média: { label: 'Média', color: 'text-warning' },
  baixa: { label: 'Baixa', color: 'text-destructive' },
};

export const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
};
