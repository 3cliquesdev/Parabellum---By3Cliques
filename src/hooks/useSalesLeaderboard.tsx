import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { formatLocalDate } from "@/lib/dateUtils";

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalSales: number;
  dealCount: number;
  conversionRate: number;
  hasRecentSale: boolean; // Streak indicator (sale in last 24h)
}

export function useSalesLeaderboard(month?: number, year?: number) {
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["sales-leaderboard", month, year],
    queryFn: async () => {
      console.log("📊 useSalesLeaderboard: Fetching leaderboard data");

      // Default to current month/year if not provided
      const now = new Date();
      const targetMonth = month ?? now.getMonth() + 1;
      const targetYear = year ?? now.getFullYear();

      // Use formatLocalDate for consistent date boundaries
      const startDateObj = new Date(targetYear, targetMonth - 1, 1);
      const endDateObj = new Date(targetYear, targetMonth, 0); // Last day of month
      
      const startDate = `${formatLocalDate(startDateObj)}T00:00:00`;
      const endDate = `${formatLocalDate(endDateObj)}T23:59:59`;

      console.log("📅 Period:", { startDate, endDate });

      // Fetch all deals for the period
      let query = supabase
        .from("deals")
        .select("*, assigned_user:profiles!deals_assigned_to_fkey(id, full_name, avatar_url)")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      // Role-based filtering
      if (role === "sales_rep") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq("assigned_to", user.id);
        }
      }

      const { data: deals, error } = await query;

      if (error) {
        console.error("❌ Error fetching deals:", error);
        throw error;
      }

      console.log(`✅ Fetched ${deals?.length || 0} deals`);

      // Group by user and calculate metrics
      const userMetrics = new Map<string, {
        fullName: string;
        avatarUrl: string | null;
        wonDeals: number;
        totalValue: number;
        totalDeals: number;
        lastSaleDate: string | null;
      }>();

      deals?.forEach((deal) => {
        const userId = deal.assigned_to;
        const userName = deal.assigned_user?.full_name || "Sem Vendedor";
        const userAvatar = deal.assigned_user?.avatar_url || null;

        if (!userId) return;

        const existing = userMetrics.get(userId) || {
          fullName: userName,
          avatarUrl: userAvatar,
          wonDeals: 0,
          totalValue: 0,
          totalDeals: 0,
          lastSaleDate: null,
        };

        existing.totalDeals++;

        if (deal.status === "won") {
          existing.wonDeals++;
          existing.totalValue += Number(deal.value || 0);
          
          // Track most recent sale date
          if (!existing.lastSaleDate || deal.closed_at > existing.lastSaleDate) {
            existing.lastSaleDate = deal.closed_at;
          }
        }

        userMetrics.set(userId, existing);
      });

      // Convert to leaderboard entries
      const leaderboard: LeaderboardEntry[] = Array.from(userMetrics.entries()).map(([userId, metrics]) => {
        const conversionRate = metrics.totalDeals > 0 
          ? (metrics.wonDeals / metrics.totalDeals) * 100 
          : 0;

        // Check if user has sale in last 24h (streak indicator)
        const hasRecentSale = metrics.lastSaleDate 
          ? (new Date().getTime() - new Date(metrics.lastSaleDate).getTime()) < 24 * 60 * 60 * 1000
          : false;

        return {
          userId,
          fullName: metrics.fullName,
          avatarUrl: metrics.avatarUrl,
          totalSales: metrics.totalValue,
          dealCount: metrics.wonDeals,
          conversionRate,
          hasRecentSale,
        };
      });

      // Sort by total sales (descending)
      const sortedLeaderboard = leaderboard.sort((a, b) => b.totalSales - a.totalSales);

      console.log("🏆 Leaderboard generated:", sortedLeaderboard);

      return sortedLeaderboard;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });
}
