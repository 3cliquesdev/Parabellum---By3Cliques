import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useGenerateEmbedding() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ articleId, content }: { articleId: string; content: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-article-embedding', {
        body: { article_id: articleId, content },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "✅ Embedding gerado",
        description: "Artigo indexado para busca semântica",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar embedding",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
