import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { DealFilters } from "./useDeals";
import type { Json } from "@/integrations/supabase/types";

export interface SavedDealFilter {
  id: string;
  user_id: string;
  name: string;
  filters: DealFilters;
  is_default: boolean;
  created_at: string;
}

// Helper to convert Json to DealFilters with defaults
function parseFilters(json: Json): DealFilters {
  const obj = json as Record<string, unknown>;
  return {
    search: (obj.search as string) || "",
    leadSource: (obj.leadSource as string[]) || [],
    assignedTo: obj.assignedTo as string[] | undefined,
    valueMin: obj.valueMin as number | undefined,
    valueMax: obj.valueMax as number | undefined,
    status: (obj.status as string[]) || [],
    stageIds: (obj.stageIds as string[]) || [],
    probabilityMin: obj.probabilityMin as number | undefined,
    probabilityMax: obj.probabilityMax as number | undefined,
    sortBy: (obj.sortBy as DealFilters["sortBy"]) || "created_at_desc",
  };
}

export function useSavedDealFilters() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["saved-deal-filters", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_deal_filters")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map raw data to typed SavedDealFilter
      return (data || []).map((item) => ({
        id: item.id,
        user_id: item.user_id,
        name: item.name,
        filters: parseFilters(item.filters),
        is_default: item.is_default,
        created_at: item.created_at,
      })) as SavedDealFilter[];
    },
    enabled: !!user,
  });
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: DealFilters }) => {
      const { data, error } = await supabase
        .from("saved_deal_filters")
        .insert({
          user_id: user!.id,
          name,
          filters: filters as any,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-deal-filters"] });
      toast({
        title: "Filtro salvo",
        description: "Seu filtro foi salvo com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar filtro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteSavedFilter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_deal_filters")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-deal-filters"] });
      toast({
        title: "Filtro excluído",
        description: "O filtro foi removido.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir filtro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
