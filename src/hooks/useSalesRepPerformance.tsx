import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SalesRepPerformance {
  id: string;
  full_name: string;
  avatar_url: string | null;
  deals_count: number;
  pipeline_value: number;
  won_this_month: number;
  conversion_rate: number;
  last_activity: string | null;
}

export function useSalesRepPerformance() {
  return useQuery({
    queryKey: ["sales-rep-performance"],
    queryFn: async () => {
      console.log("🔍 useSalesRepPerformance: Fetching sales reps...");
      
      // Fetch sales_rep user IDs
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_rep");

      if (rolesError) {
        console.error("❌ Error fetching sales_rep roles:", rolesError);
        throw rolesError;
      }

      const salesRepIds = userRoles?.map(r => r.user_id) || [];
      console.log("✅ Found sales_rep IDs:", salesRepIds);

      if (salesRepIds.length === 0) {
        console.log("⚠️ No sales reps found");
        return [];
      }

      // Fetch sales rep profiles
      const { data: salesReps, error: salesRepsError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", salesRepIds);

      if (salesRepsError) {
        console.error("❌ Error fetching sales rep profiles:", salesRepsError);
        throw salesRepsError;
      }

      console.log("✅ Found sales rep profiles:", salesReps?.length);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // For each sales rep, calculate their metrics
      const performanceData: SalesRepPerformance[] = await Promise.all(
        (salesReps || []).map(async (salesRep) => {
          // Get their open deals
          const { data: openDeals, error: openDealsError } = await supabase
            .from("deals")
            .select("value")
            .eq("assigned_to", salesRep.id)
            .eq("status", "open");

          if (openDealsError) throw openDealsError;

          const deals_count = openDeals?.length || 0;
          const pipeline_value = openDeals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

          // Get deals won this month
          const { data: wonDeals, error: wonError } = await supabase
            .from("deals")
            .select("value")
            .eq("assigned_to", salesRep.id)
            .eq("status", "won")
            .gte("closed_at", startOfMonth.toISOString());

          if (wonError) throw wonError;

          const won_this_month = wonDeals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

          // Calculate conversion rate
          const { data: lostDeals, error: lostError } = await supabase
            .from("deals")
            .select("id")
            .eq("assigned_to", salesRep.id)
            .eq("status", "lost")
            .gte("closed_at", startOfMonth.toISOString());

          if (lostError) throw lostError;

          const wonCount = wonDeals?.length || 0;
          const lostCount = lostDeals?.length || 0;
          const totalClosed = wonCount + lostCount;
          const conversion_rate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;

          // Get last activity
          const { data: lastActivity } = await supabase
            .from("activities")
            .select("completed_at")
            .eq("assigned_to", salesRep.id)
            .eq("completed", true)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: salesRep.id,
            full_name: salesRep.full_name || "Sem nome",
            avatar_url: salesRep.avatar_url,
            deals_count,
            pipeline_value,
            won_this_month,
            conversion_rate,
            last_activity: lastActivity?.completed_at || null,
          };
        })
      );

      console.log("✅ Performance data calculated for", performanceData.length, "sales reps");

      // Sort by pipeline value descending
      return performanceData.sort((a, b) => b.pipeline_value - a.pipeline_value);
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnMount: true,
  });
}
