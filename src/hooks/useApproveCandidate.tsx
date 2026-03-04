import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { KnowledgeCandidate } from "./useKnowledgeCandidates";

interface ApproveParams {
  candidateId: string;
  edits?: Partial<Pick<KnowledgeCandidate, 'problem' | 'solution' | 'when_to_use' | 'when_not_to_use' | 'category' | 'tags'>>;
  /** When true, bypasses PII/risk checks (used after explicit user confirmation) */
  forceApprove?: boolean;
}

export function useApproveCandidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ candidateId, edits, forceApprove }: ApproveParams) => {
      // 1. Fetch the candidate
      const { data: candidate, error: fetchError } = await supabase
        .from('knowledge_candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (fetchError || !candidate) {
        throw new Error('Candidato não encontrado');
      }

      // 🆕 UPGRADE: Bloqueio de aprovação para PII sem edição
      if (!forceApprove) {
        if ((candidate as any).contains_pii && !edits) {
          throw new Error('PII_REQUIRES_EDIT');
        }
        if ((candidate as any).risk_level === 'high' && !edits) {
          throw new Error('HIGH_RISK_REQUIRES_CONFIRMATION');
        }
      }

      // 2. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 3. Create article in knowledge_articles
      const { data: article, error: insertError } = await supabase
        .from('knowledge_articles')
        .insert({
          title: edits?.problem || candidate.problem,
          content: edits?.solution || candidate.solution,
          problem: edits?.problem || candidate.problem,
          solution: edits?.solution || candidate.solution,
          when_to_use: edits?.when_to_use || candidate.when_to_use,
          when_not_to_use: edits?.when_not_to_use || candidate.when_not_to_use,
          category: edits?.category || candidate.category || 'Aprendizado Passivo',
          tags: edits?.tags || candidate.tags || [],
          source: 'passive_learning',
          source_conversation_id: candidate.source_conversation_id,
          department_id: candidate.department_id,
          confidence_score: candidate.confidence_score,
          is_published: false,
          embedding_generated: false,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          version: 1,
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating knowledge article:', insertError);
        throw new Error('Erro ao criar artigo na base de conhecimento');
      }

      // 4. Update candidate status to approved
      const { error: updateError } = await supabase
        .from('knowledge_candidates')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', candidateId);

      if (updateError) {
        console.error('Error updating candidate status:', updateError);
        throw new Error('Erro ao atualizar status do candidato');
      }

      // 5. Generate embedding asynchronously and then publish
      supabase.functions.invoke('generate-article-embedding', {
        body: { articleId: article.id, publishAfterEmbedding: true }
      }).then(async (result) => {
        if (result.error) {
          console.warn('Embedding generation failed:', result.error);
          return;
        }
        await supabase
          .from('knowledge_articles')
          .update({ 
            is_published: true, 
            embedding_generated: true,
            published_at: new Date().toISOString()
          })
          .eq('id', article.id);
        console.log(`[useApproveCandidate] Article ${article.id} published after embedding`);
      }).catch(err => {
        console.warn('Embedding generation failed (non-blocking):', err);
      });

      return article;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-candidates-stats'] });
      toast({
        title: "✅ Conhecimento aprovado",
        description: "O artigo foi publicado na base de conhecimento.",
      });
    },
    onError: (error: Error) => {
      // Don't toast for special error codes - UI handles them
      if (error.message === 'PII_REQUIRES_EDIT' || error.message === 'HIGH_RISK_REQUIRES_CONFIRMATION') {
        return;
      }
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
