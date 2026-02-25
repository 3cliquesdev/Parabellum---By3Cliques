import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { formatLocalDate, getDateTimeBoundaries } from "@/lib/dateUtils";

interface DailyCount {
  date: string;
  count: number;
}

export function useFormSubmissionsDaily(dateRange?: DateRange) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startDate = dateRange?.from || defaultStart;
  const endDate = dateRange?.to || now;

  const { startDateTime, endDateTime, startStr, endStr } = getDateTimeBoundaries(startDate, endDate);

  return useQuery({
    queryKey: ["form-submissions-daily", startStr, endStr],
    queryFn: async (): Promise<DailyCount[]> => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("id, created_at")
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime);

      if (error) throw error;

      // Group by day client-side
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        const day = row.created_at?.substring(0, 10) || "";
        if (day) counts[day] = (counts[day] || 0) + 1;
      });

      // Fill all days in range
      const result: DailyCount[] = [];
      const cursor = new Date(startDate);
      cursor.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      while (cursor <= end) {
        const key = formatLocalDate(cursor);
        result.push({
          date: `${String(cursor.getDate()).padStart(2, "0")}/${String(cursor.getMonth() + 1).padStart(2, "0")}`,
          count: counts[key] || 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      return result;
    },
    staleTime: 30000,
  });
}
