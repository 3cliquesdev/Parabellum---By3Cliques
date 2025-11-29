import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOperationalUsers } from "./useOperationalUsers";
import { useUserRole } from "./useUserRole";

export interface TeamMemberProgress {
  id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  targetValue: number;
  currentValue: number;
  percentage: number;
  status: 'ahead' | 'on_track' | 'behind';
}

export interface TeamGoalProgress {
  teamTargetValue: number;
  teamCurrentValue: number;
  teamPercentage: number;
  members: TeamMemberProgress[];
}

export function useTeamGoalProgress(month: number, year: number) {
  const { user } = useAuth();
  const { data: operationalUsers } = useOperationalUsers();
  const { role } = useUserRole();

  return useQuery({
    queryKey: ["team-goal-progress", month, year, user?.id, role],
    queryFn: async () => {
      if (!user || !operationalUsers) {
        return null;
      }

      console.log("📊 useTeamGoalProgress: Calculating team goals", { month, year, role });

      // Determine team members based on manager role/department
      let teamMemberIds: string[] = operationalUsers.map(u => u.id);

      // For managers and CS managers, restrict to same department AND role
      if (role === "manager") {
        // Sales Manager → only see sales_rep
        const { data: managerProfile, error: managerProfileError } = await supabase
          .from("profiles")
          .select("id, department")
          .eq("id", user.id)
          .maybeSingle();

        if (managerProfileError) throw managerProfileError;

        const managerDepartment = managerProfile?.department;

        if (managerDepartment) {
          const { data: teamProfiles, error: teamProfilesError } = await supabase
            .from("profiles")
            .select("id, department")
            .in(
              "id",
              operationalUsers.map(u => u.id)
            );

          if (teamProfilesError) throw teamProfilesError;

          // Filter by department AND sales_rep role
          teamMemberIds = operationalUsers
            .filter((u) => {
              const profile = teamProfiles.find(p => p.id === u.id);
              return profile?.department === managerDepartment && u.role === "sales_rep";
            })
            .map((u) => u.id);
        }
      } else if (role === "cs_manager") {
        // CS Manager → only see consultant
        const { data: managerProfile, error: managerProfileError } = await supabase
          .from("profiles")
          .select("id, department")
          .eq("id", user.id)
          .maybeSingle();

        if (managerProfileError) throw managerProfileError;

        const managerDepartment = managerProfile?.department;

        if (managerDepartment) {
          const { data: teamProfiles, error: teamProfilesError } = await supabase
            .from("profiles")
            .select("id, department")
            .in(
              "id",
              operationalUsers.map(u => u.id)
            );

          if (teamProfilesError) throw teamProfilesError;

          // Filter by department AND consultant role
          teamMemberIds = operationalUsers
            .filter((u) => {
              const profile = teamProfiles.find(p => p.id === u.id);
              return profile?.department === managerDepartment && u.role === "consultant";
            })
            .map((u) => u.id);
        }
      }

      const teamMemberIdSet = new Set(teamMemberIds);

      // If manager has no team members, return empty progress
      if (teamMemberIds.length === 0) {
        return {
          teamTargetValue: 0,
          teamCurrentValue: 0,
          teamPercentage: 0,
          members: [],
        } as TeamGoalProgress;
      }

      // Fetch all sales goals for the period
      const { data: salesGoals, error: salesGoalsError } = await supabase
        .from("sales_goals")
        .select("*, assigned_user:profiles!sales_goals_assigned_to_fkey(full_name, avatar_url)")
        .eq("period_month", month)
        .eq("period_year", year)
        .eq("status", "active");

      if (salesGoalsError) throw salesGoalsError;

      // Fetch all CS goals for the period
      const formattedMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const { data: csGoals, error: csGoalsError } = await supabase
        .from("cs_goals")
        .select("*")
        .eq("month", formattedMonth);

      if (csGoalsError) throw csGoalsError;

      // Calculate team totals
      let teamTargetValue = 0;
      let teamCurrentValue = 0;
      const members: TeamMemberProgress[] = [];

      // Process sales goals only for team members
      for (const goal of salesGoals || []) {
        if (!teamMemberIdSet.has(goal.assigned_to)) continue;

        teamTargetValue += goal.target_value || 0;

        // Calculate current value (deals won in the period)
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

        const { data: deals, error: dealsError } = await supabase
          .from("deals")
          .select("value")
          .eq("assigned_to", goal.assigned_to)
          .eq("status", "won")
          .gte("closed_at", startDate)
          .lte("closed_at", endDate);

        if (dealsError) throw dealsError;

        const currentValue =
          deals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;
        teamCurrentValue += currentValue;

        const percentage =
          goal.target_value > 0 ? (currentValue / goal.target_value) * 100 : 0;

        let status: "ahead" | "on_track" | "behind" = "behind";
        if (percentage >= 100) status = "ahead";
        else if (percentage >= 75) status = "on_track";

        members.push({
          id: goal.assigned_to,
          name: goal.assigned_user?.full_name || "Usuário",
          avatar_url: goal.assigned_user?.avatar_url || null,
          role: "Vendedor",
          targetValue: goal.target_value,
          currentValue,
          percentage,
          status,
        });
      }

      // Process CS goals (GMV target) only for team members
      for (const goal of csGoals || []) {
        if (!teamMemberIdSet.has(goal.consultant_id)) continue;

        teamTargetValue += goal.target_gmv || 0;

        // Calculate current GMV (total LTV of consultant's active clients)
        const { data: contacts, error: contactsError } = await supabase
          .from("contacts")
          .select("total_ltv")
          .eq("consultant_id", goal.consultant_id)
          .eq("status", "customer");

        if (contactsError) throw contactsError;

        const currentValue =
          contacts?.reduce(
            (sum, contact) => sum + (contact.total_ltv || 0),
            0
          ) || 0;
        teamCurrentValue += currentValue;

        const percentage =
          goal.target_gmv > 0 ? (currentValue / goal.target_gmv) * 100 : 0;

        let status: "ahead" | "on_track" | "behind" = "behind";
        if (percentage >= 100) status = "ahead";
        else if (percentage >= 75) status = "on_track";

        // Get consultant profile from operationalUsers
        const consultant = operationalUsers.find(
          (u) => u.id === goal.consultant_id
        );

        members.push({
          id: goal.consultant_id,
          name: consultant?.full_name || "Consultor",
          avatar_url: consultant?.avatar_url || null,
          role: "Consultor CS",
          targetValue: goal.target_gmv,
          currentValue,
          percentage,
          status,
        });
      }

      const teamPercentage =
        teamTargetValue > 0 ? (teamCurrentValue / teamTargetValue) * 100 : 0;

      // Sort members by percentage descending (closest to goal first)
      members.sort((a, b) => b.percentage - a.percentage);

      console.log("✅ Team goal progress calculated:", {
        teamTargetValue,
        teamCurrentValue,
        teamPercentage,
        membersCount: members.length,
      });

      return {
        teamTargetValue,
        teamCurrentValue,
        teamPercentage,
        members,
      } as TeamGoalProgress;
    },
    enabled: !!user && !!operationalUsers,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
