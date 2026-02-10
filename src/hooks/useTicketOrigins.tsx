import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TicketOrigin {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export function useTicketOrigins() {
  return useQuery({
    queryKey: ["ticket-origins"],
    queryFn: async (): Promise<TicketOrigin[]> => {
      const { data, error } = await supabase
        .from("ticket_origins" as any)
        .select("*")
        .order("name");

      if (error) throw error;
      return (data as any) || [];
    },
  });
}

export function useCreateTicketOrigin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (op: { name: string; description?: string; color?: string }) => {
      const { data, error } = await supabase
        .from("ticket_origins" as any)
        .insert(op)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-origins"] });
      toast({ title: "Origem criada", description: "A nova origem foi adicionada." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar origem", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateTicketOrigin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...params }: { id: string; name?: string; description?: string; color?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("ticket_origins" as any)
        .update(params)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-origins"] });
      toast({ title: "Origem atualizada", description: "As alterações foram salvas." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar origem", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteTicketOrigin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ticket_origins" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-origins"] });
      toast({ title: "Origem deletada", description: "A origem foi removida." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao deletar origem", description: error.message, variant: "destructive" });
    },
  });
}
