import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ReturnReason {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function useReturnReasons(includeInactive = false) {
  return useQuery({
    queryKey: ["return-reasons", includeInactive],
    queryFn: async () => {
      let query = (supabase as any)
        .from("return_reasons")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReturnReason[];
    },
  });
}

/** Helper: converte array de reasons em mapa key→label */
export function useReasonLabelsMap() {
  const { data: reasons } = useReturnReasons();
  const map: Record<string, string> = {};
  reasons?.forEach((r) => { map[r.key] = r.label; });
  return map;
}

export function useCreateReturnReason() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { key: string; label: string; sort_order?: number }) => {
      const { error } = await (supabase as any).from("return_reasons").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["return-reasons"] });
      toast({ title: "✅ Motivo criado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar motivo", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateReturnReason() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; key?: string; label?: string; is_active?: boolean; sort_order?: number }) => {
      const { error } = await (supabase as any).from("return_reasons").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["return-reasons"] });
      toast({ title: "✅ Motivo atualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}
