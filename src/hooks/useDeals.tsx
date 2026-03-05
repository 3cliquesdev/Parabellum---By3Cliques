import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { DEAL_SELECT } from "@/lib/select-fields";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { DateRange } from "react-day-picker";

type Deal = Tables<"deals">;
type DealInsert = TablesInsert<"deals">;
type DealUpdate = TablesUpdate<"deals">;

export type SortByOption = 
  | "created_at_desc" 
  | "value_desc" 
  | "value_asc" 
  | "probability_desc" 
  | "expected_close_asc";

export interface DealFilters {
  // Existing filters
  valueMin?: number;
  valueMax?: number;
  createdDateRange?: DateRange;
  expectedCloseDateRange?: DateRange;
  closedDateRange?: DateRange;  // NEW: filtra por closed_at (data de fechamento real)
  activityStatus?: string;
  leadSource: string[];
  assignedTo?: string[];
  search: string;
  
  // New advanced filters
  status?: string[];           // ['open', 'won', 'lost']
  stageIds?: string[];         // IDs of selected stages
  probabilityMin?: number;     // 0-100
  probabilityMax?: number;     // 0-100
  updatedDateRange?: DateRange;
  sortBy?: SortByOption;
}

export function useDeals(pipelineId?: string, filters?: DealFilters) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  return useQuery({
    queryKey: ["deals", pipelineId, filters, user?.id, role],
    queryFn: async ({ signal }) => {
      // Select mínimo centralizado + abortSignal para cancelamento
      let query = supabase
        .from("deals")
        .select(DEAL_SELECT);

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
        // Status filter: default to 'open' when no status selected (fixes kanban showing only recent stages)
        if (filters.status && filters.status.length > 0) {
          query = query.in("status", filters.status as ("open" | "won" | "lost")[]);
        }

        // Stage filter (NEW)
        if (filters.stageIds && filters.stageIds.length > 0) {
          query = query.in("stage_id", filters.stageIds);
        }

        // Value range
        if (filters.valueMin !== undefined) {
          query = query.gte("value", filters.valueMin);
        }
        if (filters.valueMax !== undefined) {
          query = query.lte("value", filters.valueMax);
        }

        // Probability range (NEW)
        if (filters.probabilityMin !== undefined) {
          query = query.gte("probability", filters.probabilityMin);
        }
        if (filters.probabilityMax !== undefined) {
          query = query.lte("probability", filters.probabilityMax);
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

        // Updated date range (NEW)
        if (filters.updatedDateRange?.from) {
          query = query.gte("updated_at", filters.updatedDateRange.from.toISOString());
        }
        if (filters.updatedDateRange?.to) {
          const endDate = new Date(filters.updatedDateRange.to);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte("updated_at", endDate.toISOString());
        }

        // Closed date range (para filtrar ganhos/perdidos por data de fechamento)
        if (filters.closedDateRange?.from) {
          query = query.gte("closed_at", filters.closedDateRange.from.toISOString());
        }
        if (filters.closedDateRange?.to) {
          const endDate = new Date(filters.closedDateRange.to);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte("closed_at", endDate.toISOString());
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

        // Sorting (NEW)
        const sortBy = filters.sortBy || "created_at_desc";
        switch (sortBy) {
          case "value_desc":
            query = query.order("value", { ascending: false, nullsFirst: false });
            break;
          case "value_asc":
            query = query.order("value", { ascending: true, nullsFirst: false });
            break;
          case "probability_desc":
            query = query.order("probability", { ascending: false, nullsFirst: false });
            break;
          case "expected_close_asc":
            query = query.order("expected_close_date", { ascending: true, nullsFirst: false });
            break;
          case "created_at_desc":
          default:
            query = query.order("created_at", { ascending: false });
            break;
        }
      } else {
        // No filters: default to open deals only + default ordering
        query = query.eq("status", "open");
        query = query.order("created_at", { ascending: false });
      }

      // Limite dinâmico: open deals precisam de limite maior (working set do kanban)
      const hasExplicitStatus = filters?.status && filters.status.length > 0;
      const hasDateFilter = filters?.createdDateRange?.from || 
                            filters?.closedDateRange?.from ||
                            filters?.expectedCloseDateRange?.from ||
                            filters?.updatedDateRange?.from;
      const limit = hasDateFilter ? 200 : (hasExplicitStatus ? 200 : 500);
      query = query.limit(limit);

      const { data, error } = await query.abortSignal(signal);
      if (error) throw error;
      return data;
    },
    enabled: !roleLoading,
    placeholderData: keepPreviousData,
    // Cache agressivo: 30s staleTime para reduzir queries ao banco
    staleTime: 30 * 1000,
    // Manter dados antigos por 5 min mesmo após navegação
    gcTime: 5 * 60 * 1000,
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
