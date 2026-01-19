import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { differenceInDays, subDays } from "date-fns";
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

export interface DashboardMetrics {
  revenueWon: number;
  revenuePrevious: number;
  revenueChange: number;
  weightedPipeline: number;
  pipelineTotal: number;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  conversionRate: number;
  conversionPrevious: number;
  conversionChange: number;
  avgSalesCycle: number;
  avgSalesCyclePrevious: number;
  salesCycleChange: number;
  newDealsCreated: number;
  newDealsPrevious: number;
  newDealsChange: number;
}

const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const getPreviousPeriod = (range: DateRange): DateRange => {
  if (!range.from || !range.to) return { from: undefined, to: undefined };
  
  const duration = differenceInDays(range.to, range.from);
  return {
    from: subDays(range.from, duration + 1),
    to: subDays(range.from, 1)
  };
};

export function useDashboardMetrics(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ["dashboard-metrics", dateRange?.from ? formatLocalDate(dateRange.from) : null, dateRange?.to ? formatLocalDate(dateRange.to) : null],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!dateRange?.from || !dateRange?.to) {
        return getEmptyMetrics();
      }

      const { startDateTime: startDate, endDateTime: endDate } = getDateTimeBoundaries(dateRange.from, dateRange.to);
      
      const previousPeriod = getPreviousPeriod(dateRange);
      const { startDateTime: prevStartDate, endDateTime: prevEndDate } = previousPeriod.from && previousPeriod.to 
        ? getDateTimeBoundaries(previousPeriod.from, previousPeriod.to)
        : { startDateTime: null, endDateTime: null };

      // Fetch current period data
      const [
        { data: wonDeals },
        { data: openDeals },
        { data: lostDeals },
        { data: newDeals },
        { data: prevWonDeals },
        { data: prevNewDeals },
        { data: prevLostDeals }
      ] = await Promise.all([
        // Won deals in current period
        supabase
          .from("deals")
          .select("id, value, net_value, created_at, closed_at, probability")
          .eq("status", "won")
          .gte("closed_at", startDate)
          .lte("closed_at", endDate),
        // Open deals (pipeline)
        supabase
          .from("deals")
          .select("id, value, net_value, probability")
          .eq("status", "open"),
        // Lost deals in current period
        supabase
          .from("deals")
          .select("id")
          .eq("status", "lost")
          .gte("closed_at", startDate)
          .lte("closed_at", endDate),
        // New deals created in current period
        supabase
          .from("deals")
          .select("id")
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        // Won deals in previous period
        prevStartDate && prevEndDate ? supabase
          .from("deals")
          .select("id, value, net_value, created_at, closed_at")
          .eq("status", "won")
          .gte("closed_at", prevStartDate)
          .lte("closed_at", prevEndDate) : Promise.resolve({ data: [] }),
        // New deals in previous period
        prevStartDate && prevEndDate ? supabase
          .from("deals")
          .select("id")
          .gte("created_at", prevStartDate)
          .lte("created_at", prevEndDate) : Promise.resolve({ data: [] }),
        // Lost deals in previous period
        prevStartDate && prevEndDate ? supabase
          .from("deals")
          .select("id")
          .eq("status", "lost")
          .gte("closed_at", prevStartDate)
          .lte("closed_at", prevEndDate) : Promise.resolve({ data: [] })
      ]);

      // Calculate current period metrics
      const revenueWon = (wonDeals || []).reduce((sum, d) => sum + (d.net_value || d.value || 0), 0);
      const pipelineTotal = (openDeals || []).reduce((sum, d) => sum + (d.value || 0), 0);
      const weightedPipeline = (openDeals || []).reduce((sum, d) => {
        const prob = (d.probability || 50) / 100;
        return sum + (d.value || 0) * prob;
      }, 0);
      
      const dealsOpen = openDeals?.length || 0;
      const dealsWon = wonDeals?.length || 0;
      const dealsLost = lostDeals?.length || 0;
      const newDealsCreated = newDeals?.length || 0;

      // Conversion rate
      const totalClosed = dealsWon + dealsLost;
      const conversionRate = totalClosed > 0 ? (dealsWon / totalClosed) * 100 : 0;

      // Average sales cycle (days from created to closed)
      const avgSalesCycle = dealsWon > 0
        ? (wonDeals || []).reduce((sum, d) => {
            if (d.created_at && d.closed_at) {
              return sum + differenceInDays(new Date(d.closed_at), new Date(d.created_at));
            }
            return sum;
          }, 0) / dealsWon
        : 0;

      // Calculate previous period metrics
      const revenuePrevious = (prevWonDeals || []).reduce((sum, d) => sum + (d.net_value || d.value || 0), 0);
      const prevDealsWon = prevWonDeals?.length || 0;
      const prevDealsLost = prevLostDeals?.length || 0;
      const prevTotalClosed = prevDealsWon + prevDealsLost;
      const conversionPrevious = prevTotalClosed > 0 ? (prevDealsWon / prevTotalClosed) * 100 : 0;
      const newDealsPrevious = prevNewDeals?.length || 0;

      const avgSalesCyclePrevious = prevDealsWon > 0
        ? (prevWonDeals || []).reduce((sum, d) => {
            if (d.created_at && d.closed_at) {
              return sum + differenceInDays(new Date(d.closed_at), new Date(d.created_at));
            }
            return sum;
          }, 0) / prevDealsWon
        : 0;

      return {
        revenueWon,
        revenuePrevious,
        revenueChange: calculatePercentChange(revenueWon, revenuePrevious),
        weightedPipeline,
        pipelineTotal,
        dealsOpen,
        dealsWon,
        dealsLost,
        conversionRate,
        conversionPrevious,
        conversionChange: calculatePercentChange(conversionRate, conversionPrevious),
        avgSalesCycle: Math.round(avgSalesCycle),
        avgSalesCyclePrevious: Math.round(avgSalesCyclePrevious),
        salesCycleChange: avgSalesCyclePrevious > 0 
          ? Math.round(avgSalesCycle - avgSalesCyclePrevious)
          : 0,
        newDealsCreated,
        newDealsPrevious,
        newDealsChange: calculatePercentChange(newDealsCreated, newDealsPrevious)
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 1000 * 60 * 2 // 2 minutes
  });
}

function getEmptyMetrics(): DashboardMetrics {
  return {
    revenueWon: 0,
    revenuePrevious: 0,
    revenueChange: 0,
    weightedPipeline: 0,
    pipelineTotal: 0,
    dealsOpen: 0,
    dealsWon: 0,
    dealsLost: 0,
    conversionRate: 0,
    conversionPrevious: 0,
    conversionChange: 0,
    avgSalesCycle: 0,
    avgSalesCyclePrevious: 0,
    salesCycleChange: 0,
    newDealsCreated: 0,
    newDealsPrevious: 0,
    newDealsChange: 0
  };
}
