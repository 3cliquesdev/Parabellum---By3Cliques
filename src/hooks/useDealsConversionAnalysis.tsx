import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { differenceInDays } from "date-fns";
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

export interface DealsConversionAnalysis {
  totalCreated: number;
  totalWon: number;
  totalLost: number;
  totalOpen: number;
  createdToWonRate: number;
  createdToLostRate: number;
  avgTimeToWinDays: number;
  medianTimeToWinDays: number;
  minTimeToWinDays: number;
  maxTimeToWinDays: number;
}

export type DealSource = "all" | "organic_new" | "organic_recurring" | "form" | "whatsapp";

export function useDealsConversionAnalysis(dateRange?: DateRange, source: DealSource = "all") {
  return useQuery({
    queryKey: [
      "deals-conversion-analysis",
      dateRange?.from ? formatLocalDate(dateRange.from) : "no-from",
      dateRange?.to ? formatLocalDate(dateRange.to) : "no-to",
      source,
    ],
    staleTime: 30 * 1000, // 30 seconds for more reactive updates
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<DealsConversionAnalysis> => {
      console.log("📊 useDealsConversionAnalysis: Fetching data...");

      // Build date filters using consistent boundaries
      const { startDateTime: fromDate, endDateTime: toDate } = dateRange?.from && dateRange?.to
        ? getDateTimeBoundaries(dateRange.from, dateRange.to)
        : { startDateTime: dateRange?.from ? `${formatLocalDate(dateRange.from)}T00:00:00` : null, endDateTime: dateRange?.to ? `${formatLocalDate(dateRange.to)}T23:59:59` : null };

      // Helper to apply source filter
      const applySourceFilter = (query: any) => {
        if (source === "organic_new") {
          // Vendas orgânicas de novos clientes (primeira compra)
          return query.eq("is_organic_sale", true).eq("is_returning_customer", false);
        } else if (source === "organic_recurring") {
          // Vendas orgânicas de clientes recorrentes (já compraram antes)
          return query.eq("is_organic_sale", true).eq("is_returning_customer", true);
        } else if (source === "form") {
          return query.eq("lead_source", "formulario");
        } else if (source === "whatsapp") {
          return query.eq("lead_source", "whatsapp");
        }
        return query;
      };

      // Use count: exact to get real counts without 1000 limit
      let createdQuery = applySourceFilter(
        supabase.from("deals").select("*", { count: "exact", head: true })
      );
      
      let wonQuery = applySourceFilter(
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "won")
      );
      
      let lostQuery = applySourceFilter(
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "lost")
      );
      
      let openQuery = applySourceFilter(
        supabase.from("deals").select("*", { count: "exact", head: true }).eq("status", "open")
      );

      // Apply date filters to all queries
      if (fromDate) {
        createdQuery = createdQuery.gte("created_at", fromDate);
        wonQuery = wonQuery.gte("created_at", fromDate);
        lostQuery = lostQuery.gte("created_at", fromDate);
        openQuery = openQuery.gte("created_at", fromDate);
      }
      if (toDate) {
        createdQuery = createdQuery.lte("created_at", toDate);
        wonQuery = wonQuery.lte("created_at", toDate);
        lostQuery = lostQuery.lte("created_at", toDate);
        openQuery = openQuery.lte("created_at", toDate);
      }

      // Execute all count queries in parallel
      const [createdResult, wonResult, lostResult, openResult] = await Promise.all([
        createdQuery,
        wonQuery,
        lostQuery,
        openQuery,
      ]);

      if (createdResult.error) {
        console.error("❌ useDealsConversionAnalysis error:", createdResult.error);
        throw createdResult.error;
      }

      const totalCreated = createdResult.count || 0;
      const totalWon = wonResult.count || 0;
      const totalLost = lostResult.count || 0;
      const totalOpen = openResult.count || 0;

      // Calculate conversion rates (created -> won/lost)
      const createdToWonRate = totalCreated > 0 ? (totalWon / totalCreated) * 100 : 0;
      const createdToLostRate = totalCreated > 0 ? (totalLost / totalCreated) * 100 : 0;

      // Fetch won deals with dates for time calculation (separate query)
      let wonDealsQuery = applySourceFilter(
        supabase
          .from("deals")
          .select("created_at, closed_at")
          .eq("status", "won")
          .not("closed_at", "is", null)
      );

      if (fromDate) {
        wonDealsQuery = wonDealsQuery.gte("created_at", fromDate);
      }
      if (toDate) {
        wonDealsQuery = wonDealsQuery.lte("created_at", toDate);
      }

      const { data: wonDeals } = await wonDealsQuery;

      // Calculate time to win for won deals
      const timeToWinDays: number[] = [];
      wonDeals?.forEach((deal) => {
        if (deal.closed_at && deal.created_at) {
          const days = differenceInDays(
            new Date(deal.closed_at),
            new Date(deal.created_at)
          );
          if (days >= 0) {
            timeToWinDays.push(days);
          }
        }
      });

      // Calculate statistics
      let avgTimeToWinDays = 0;
      let medianTimeToWinDays = 0;
      let minTimeToWinDays = 0;
      let maxTimeToWinDays = 0;

      if (timeToWinDays.length > 0) {
        // Average
        avgTimeToWinDays = Math.round(
          timeToWinDays.reduce((a, b) => a + b, 0) / timeToWinDays.length
        );

        // Sort for median, min, max
        const sorted = [...timeToWinDays].sort((a, b) => a - b);
        minTimeToWinDays = sorted[0];
        maxTimeToWinDays = sorted[sorted.length - 1];

        // Median
        const mid = Math.floor(sorted.length / 2);
        medianTimeToWinDays =
          sorted.length % 2 !== 0
            ? sorted[mid]
            : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      }

      console.log("✅ useDealsConversionAnalysis (count:exact):", {
        totalCreated,
        totalWon,
        totalLost,
        totalOpen,
        createdToWonRate: createdToWonRate.toFixed(1),
        avgTimeToWinDays,
      });

      return {
        totalCreated,
        totalWon,
        totalLost,
        totalOpen,
        createdToWonRate,
        createdToLostRate,
        avgTimeToWinDays,
        medianTimeToWinDays,
        minTimeToWinDays,
        maxTimeToWinDays,
      };
    },
  });
}
