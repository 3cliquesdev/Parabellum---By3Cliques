import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para buscar categorias distintas da base de conhecimento
 * Usado no PersonaDialog para multi-select de categorias permitidas
 */
export function useKnowledgeCategories() {
  return useQuery({
    queryKey: ["knowledge-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("category")
        .not("category", "is", null);

      if (error) {
        console.error("Error fetching knowledge categories:", error);
        throw error;
      }

      // Extrair categorias únicas e ordenar
      const categories = [...new Set(data.map(article => article.category))]
        .filter(Boolean)
        .sort();

      return categories as string[];
    },
  });
}
