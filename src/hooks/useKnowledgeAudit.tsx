import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditArticle {
  id: string;
  title: string;
  category: string | null;
  product_tags: string[];
  tags: string[] | null;
  is_published: boolean;
  embedding_generated: boolean | null;
  status: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditIssue {
  type: "no_embedding" | "no_category" | "empty_product_tags" | "orphan_category";
  label: string;
  severity: "error" | "warning";
}

export function getArticleIssues(
  article: AuditArticle,
  validCategories: string[]
): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!article.embedding_generated) {
    issues.push({ type: "no_embedding", label: "Sem embedding", severity: "error" });
  }
  if (!article.category) {
    issues.push({ type: "no_category", label: "Sem categoria", severity: "warning" });
  }
  if (!article.product_tags || article.product_tags.length === 0) {
    issues.push({ type: "empty_product_tags", label: "Sem product_tags", severity: "warning" });
  }
  if (
    article.category &&
    validCategories.length > 0 &&
    !validCategories.includes(article.category)
  ) {
    issues.push({ type: "orphan_category", label: "Categoria órfã", severity: "error" });
  }

  return issues;
}

export function useKnowledgeAuditArticles() {
  return useQuery({
    queryKey: ["knowledge-audit-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_articles")
        .select("id, title, category, product_tags, tags, is_published, embedding_generated, status, source, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AuditArticle[];
    },
  });
}

export function useDistinctProductTags() {
  return useQuery({
    queryKey: ["product-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_tags")
        .select("name")
        .order("name");
      if (error) throw error;
      return (data || []).map((row: { name: string }) => row.name);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePersonaCategories() {
  return useQuery({
    queryKey: ["persona-categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_personas")
        .select("name, knowledge_base_paths");
      if (error) throw error;
      const cats = new Set<string>();
      (data || []).forEach((p: any) => {
        if (Array.isArray(p.knowledge_base_paths)) {
          p.knowledge_base_paths.forEach((c: string) => cats.add(c));
        }
      });
      return Array.from(cats).sort();
    },
    staleTime: 5 * 60 * 1000,
  });
}
