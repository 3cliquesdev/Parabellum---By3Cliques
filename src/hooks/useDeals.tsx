import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { DateRange } from "react-day-picker";

type Deal = Tables<"deals">;
type DealInsert = TablesInsert<"deals">;
type DealUpdate = TablesUpdate<"deals">;

export interface DealFilters {
  valueMin?: number;
  valueMax?: number;
  createdDateRange?: DateRange;
  expectedCloseDateRange?: DateRange;
  activityStatus?: string;
  leadSource: string[];
  assignedTo?: string[];
  search: string;
}

export function useDeals(pipelineId?: string, filters?: DealFilters) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["deals", pipelineId, filters, user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("deals")
        .select(
          `
          *,
          contacts (id, first_name, last_name, email, phone, company),
          organizations (name),
          assigned_user:profiles!deals_assigned_to_fkey (id, full_name, avatar_url)
        `
        )
        .order("created_at", { ascending: false });

      // Filter by pipeline
      if (pipelineId) {
        query = query.eq("pipeline_id", pipelineId);
      }

      // Filter by user if sales_rep (RLS also enforces this)
      if (role === "sales_rep" && user) {
        query = query.eq("assigned_to", user.id);
      }

      // Advanced filters
      if (filters) {
        // Value range
        if (filters.valueMin !== undefined) {
          query = query.gte("value", filters.valueMin);
        }
        if (filters.valueMax !== undefined) {
          query = query.lte("value", filters.valueMax);
        }

        // Created date range
        if (filters.createdDateRange?.from) {
          query = query.gte("created_at", filters.createdDateRange.from.toISOString());
        }
        if (filters.createdDateRange?.to) {
          const endDate = new Date(filters.createdDateRange.to);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte("created_at", endDate.toISOString());
        }

        // Expected close date range
        if (filters.expectedCloseDateRange?.from) {
          query = query.gte("expected_close_date", filters.expectedCloseDateRange.from.toISOString().split('T')[0]);
        }
        if (filters.expectedCloseDateRange?.to) {
          query = query.lte("expected_close_date", filters.expectedCloseDateRange.to.toISOString().split('T')[0]);
        }

        // Lead source (multi-select)
        if (filters.leadSource.length > 0) {
          query = query.in("lead_source", filters.leadSource);
        }

        // Assigned to (for managers filtering) - multi-select
        if (filters.assignedTo && filters.assignedTo.length > 0) {
          query = query.in("assigned_to", filters.assignedTo);
        }

        // Search by title
        if (filters.search) {
          query = query.ilike("title", `%${filters.search}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !roleLoading,
    placeholderData: keepPreviousData,
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
