import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProductBoardMapping {
  id: string;
  product_id: string;
  board_id: string;
  initial_column_id: string;
  form_filled_column_id: string | null;
  form_id: string | null;
  auto_assign_user_id: string | null;
  send_welcome_email: boolean;
  email_template_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  product?: { id: string; name: string } | null;
  board?: { id: string; name: string } | null;
  initial_column?: { id: string; name: string } | null;
  form_filled_column?: { id: string; name: string } | null;
  form?: { id: string; name: string } | null;
  auto_assign_user?: { id: string; full_name: string } | null;
  email_template?: { id: string; name: string } | null;
}

export interface ProductBoardMappingInput {
  product_id: string;
  board_id: string;
  initial_column_id: string;
  form_filled_column_id?: string | null;
  form_id?: string | null;
  auto_assign_user_id?: string | null;
  send_welcome_email?: boolean;
  email_template_id?: string | null;
  is_active?: boolean;
}

export function useProductBoardMappings() {
  return useQuery({
    queryKey: ["product-board-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_board_mappings")
        .select(`
          *,
          product:products(id, name),
          board:project_boards(id, name),
          initial_column:project_columns!product_board_mappings_initial_column_id_fkey(id, name),
          form_filled_column:project_columns!product_board_mappings_form_filled_column_id_fkey(id, name),
          form:forms(id, name),
          auto_assign_user:profiles!product_board_mappings_auto_assign_user_id_fkey(id, full_name),
          email_template:email_templates(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProductBoardMapping[];
    },
  });
}

export function useCreateProductBoardMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProductBoardMappingInput) => {
      const { data, error } = await supabase
        .from("product_board_mappings")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-board-mappings"] });
      toast.success("Mapeamento criado com sucesso");
    },
    onError: (error: Error) => {
      console.error("Error creating mapping:", error);
      toast.error("Erro ao criar mapeamento: " + error.message);
    },
  });
}

export function useUpdateProductBoardMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<ProductBoardMappingInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("product_board_mappings")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-board-mappings"] });
      toast.success("Mapeamento atualizado com sucesso");
    },
    onError: (error: Error) => {
      console.error("Error updating mapping:", error);
      toast.error("Erro ao atualizar mapeamento: " + error.message);
    },
  });
}

export function useDeleteProductBoardMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_board_mappings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-board-mappings"] });
      toast.success("Mapeamento excluído com sucesso");
    },
    onError: (error: Error) => {
      console.error("Error deleting mapping:", error);
      toast.error("Erro ao excluir mapeamento: " + error.message);
    },
  });
}
