import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GenerateDraftResponse {
  success: boolean;
  article: {
    id: string;
    title: string;
    content: string;
    source: string;
  };
}

export function useGenerateKBDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (gapId: string): Promise<GenerateDraftResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-kb-draft', {
        body: { gapId }
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar rascunho');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kb-gaps-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-articles'] });
      toast({
        title: "📝 Rascunho gerado",
        description: "O artigo foi criado como rascunho. Revise antes de publicar.",
      });
      
      // Navigate to edit the article with AI draft flag
      const params = new URLSearchParams({
        edit: data.article.id,
        ai_draft: 'true'
      });
      window.location.href = `/knowledge?${params.toString()}`;
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar rascunho",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
