import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VolumeResolutionData {
  date: string;
  opened: number;
  resolved: number;
}

export function useVolumeVsResolution(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ["volume-resolution", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      console.log("📊 useVolumeVsResolution: Fetching via consolidated RPC", { startDate, endDate });

      const { data, error } = await supabase.rpc("get_volume_resolution_consolidated", {
        p_start: startDate.toISOString(),
        p_end: endDate.toISOString(),
      });

      if (error) throw error;

      const result = (data || []).map((row: any) => ({
        date: row.date_bucket,
        opened: Number(row.opened),
        resolved: Number(row.resolved),
      }));

      console.log("✅ Volume data fetched:", result.length, "days (1 RPC)");
      return result;
    },
    staleTime: 1000 * 60 * 5,
  });
}
