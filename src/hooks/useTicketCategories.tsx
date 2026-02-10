import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TicketCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  priority: string;
  is_active: boolean;
  created_at: string;
}

export function useTicketCategories() {
  return useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async (): Promise<TicketCategory[]> => {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateTicketCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (category: { name: string; description?: string; color?: string }) => {
      const { data, error } = await supabase
        .from("ticket_categories")
        .insert(category)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      toast({ title: "Categoria criada", description: "A nova categoria foi adicionada." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateTicketCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...params }: { id: string; name?: string; description?: string; color?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("ticket_categories")
        .update(params)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      toast({ title: "Categoria atualizada", description: "As alterações foram salvas." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteTicketCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ticket_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-categories"] });
      toast({ title: "Categoria deletada", description: "A categoria foi removida." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao deletar categoria", description: error.message, variant: "destructive" });
    },
  });
}
