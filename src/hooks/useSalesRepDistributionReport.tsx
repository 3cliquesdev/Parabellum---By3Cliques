import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, startOfMonth, subDays } from "date-fns";
import { formatLocalDate, getStartOfDayString } from "@/lib/dateUtils";

export interface SalesRepDistribution {
  sales_rep_id: string;
  sales_rep_name: string;
  avatar_url: string | null;
  leads_received_today: number;
  leads_received_week: number;
  leads_received_month: number;
  open_deals: number;
  won_deals_month: number;
  conversion_rate: number;
  last_lead_at: string | null;
}

export interface DistributionLog {
  id: string;
  deal_id: string;
  deal_title: string | null;
  contact_name: string | null;
  assigned_to_name: string | null;
  assigned_by_name: string | null;
  distribution_type: string;
  previous_assigned_to_name: string | null;
  created_at: string;
  lead_source: string | null;
  deal_value: number | null;
}

export interface DistributionStats {
  total_leads_today: number;
  total_leads_week: number;
  total_leads_month: number;
  unassigned_deals: number;
  avg_leads_per_rep: number;
  total_sales_reps: number;
}

export function useSalesRepDistributionReport() {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);

  // Use consistent date formatting
  const todayStart = getStartOfDayString(today);
  const weekStartStr = getStartOfDayString(weekStart);
  const monthStartStr = getStartOfDayString(monthStart);

  // Fetch distribution by sales rep
  const { data: bySalesRep, isLoading: loadingReps } = useQuery({
    queryKey: ["sales-rep-distribution", formatLocalDate(today)],
    queryFn: async (): Promise<SalesRepDistribution[]> => {
      // Get sales reps only (not consultants)
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sales_rep");

      if (rolesError) throw rolesError;

      const userIds = [...new Set(userRoles?.map((r) => r.user_id) || [])];
      if (userIds.length === 0) return [];

      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Get distribution logs and deals for each rep
      const results: SalesRepDistribution[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Leads received today
          const { count: todayCount } = await supabase
            .from("lead_distribution_logs")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .gte("created_at", todayStart);

          // Leads received this week
          const { count: weekCount } = await supabase
            .from("lead_distribution_logs")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .gte("created_at", weekStartStr);

          // Leads received this month
          const { count: monthCount } = await supabase
            .from("lead_distribution_logs")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .gte("created_at", monthStartStr);

          // Open deals
          const { count: openDeals } = await supabase
            .from("deals")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .eq("status", "open");

          // Won deals this month
          const { count: wonDeals } = await supabase
            .from("deals")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .eq("status", "won")
            .gte("closed_at", monthStartStr);

          // Total closed deals this month (for conversion rate)
          const { count: closedDeals } = await supabase
            .from("deals")
            .select("*", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .in("status", ["won", "lost"])
            .gte("closed_at", monthStartStr);

          // Last lead received
          const { data: lastLead } = await supabase
            .from("lead_distribution_logs")
            .select("created_at")
            .eq("assigned_to", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const conversionRate =
            (closedDeals || 0) > 0
              ? Math.round(((wonDeals || 0) / (closedDeals || 1)) * 100)
              : 0;

          return {
            sales_rep_id: profile.id,
            sales_rep_name: profile.full_name || "Sem nome",
            avatar_url: profile.avatar_url,
            leads_received_today: todayCount || 0,
            leads_received_week: weekCount || 0,
            leads_received_month: monthCount || 0,
            open_deals: openDeals || 0,
            won_deals_month: wonDeals || 0,
            conversion_rate: conversionRate,
            last_lead_at: lastLead?.created_at || null,
          };
        })
      );

      // Sort by leads received this month (desc)
      return results.sort((a, b) => b.leads_received_month - a.leads_received_month);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch distribution history
  const sevenDaysAgo = subDays(today, 7);
  const sevenDaysAgoStr = getStartOfDayString(sevenDaysAgo);
  
  const { data: distributionHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["distribution-history", formatLocalDate(sevenDaysAgo)],
    queryFn: async (): Promise<DistributionLog[]> => {
      const { data: logs, error } = await supabase
        .from("lead_distribution_logs")
        .select(`
          id,
          deal_id,
          distribution_type,
          created_at,
          metadata,
          assigned_to,
          assigned_by,
          previous_assigned_to,
          contact_id
        `)
        .gte("created_at", sevenDaysAgoStr)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch related profiles
      const profileIds = new Set<string>();
      logs?.forEach((log) => {
        if (log.assigned_to) profileIds.add(log.assigned_to);
        if (log.assigned_by) profileIds.add(log.assigned_by);
        if (log.previous_assigned_to) profileIds.add(log.previous_assigned_to);
      });

      const contactIds = new Set<string>();
      logs?.forEach((log) => {
        if (log.contact_id) contactIds.add(log.contact_id);
      });

      const [profilesResult, contactsResult] = await Promise.all([
        profileIds.size > 0
          ? supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", Array.from(profileIds))
          : Promise.resolve({ data: [], error: null }),
        contactIds.size > 0
          ? supabase
              .from("contacts")
              .select("id, first_name, last_name")
              .in("id", Array.from(contactIds))
          : Promise.resolve({ data: [], error: null }),
      ]);

      const profileMap = new Map(
        (profilesResult.data || []).map((p) => [p.id, p.full_name])
      );
      const contactMap = new Map(
        (contactsResult.data || []).map((c) => [
          c.id,
          `${c.first_name} ${c.last_name}`.trim(),
        ])
      );

      return (logs || []).map((log) => {
        const metadata = log.metadata as Record<string, unknown> | null;
        return {
          id: log.id,
          deal_id: log.deal_id,
          deal_title: (metadata?.deal_title as string) || null,
          contact_name: log.contact_id ? contactMap.get(log.contact_id) || null : null,
          assigned_to_name: log.assigned_to
            ? profileMap.get(log.assigned_to) || null
            : null,
          assigned_by_name: log.assigned_by
            ? profileMap.get(log.assigned_by) || null
            : null,
          distribution_type: log.distribution_type,
          previous_assigned_to_name: log.previous_assigned_to
            ? profileMap.get(log.previous_assigned_to) || null
            : null,
          created_at: log.created_at,
          lead_source: (metadata?.lead_source as string) || null,
          deal_value: (metadata?.deal_value as number) || null,
        };
      });
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Calculate stats
  const stats: DistributionStats = {
    total_leads_today: bySalesRep?.reduce((sum, r) => sum + r.leads_received_today, 0) || 0,
    total_leads_week: bySalesRep?.reduce((sum, r) => sum + r.leads_received_week, 0) || 0,
    total_leads_month: bySalesRep?.reduce((sum, r) => sum + r.leads_received_month, 0) || 0,
    unassigned_deals: 0, // Will be calculated below
    avg_leads_per_rep:
      bySalesRep && bySalesRep.length > 0
        ? Math.round(
            bySalesRep.reduce((sum, r) => sum + r.leads_received_month, 0) /
              bySalesRep.length
          )
        : 0,
    total_sales_reps: bySalesRep?.length || 0,
  };

  // Fetch unassigned deals count
  const { data: unassignedCount } = useQuery({
    queryKey: ["unassigned-deals-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("deals")
        .select("*", { count: "exact", head: true })
        .is("assigned_to", null)
        .eq("status", "open");

      if (error) throw error;
      return count || 0;
    },
  });

  stats.unassigned_deals = unassignedCount || 0;

  return {
    bySalesRep: bySalesRep || [],
    distributionHistory: distributionHistory || [],
    stats,
    isLoading: loadingReps || loadingHistory,
  };
}
