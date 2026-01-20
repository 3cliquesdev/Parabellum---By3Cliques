/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠️ LÓGICA TRAVADA - VALIDADA EM 20/01/2026 ⚠️
 * 
 * NÃO ALTERAR esta lógica de contagem sem:
 * 1. Comparar resultados com menu /subscriptions
 * 2. Validar com dados do dia 15/01/2026 (306 deals criados)
 * 3. Aprovar com o usuário antes de aplicar
 * 
 * Última validação: 306 deals criados em 15/01/2026
 * ════════════════════════════════════════════════════════════════════════════
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

export interface DealsCounts {
  totalCreated: number;
  totalWon: number;
  totalLost: number;
  totalOpen: number;
  createdToWonRate: number;
  createdToLostRate: number;
}

export function useDealsCounts(startDate: Date | undefined, endDate: Date | undefined) {
  return useQuery({
    queryKey: [
      "deals-counts-v2",
      startDate ? formatLocalDate(startDate) : null,
      endDate ? formatLocalDate(endDate) : null,
    ],
    enabled: !!startDate && !!endDate,
    staleTime: 60 * 1000, // Cache de 60 segundos para performance
    refetchOnWindowFocus: false, // Não refetch ao focar (usa cache)
    queryFn: async (): Promise<DealsCounts> => {
      if (!startDate || !endDate) {
        return {
          totalCreated: 0,
          totalWon: 0,
          totalLost: 0,
          totalOpen: 0,
          createdToWonRate: 0,
          createdToLostRate: 0,
        };
      }

      const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);

      console.log("📊 useDealsCounts: Query única para período", { startDateTime, endDateTime });

      // Query 1: Contar TODOS os deals criados no período (mais confiável)
      const { count: totalCreated, error: createdError } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      if (createdError) {
        console.error("❌ useDealsCounts error:", createdError);
        throw createdError;
      }

      // Query 2: Contar deals GANHOS criados no período (não por closed_at)
      // ⚠️ LÓGICA TRAVADA: Usar created_at para consistência com totalCreated
      const { count: totalWon } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "won")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      // Query 3: Contar deals PERDIDOS criados no período (não por closed_at)
      // ⚠️ LÓGICA TRAVADA: Usar created_at para consistência com totalCreated
      const { count: totalLost } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "lost")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      // Query 4: Contar deals ABERTOS criados no período
      const { count: totalOpen } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      const created = totalCreated || 0;
      const won = totalWon || 0;
      const lost = totalLost || 0;
      const open = totalOpen || 0;

      const createdToWonRate = created > 0 ? (won / created) * 100 : 0;
      const createdToLostRate = created > 0 ? (lost / created) * 100 : 0;

      console.log("✅ useDealsCounts resultado:", {
        totalCreated: created,
        totalWon: won,
        totalLost: lost,
        totalOpen: open,
        createdToWonRate: createdToWonRate.toFixed(1) + "%",
      });

      return {
        totalCreated: created,
        totalWon: won,
        totalLost: lost,
        totalOpen: open,
        createdToWonRate,
        createdToLostRate,
      };
    },
  });
}
