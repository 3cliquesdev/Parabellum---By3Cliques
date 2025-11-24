import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  goal_type: "individual" | "team" | "company";
  target_value: number;
  period_month: number;
  period_year: number;
  assigned_to: string | null;
  department: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: "active" | "completed" | "cancelled";
  assigned_user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export function useGoals(month?: number, year?: number) {
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["goals", month, year, role],
    queryFn: async () => {
      console.log("📊 useGoals: Fetching goals", { month, year, role });

      let query = supabase
        .from("sales_goals")
        .select("*, assigned_user:profiles!sales_goals_assigned_to_fkey(full_name, avatar_url)")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      // Filter by period if provided
      if (month) query = query.eq("period_month", month);
      if (year) query = query.eq("period_year", year);

      // Role-based filtering
      if (role === "sales_rep") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq("assigned_to", user.id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching goals:", error);
        throw error;
      }

      console.log(`✅ Fetched ${data?.length || 0} goals`);
      return data as Goal[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
