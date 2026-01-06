import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TransferParams {
  fromUserId: string;
  toUserId: string;
  pipelineId?: string;
  keepHistory: boolean;
}

interface TransferPreview {
  count: number;
  totalValue: number;
}

export function useBulkTransferDeals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: TransferParams) => {
      const { fromUserId, toUserId, pipelineId, keepHistory } = params;

      // Build query to find deals to transfer
      let query = supabase
        .from("deals")
        .select("id, contact_id, title, value")
        .eq("assigned_to", fromUserId)
        .eq("status", "open");

      if (pipelineId) {
        query = query.eq("pipeline_id", pipelineId);
      }

      const { data: dealsToTransfer, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!dealsToTransfer || dealsToTransfer.length === 0) {
        throw new Error("Nenhum deal encontrado para transferir");
      }

      const dealIds = dealsToTransfer.map((d) => d.id);

      // Update all deals
      const { error: updateError } = await supabase
        .from("deals")
        .update({
          assigned_to: toUserId,
          updated_at: new Date().toISOString(),
        })
        .in("id", dealIds);

      if (updateError) throw updateError;

      // Log audit trail if keepHistory is enabled
      if (keepHistory) {
        const { data: toUser } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", toUserId)
          .single();

        const { data: fromUser } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", fromUserId)
          .single();

        const interactionsToInsert = dealsToTransfer
          .filter((d) => d.contact_id)
          .map((deal) => ({
            customer_id: deal.contact_id,
            type: "note" as const,
            content: `🔄 Carteira transferida de ${fromUser?.full_name || "Vendedor anterior"} para ${toUser?.full_name || "Novo vendedor"}`,
            channel: "other" as const,
            metadata: {
              deal_id: deal.id,
              deal_title: deal.title,
              portfolio_transfer: true,
              from_user_id: fromUserId,
              to_user_id: toUserId,
              transferred_at: new Date().toISOString(),
            },
          }));

        if (interactionsToInsert.length > 0) {
          await supabase.from("interactions").insert(interactionsToInsert);
        }
      }

      return { count: dealIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast({
        title: "Carteira transferida",
        description: `${result.count} deal${result.count > 1 ? "s" : ""} transferido${result.count > 1 ? "s" : ""} com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na transferência",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useTransferPreview() {
  const getPreview = async (
    fromUserId?: string,
    pipelineId?: string
  ): Promise<TransferPreview> => {
    if (!fromUserId) return { count: 0, totalValue: 0 };

    let query = supabase
      .from("deals")
      .select("id, value")
      .eq("assigned_to", fromUserId)
      .eq("status", "open");

    if (pipelineId) {
      query = query.eq("pipeline_id", pipelineId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const count = data?.length || 0;
    const totalValue = data?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

    return { count, totalValue };
  };

  return { getPreview };
}
