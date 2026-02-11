import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DispatchQueueStats {
  pendingJobs: number;
  escalatedJobs: number;
  avgWaitMinutes: number;
  criticalJobs: number; // waiting > 15 min
  availableAgents: number;
  successRate: number; // % last 24h
}

export function useDispatchQueue() {
  return useQuery({
    queryKey: ["dispatch-queue-stats"],
    queryFn: async (): Promise<DispatchQueueStats> => {
      const now = new Date();
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // Parallel queries for all metrics
      const [
        pendingRes,
        escalatedRes,
        pendingJobsWithTime,
        onlineAgentsRes,
        completedRes,
        totalJobsRes,
      ] = await Promise.all([
        // Pending count
        supabase
          .from("conversation_dispatch_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        // Escalated count
        supabase
          .from("conversation_dispatch_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "escalated"),
        // Pending jobs with created_at for wait time calc
        supabase
          .from("conversation_dispatch_jobs")
          .select("created_at")
          .eq("status", "pending"),
        // Online agents
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("availability_status", "online"),
        // Completed jobs last 24h (success)
        supabase
          .from("conversation_dispatch_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("updated_at", twentyFourHoursAgo),
        // Total jobs last 24h
        supabase
          .from("conversation_dispatch_jobs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", twentyFourHoursAgo),
      ]);

      // Calculate avg wait time and critical count
      let avgWaitMinutes = 0;
      let criticalJobs = 0;
      const pendingItems = pendingJobsWithTime.data || [];
      if (pendingItems.length > 0) {
        let totalWait = 0;
        for (const job of pendingItems) {
          const waitMs = now.getTime() - new Date(job.created_at).getTime();
          totalWait += waitMs;
          if (waitMs > 15 * 60 * 1000) criticalJobs++;
        }
        avgWaitMinutes = totalWait / pendingItems.length / 60000;
      }

      const completed = completedRes.count || 0;
      const total = totalJobsRes.count || 0;
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;

      return {
        pendingJobs: pendingRes.count || 0,
        escalatedJobs: escalatedRes.count || 0,
        avgWaitMinutes: Math.round(avgWaitMinutes * 10) / 10,
        criticalJobs,
        availableAgents: onlineAgentsRes.count || 0,
        successRate,
      };
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
