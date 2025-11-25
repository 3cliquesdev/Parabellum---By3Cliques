import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useDeleteKnowledgeArticle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (articleId: string) => {
      const { error } = await supabase
        .from("knowledge_articles")
        .delete()
        .eq("id", articleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      toast({
        title: "Artigo deletado",
        description: "O artigo foi removido da base de conhecimento.",
      });
    },
    onError: (error: Error) => {
      console.error("Error deleting knowledge article:", error);
      toast({
        title: "Erro ao deletar artigo",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
