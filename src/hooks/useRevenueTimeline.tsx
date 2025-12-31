import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface RevenueTimelinePoint {
  date: string;
  label: string;
  current: number;
  previous: number;
}

const getPreviousPeriod = (range: DateRange): DateRange => {
  if (!range.from || !range.to) return { from: undefined, to: undefined };
  
  const duration = differenceInDays(range.to, range.from);
  return {
    from: subDays(range.from, duration + 1),
    to: subDays(range.from, 1)
  };
};

export function useRevenueTimeline(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ["revenue-timeline", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<RevenueTimelinePoint[]> => {
      if (!dateRange?.from || !dateRange?.to) {
        return [];
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();
      
      const previousPeriod = getPreviousPeriod(dateRange);
      const prevStartDate = previousPeriod.from ? startOfDay(previousPeriod.from).toISOString() : null;
      const prevEndDate = previousPeriod.to ? endOfDay(previousPeriod.to).toISOString() : null;

      const [{ data: currentDeals }, { data: prevDeals }] = await Promise.all([
        supabase
          .from("deals")
          .select("net_value, value, closed_at")
          .eq("status", "won")
          .gte("closed_at", startDate)
          .lte("closed_at", endDate),
        prevStartDate && prevEndDate
          ? supabase
              .from("deals")
              .select("net_value, value, closed_at")
              .eq("status", "won")
              .gte("closed_at", prevStartDate)
              .lte("closed_at", prevEndDate)
          : Promise.resolve({ data: [] })
      ]);

      const duration = differenceInDays(dateRange.to, dateRange.from);
      
      // Determine granularity based on date range
      let intervals: Date[];
      let formatStr: string;
      
      if (duration <= 14) {
        // Daily for up to 2 weeks
        intervals = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        formatStr = "dd/MM";
      } else if (duration <= 90) {
        // Weekly for up to 3 months
        intervals = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to });
        formatStr = "'Sem' w";
      } else {
        // Monthly for longer periods
        intervals = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
        formatStr = "MMM/yy";
      }

      // Group deals by interval
      const groupDealsByInterval = (deals: any[] | null, intervals: Date[], duration: number) => {
        const grouped = new Map<string, number>();
        
        intervals.forEach((date, index) => {
          const key = index.toString();
          grouped.set(key, 0);
        });

        (deals || []).forEach(deal => {
          const closedAt = new Date(deal.closed_at);
          const value = deal.net_value || deal.value || 0;
          
          for (let i = intervals.length - 1; i >= 0; i--) {
            if (closedAt >= intervals[i]) {
              const current = grouped.get(i.toString()) || 0;
              grouped.set(i.toString(), current + value);
              break;
            }
          }
        });

        return grouped;
      };

      const currentGrouped = groupDealsByInterval(currentDeals, intervals, duration);
      
      // For previous period, we need to align the intervals
      const prevIntervals = previousPeriod.from && previousPeriod.to
        ? duration <= 14
          ? eachDayOfInterval({ start: previousPeriod.from, end: previousPeriod.to })
          : duration <= 90
            ? eachWeekOfInterval({ start: previousPeriod.from, end: previousPeriod.to })
            : eachMonthOfInterval({ start: previousPeriod.from, end: previousPeriod.to })
        : [];
      
      const prevGrouped = groupDealsByInterval(prevDeals, prevIntervals, duration);

      return intervals.map((date, index) => ({
        date: date.toISOString(),
        label: format(date, formatStr, { locale: ptBR }),
        current: currentGrouped.get(index.toString()) || 0,
        previous: prevGrouped.get(index.toString()) || 0
      }));
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 1000 * 60 * 2
  });
}
