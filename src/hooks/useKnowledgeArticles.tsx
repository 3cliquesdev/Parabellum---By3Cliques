import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseKnowledgeArticlesParams {
  searchQuery?: string;
  category?: string;
}

export function useKnowledgeArticles({ searchQuery, category }: UseKnowledgeArticlesParams = {}) {
  return useQuery({
    queryKey: ["knowledge-articles", searchQuery, category],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_articles")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by search query (title or content)
      if (searchQuery && searchQuery.trim() !== "") {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      // Filter by category
      if (category && category !== "all") {
        query = query.eq("category", category);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching knowledge articles:", error);
        throw error;
      }

      return data || [];
    },
  });
}
