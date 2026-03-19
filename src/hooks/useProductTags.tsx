import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductTag {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export function useProductTags() {
  return useQuery({
    queryKey: ["product-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_tags")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as ProductTag[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProductTagNames() {
  const { data: tags = [], ...rest } = useProductTags();
  return { data: tags.map((t) => t.name), ...rest };
}

export function useCreateProductTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      const { data, error } = await supabase
        .from("product_tags")
        .insert({ name: name.trim(), description: description || null })
        .select()
        .single();
      if (error) throw error;
      return data as ProductTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-tags"] });
      toast({ title: "Product tag criada" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar product tag",
        description: error.message.includes("duplicate") ? "Essa tag já existe." : error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteProductTag() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-tags"] });
      toast({ title: "Product tag removida" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });
}
