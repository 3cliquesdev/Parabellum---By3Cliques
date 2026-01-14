import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDealsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("deals-global-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
        },
        (payload) => {
          console.log("[Realtime] Deal changed:", payload.eventType, payload.new);
          
          // Invalidar queries principais
          queryClient.invalidateQueries({ queryKey: ["deals"] });
          queryClient.invalidateQueries({ queryKey: ["hot-deals"] });
          queryClient.invalidateQueries({ queryKey: ["pending-deals"] });
          queryClient.invalidateQueries({ queryKey: ["deals-prefetch"] });
          queryClient.invalidateQueries({ queryKey: ["unassigned-deals-count"] });
          
          // Invalidar queries com predicate pattern para cobrir todas as variações
          queryClient.invalidateQueries({
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && (
                key.startsWith("deals") ||
                key.startsWith("deal") ||
                key === "open-deals" ||
                key === "contact-deals" ||
                key === "sales-rep-deals" ||
                key === "sales-funnel" ||
                key === "sales-leaderboard" ||
                key === "monthly-won-deals" ||
                key === "conversion-stats" ||
                key === "conversion-metrics" ||
                key === "pipeline-value" ||
                key === "rotten-deals" ||
                key === "activities" ||
                key === "next-activity"
              );
            }
          });
          
          // Se houver deal_id específico, invalidar queries relacionadas
          const dealId = (payload.new as any)?.id || (payload.old as any)?.id;
          if (dealId) {
            queryClient.invalidateQueries({ queryKey: ["activities", undefined, dealId] });
            queryClient.invalidateQueries({ queryKey: ["next-activity", dealId] });
          }
          
          // Se houver contact_id, invalidar queries do contato
          const contactId = (payload.new as any)?.contact_id;
          if (contactId) {
            queryClient.invalidateQueries({ queryKey: ["open-deals", contactId] });
            queryClient.invalidateQueries({ queryKey: ["contact-deals", contactId] });
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Deals channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
