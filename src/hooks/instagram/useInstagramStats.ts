import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InstagramStats {
  newComments: number;
  unreadMessages: number;
  convertedDeals: number;
  convertedThisWeek: number;
  responseRate: number;
}

export const useInstagramStats = () => {
  return useQuery({
    queryKey: ["instagram-stats"],
    queryFn: async () => {
      // Get new comments count
      const { count: newCommentsCount } = await supabase
        .from("instagram_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");

      // Get unread messages count
      const { count: unreadMessagesCount } = await supabase
        .from("instagram_messages")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .eq("is_from_business", false);

      // Get converted deals this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: convertedDealsCount } = await supabase
        .from("instagram_comments")
        .select("*", { count: "exact", head: true })
        .eq("status", "converted")
        .gte("updated_at", oneWeekAgo.toISOString());

      // Calculate response rate
      const { count: totalComments } = await supabase
        .from("instagram_comments")
        .select("*", { count: "exact", head: true });

      const { count: repliedComments } = await supabase
        .from("instagram_comments")
        .select("*", { count: "exact", head: true })
        .eq("replied", true);

      const responseRate = totalComments && totalComments > 0
        ? Math.round(((repliedComments || 0) / totalComments) * 100)
        : 0;

      return {
        newComments: newCommentsCount || 0,
        unreadMessages: unreadMessagesCount || 0,
        convertedDeals: convertedDealsCount || 0,
        convertedThisWeek: convertedDealsCount || 0,
        responseRate,
      } as InstagramStats;
    },
  });
};
