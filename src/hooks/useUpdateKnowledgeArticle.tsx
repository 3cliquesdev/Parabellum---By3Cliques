import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UpdateArticleParams {
  id: string;
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
  product_tags?: string[];
  is_published?: boolean;
  problem?: string;
  solution?: string;
}

export function useUpdateKnowledgeArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...params }: UpdateArticleParams) => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .update(params)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      toast({
        title: "Artigo atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: Error) => {
      console.error("Error updating knowledge article:", error);
      toast({
        title: "Erro ao atualizar artigo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
