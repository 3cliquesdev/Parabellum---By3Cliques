import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PlaybookProduct {
  id: string;
  playbook_id: string;
  product_id: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    external_id: string | null;
  };
}

export function usePlaybookProducts(playbookId: string | undefined) {
  return useQuery({
    queryKey: ["playbook-products", playbookId],
    queryFn: async () => {
      if (!playbookId) return [];
      
      const { data, error } = await supabase
        .from("playbook_products")
        .select(`
          id,
          playbook_id,
          product_id,
          created_at,
          product:products(id, name, external_id)
        `)
        .eq("playbook_id", playbookId);

      if (error) throw error;
      return data as PlaybookProduct[];
    },
    enabled: !!playbookId,
  });
}

export function useLinkPlaybookProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ playbookId, productIds }: { playbookId: string; productIds: string[] }) => {
      const records = productIds.map(productId => ({
        playbook_id: playbookId,
        product_id: productId,
      }));

      const { data, error } = await supabase
        .from("playbook_products")
        .upsert(records, { onConflict: "playbook_id,product_id" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-products", variables.playbookId] });
      toast({
        title: "Produtos vinculados",
        description: "Os produtos foram vinculados ao playbook com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao vincular produtos",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUnlinkPlaybookProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ playbookId, productId }: { playbookId: string; productId: string }) => {
      const { error } = await supabase
        .from("playbook_products")
        .delete()
        .eq("playbook_id", playbookId)
        .eq("product_id", productId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["playbook-products", variables.playbookId] });
      toast({
        title: "Produto desvinculado",
        description: "O produto foi removido do playbook",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao desvincular produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
