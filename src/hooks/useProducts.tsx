import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          delivery_groups(
            id,
            name
          ),
          onboarding_playbooks(
            id,
            name,
            is_active
          ),
          product_offers(
            id,
            offer_id,
            offer_name,
            price,
            is_active
          )
        `)
        .order("name", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: {
      name: string;
      description?: string;
      external_id?: string;
      delivery_group_id?: string | null;
      support_channel_id?: string | null;
      requires_account_manager: boolean;
      is_active: boolean;
      price?: number;
    }) => {
      // Verificar se já existe um produto com esse external_id
      if (product.external_id) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("external_id", product.external_id)
          .maybeSingle();

        if (existing) {
          // Produto já existe, apenas atualizar
          const { data, error } = await supabase
            .from("products")
            .update({
              name: product.name,
              description: product.description,
              delivery_group_id: product.delivery_group_id,
              support_channel_id: product.support_channel_id,
              requires_account_manager: product.requires_account_manager,
              is_active: product.is_active,
              price: product.price,
            })
            .eq("id", existing.id)
            .select()
            .single();

          if (error) throw error;
          return { ...data, wasUpdated: true };
        }
      }

      const { data, error } = await supabase
        .from("products")
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      return { ...data, wasUpdated: false };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: data.wasUpdated ? "Produto atualizado" : "Produto cadastrado",
        description: data.wasUpdated 
          ? "O produto já existia e foi atualizado."
          : "Produto cadastrado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{
        name: string;
        description: string;
        external_id: string;
        delivery_group_id: string | null;
        support_channel_id: string | null;
        requires_account_manager: boolean;
        is_active: boolean;
        price: number;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Produto atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteProduct() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Produto excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir produto",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
