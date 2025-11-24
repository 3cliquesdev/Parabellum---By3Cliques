import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Deal = Tables<"deals">;
type DealInsert = TablesInsert<"deals">;
type DealUpdate = TablesUpdate<"deals">;

export function useDeals() {
  const { user } = useAuth();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["deals", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select("*, contacts(first_name, last_name), organizations(name), stages(name, position)");

      // Filtrar por assigned_to se for sales_rep
      if (role && (role as string) === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (deal: DealInsert) => {
      const { data, error } = await supabase
        .from("deals")
        .insert(deal)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast({
        title: "Negócio criado",
        description: "Negócio adicionado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar negócio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: DealUpdate }) => {
      const { data, error } = await supabase
        .from("deals")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar negócio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage_id }: { id: string; stage_id: string }) => {
      const { data, error } = await supabase
        .from("deals")
        .update({ stage_id })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, stage_id }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["deals"] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData(["deals"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["deals"], (old: any) => {
        if (!old) return old;
        return old.map((deal: any) =>
          deal.id === id ? { ...deal, stage_id } : deal
        );
      });

      return { previousDeals };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(["deals"], context.previousDeals);
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast({
        title: "Negócio excluído",
        description: "Negócio removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir negócio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
