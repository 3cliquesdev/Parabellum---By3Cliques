import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SalesChannel {
  id: string;
  name: string;
  slug: string;
  icon: string;
  requires_order_id: boolean;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export function useSalesChannels(onlyActive = true) {
  return useQuery({
    queryKey: ["sales-channels", onlyActive],
    queryFn: async () => {
      let query = supabase
        .from("sales_channels")
        .select("*")
        .order("name");

      if (onlyActive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SalesChannel[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSalesChannelsMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sales-channels"] });
  };

  const createChannel = useMutation({
    mutationFn: async (channel: { name: string; slug: string; icon: string; requires_order_id: boolean }) => {
      const { data, error } = await supabase
        .from("sales_channels")
        .insert(channel)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Canal criado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar canal", description: err.message, variant: "destructive" });
    },
  });

  const updateChannel = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SalesChannel> }) => {
      const { error } = await supabase.from("sales_channels").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Canal atualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteChannel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_channels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Canal removido" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    },
  });

  return { createChannel, updateChannel, deleteChannel };
}
