import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type QuoteItem = Tables<"quote_items">;
type QuoteItemInsert = Omit<QuoteItem, "id" | "created_at">;
type QuoteItemUpdate = Partial<Omit<QuoteItem, "id" | "created_at">>;

// Fetch all items for a quote
export const useQuoteItems = (quoteId?: string) => {
  return useQuery({
    queryKey: ["quote-items", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      
      const { data, error } = await supabase
        .from("quote_items")
        .select(`
          *,
          products:product_id(id, name, description, price)
        `)
        .eq("quote_id", quoteId)
        .order("position");

      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });
};

// Create quote item
export const useCreateQuoteItem = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: QuoteItemInsert) => {
      const { data, error } = await supabase
        .from("quote_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quote-items", data.quote_id] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Update quote item
export const useUpdateQuoteItem = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, quoteId, updates }: { id: string; quoteId: string; updates: QuoteItemUpdate }) => {
      const { data, error } = await supabase
        .from("quote_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["quote-items", variables.quoteId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

// Delete quote item
export const useDeleteQuoteItem = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, quoteId }: { id: string; quoteId: string }) => {
      const { error } = await supabase
        .from("quote_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { quoteId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["quote-items", data.quoteId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
