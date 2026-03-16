import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateArticleParams {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  product_tags?: string[];
  is_published: boolean;
}

export function useCreateKnowledgeArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: CreateArticleParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase
        .from("knowledge_articles")
        .insert({
          title: params.title,
          content: params.content,
          category: params.category || null,
          tags: params.tags || [],
          product_tags: params.product_tags || [],
          is_published: params.is_published,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      toast({
        title: "Artigo criado",
        description: "O artigo foi adicionado à base de conhecimento.",
      });
    },
    onError: (error: Error) => {
      console.error("Error creating knowledge article:", error);
      toast({
        title: "Erro ao criar artigo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
