/**
 * Hook para breakdown de leads por canal de atribuição
 * - Comercial: leads com assigned_to (vendedor atribuído)
 * - Automático: leads sem assigned_to (orgânico/automático)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

export interface LeadsBreakdown {
  comercial: number;
  automatico: number;
}

export function useLeadsBreakdown(startDate: Date | undefined, endDate: Date | undefined) {
  return useQuery({
    queryKey: [
      "leads-breakdown",
      startDate ? formatLocalDate(startDate) : null,
      endDate ? formatLocalDate(endDate) : null,
    ],
    enabled: !!startDate && !!endDate,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<LeadsBreakdown> => {
      if (!startDate || !endDate) {
        return { comercial: 0, automatico: 0 };
      }

      const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);

      // Query paralela para performance
      const [comercialResult, automaticoResult] = await Promise.all([
        // Leads COM vendedor atribuído
        supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .not("assigned_to", "is", null)
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime),
        
        // Leads SEM vendedor atribuído
        supabase
          .from("deals")
          .select("*", { count: "exact", head: true })
          .is("assigned_to", null)
          .gte("created_at", startDateTime)
          .lte("created_at", endDateTime),
      ]);

      if (comercialResult.error) {
        console.error("❌ useLeadsBreakdown [comercial] error:", comercialResult.error);
        throw comercialResult.error;
      }

      if (automaticoResult.error) {
        console.error("❌ useLeadsBreakdown [automatico] error:", automaticoResult.error);
        throw automaticoResult.error;
      }

      const breakdown = {
        comercial: comercialResult.count || 0,
        automatico: automaticoResult.count || 0,
      };

      console.log("📊 useLeadsBreakdown:", breakdown);

      return breakdown;
    },
  });
}
