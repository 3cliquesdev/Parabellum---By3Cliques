import { useQueries } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { DealsConversionAnalysis, DealSource } from "./useDealsConversionAnalysis";
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

export interface SourceAnalysis {
  source: DealSource;
  label: string;
  data: DealsConversionAnalysis | null;
  isLoading: boolean;
}

const sourceConfig: { source: Exclude<DealSource, "all">; label: string }[] = [
  { source: "organic_new", label: "1ª Compra Kiwify Orgânica" },
  { source: "organic_recurring", label: "Recorrente" },
  { source: "form", label: "Formulários" },
  { source: "whatsapp", label: "WhatsApp" },
];

async function fetchSourceData(
  dateRange: DateRange | undefined,
  source: Exclude<DealSource, "all">
): Promise<DealsConversionAnalysis> {
  const applySourceFilter = (query: any) => {
    switch (source) {
      case "organic_new":
        return query.eq("is_organic_sale", true).eq("is_returning_customer", false);
      case "organic_recurring":
        return query.eq("is_organic_sale", true).eq("is_returning_customer", true);
      case "form":
        return query.eq("lead_source", "formulario");
      case "whatsapp":
        return query.eq("lead_source", "whatsapp");
      default:
        return query;
    }
  };

  const applyDateFilter = (query: any) => {
    if (dateRange?.from && dateRange?.to) {
      const { startDateTime, endDateTime } = getDateTimeBoundaries(dateRange.from, dateRange.to);
      query = query.gte("created_at", startDateTime).lte("created_at", endDateTime);
    } else if (dateRange?.from) {
      const startDateTime = `${formatLocalDate(dateRange.from)}T00:00:00`;
      query = query.gte("created_at", startDateTime);
    } else if (dateRange?.to) {
      const endDateTime = `${formatLocalDate(dateRange.to)}T23:59:59`;
      query = query.lte("created_at", endDateTime);
    }
    return query;
  };

  // Fetch counts in parallel
  const [createdResult, wonResult, lostResult, openResult, wonDealsResult] = await Promise.all([
    applyDateFilter(applySourceFilter(supabase.from("deals").select("id", { count: "exact", head: true }))),
    applyDateFilter(applySourceFilter(supabase.from("deals").select("id", { count: "exact", head: true }).eq("status", "won"))),
    applyDateFilter(applySourceFilter(supabase.from("deals").select("id", { count: "exact", head: true }).eq("status", "lost"))),
    applyDateFilter(applySourceFilter(supabase.from("deals").select("id", { count: "exact", head: true }).eq("status", "open"))),
    applyDateFilter(applySourceFilter(supabase.from("deals").select("created_at, closed_at").eq("status", "won").not("closed_at", "is", null))),
  ]);

  const totalCreated = createdResult.count || 0;
  const totalWon = wonResult.count || 0;
  const totalLost = lostResult.count || 0;
  const totalOpen = openResult.count || 0;

  const createdToWonRate = totalCreated > 0 ? (totalWon / totalCreated) * 100 : 0;
  const createdToLostRate = totalCreated > 0 ? (totalLost / totalCreated) * 100 : 0;

  // Calculate time to win
  const wonDeals = wonDealsResult.data || [];
  const timesToWin = wonDeals
    .filter((d) => d.created_at && d.closed_at)
    .map((d) => {
      const created = new Date(d.created_at);
      const closed = new Date(d.closed_at);
      return Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    })
    .filter((days) => days >= 0);

  let avgTimeToWinDays = 0;
  let medianTimeToWinDays = 0;
  let minTimeToWinDays = 0;
  let maxTimeToWinDays = 0;

  if (timesToWin.length > 0) {
    avgTimeToWinDays = Math.round(timesToWin.reduce((a, b) => a + b, 0) / timesToWin.length);
    const sorted = [...timesToWin].sort((a, b) => a - b);
    medianTimeToWinDays = sorted[Math.floor(sorted.length / 2)];
    minTimeToWinDays = sorted[0];
    maxTimeToWinDays = sorted[sorted.length - 1];
  }

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
}

export function useAllSourcesConversionAnalysis(dateRange?: DateRange) {
  const queries = useQueries({
    queries: sourceConfig.map((config) => ({
      queryKey: ["deals-conversion", dateRange?.from ? formatLocalDate(dateRange.from) : null, dateRange?.to ? formatLocalDate(dateRange.to) : null, config.source],
      queryFn: () => fetchSourceData(dateRange, config.source),
      staleTime: 30 * 1000, // 30 seconds for more reactive updates
      refetchOnWindowFocus: true,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);

  const sources: SourceAnalysis[] = sourceConfig.map((config, index) => ({
    source: config.source,
    label: config.label,
    data: queries[index].data || null,
    isLoading: queries[index].isLoading,
  }));

  // Calculate totals
  const totals: DealsConversionAnalysis = sources.reduce(
    (acc, s) => {
      if (s.data) {
        acc.totalCreated += s.data.totalCreated;
        acc.totalWon += s.data.totalWon;
        acc.totalLost += s.data.totalLost;
        acc.totalOpen += s.data.totalOpen;
      }
      return acc;
    },
    {
      totalCreated: 0,
      totalWon: 0,
      totalLost: 0,
      totalOpen: 0,
      createdToWonRate: 0,
      createdToLostRate: 0,
      avgTimeToWinDays: 0,
      medianTimeToWinDays: 0,
      minTimeToWinDays: 0,
      maxTimeToWinDays: 0,
    }
  );

  totals.createdToWonRate = totals.totalCreated > 0 ? (totals.totalWon / totals.totalCreated) * 100 : 0;
  totals.createdToLostRate = totals.totalCreated > 0 ? (totals.totalLost / totals.totalCreated) * 100 : 0;

  return {
    sources,
    totals,
    isLoading,
    isFetching,
  };
}
