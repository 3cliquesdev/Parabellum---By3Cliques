/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠️ LÓGICA TRAVADA - VALIDADA EM 20/01/2026 ⚠️
 * 
 * NÃO ALTERAR esta lógica de contagem sem:
 * 1. Comparar resultados com menu /subscriptions
 * 2. Validar com dados do dia 15/01/2026
 * 3. Aprovar com o usuário antes de aplicar
 * 
 * REGRA DEFINITIVA (aprovada pelo usuário):
 * - Deals Criados: created_at → 306 deals em 15/01/2026
 * - Deals Ganhos: closed_at → 240 deals em 15/01/2026
 * - Deals Perdidos: closed_at
 * - Deals Abertos: created_at (não têm fechamento)
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
      "deals-counts-v3",
      startDate ? formatLocalDate(startDate) : null,
      endDate ? formatLocalDate(endDate) : null,
    ],
    enabled: !!startDate && !!endDate,
    staleTime: 60 * 1000, // Cache de 60 segundos para performance
    gcTime: 5 * 60 * 1000, // Manter cache por 5 minutos mesmo após unmount
    refetchOnWindowFocus: false, // Não refetch ao focar (usa cache)
    refetchOnReconnect: true, // Refetch quando reconectar
    retry: 3, // Retry em caso de falha de rede
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff exponencial
    placeholderData: (previousData) => previousData, // Manter dados anteriores durante refetch
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
        console.error("❌ useDealsCounts [created] error:", createdError);
        throw createdError;
      }

      // Query 2: Contar deals GANHOS FECHADOS no período (por closed_at)
      // ⚠️ LÓGICA TRAVADA: Usar closed_at - aprovado pelo usuário em 20/01/2026
      // Baseline: 240 deals ganhos em 15/01/2026
      const { count: totalWon, error: wonError } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "won")
        .gte("closed_at", startDateTime)
        .lte("closed_at", endDateTime);

      if (wonError) {
        console.error("❌ useDealsCounts [won] error:", wonError, { startDateTime, endDateTime });
        throw wonError;
      }

      // Query 3: Contar deals PERDIDOS FECHADOS no período (por closed_at)
      // ⚠️ LÓGICA TRAVADA: Usar closed_at - mesma lógica de ganhos
      const { count: totalLost, error: lostError } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "lost")
        .gte("closed_at", startDateTime)
        .lte("closed_at", endDateTime);

      if (lostError) {
        console.error("❌ useDealsCounts [lost] error:", lostError, { startDateTime, endDateTime });
        throw lostError;
      }

      // Query 4: Contar deals ABERTOS criados no período
      const { count: totalOpen, error: openError } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .eq("status", "open")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      if (openError) {
        console.error("❌ useDealsCounts [open] error:", openError, { startDateTime, endDateTime });
        throw openError;
      }

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
