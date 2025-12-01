import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useKnowledgeStats = () => {
  return useQuery({
    queryKey: ["knowledge-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("id, embedding, category, created_at, updated_at");

      if (error) throw error;

      const articlesWithEmbedding = data.filter(
        (a) => a.embedding !== null && a.embedding !== ""
      ).length;
      
      const categories = [
        ...new Set(data.map((a) => a.category).filter(Boolean)),
      ];
      
      const lastUpdated = data.length > 0
        ? Math.max(...data.map((a) => new Date(a.updated_at || a.created_at).getTime()))
        : null;

      return {
        totalArticles: data.length,
        articlesWithEmbedding,
        totalCategories: categories.length,
        lastUpdated: lastUpdated ? new Date(lastUpdated) : null,
      };
    },
  });
};
