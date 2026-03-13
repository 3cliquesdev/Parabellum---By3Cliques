import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ActiveFlow {
  stateId: string;
  flowId: string;
  flowName: string;
  flowIsActive: boolean;
  currentNodeId: string;
  startedAt: string | null;
  status: string;
  completedAt: string | null;
}

export function useActiveFlowState(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);

  const queryKey = ["active-flow-state", conversationId];

  const { data: activeFlow = null, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ActiveFlow | null> => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from("chat_flow_states")
        .select("id, flow_id, current_node_id, started_at, status, chat_flows(name, is_active)")
        .eq("conversation_id", conversationId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[useActiveFlowState] query error:", error);
        return null;
      }

      if (!data) return null;

      const flow = data.chat_flows as any;
      return {
        stateId: data.id,
        flowId: data.flow_id,
        flowName: flow?.name || "Fluxo desconhecido",
        flowIsActive: flow?.is_active ?? true,
        currentNodeId: data.current_node_id,
        startedAt: data.started_at,
      };
    },
    enabled: !!conversationId,
    staleTime: 2_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`flow-state-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_flow_states",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const cancelFlow = useCallback(async (stateId: string) => {
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from("chat_flow_states")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", stateId);

      if (error) throw error;
      toast.success("Fluxo cancelado");
      queryClient.setQueryData(queryKey, null);
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      console.error("[useActiveFlowState] cancel error:", err);
      toast.error("Erro ao cancelar fluxo");
    } finally {
      setIsCancelling(false);
    }
  }, [queryClient]);

  return { activeFlow, isLoading, cancelFlow, isCancelling };
}
