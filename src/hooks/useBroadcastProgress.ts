import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BroadcastJob {
  id: string;
  created_at: string;
  created_by: string | null;
  message: string;
  target_filter: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "cancelled" | "failed";
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{
    conversation_id: string;
    phone: string;
    status: "sent" | "failed" | "skipped";
    error?: string;
  }>;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  error_message: string | null;
}

interface UseBroadcastProgressOptions {
  jobId?: string | null;
  onComplete?: (job: BroadcastJob) => void;
  onError?: (error: Error) => void;
}

export function useBroadcastProgress({
  jobId,
  onComplete,
  onError,
}: UseBroadcastProgressOptions = {}) {
  const [job, setJob] = useState<BroadcastJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial job data
  const fetchJob = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("broadcast_jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Cast the results JSONB to proper type
      const typedJob: BroadcastJob = {
        ...data,
        target_filter: (data.target_filter as Record<string, unknown>) || {},
        results: (data.results as BroadcastJob["results"]) || [],
        status: data.status as BroadcastJob["status"],
      };
      
      setJob(typedJob);
      
      if (typedJob.status === "completed" || typedJob.status === "failed") {
        onComplete?.(typedJob);
      }
    } catch (error) {
      console.error("[useBroadcastProgress] Error fetching job:", error);
      onError?.(error instanceof Error ? error : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [onComplete, onError]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!jobId) return;

    fetchJob(jobId);

    const channel = supabase
      .channel(`broadcast-progress-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "broadcast_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log("[useBroadcastProgress] Realtime update:", payload);
          
          const newData = payload.new as any;
          const typedJob: BroadcastJob = {
            ...newData,
            target_filter: (newData.target_filter as Record<string, unknown>) || {},
            results: (newData.results as BroadcastJob["results"]) || [],
            status: newData.status as BroadcastJob["status"],
          };
          
          setJob(typedJob);

          if (typedJob.status === "completed" || typedJob.status === "failed") {
            onComplete?.(typedJob);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchJob, onComplete]);

  // Cancel job
  const cancelJob = useCallback(async () => {
    if (!jobId || !job) return;
    
    try {
      const { error } = await supabase
        .from("broadcast_jobs")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
      
      setJob((prev) => prev ? { ...prev, status: "cancelled" } : null);
    } catch (error) {
      console.error("[useBroadcastProgress] Error cancelling job:", error);
      onError?.(error instanceof Error ? error : new Error("Failed to cancel"));
    }
  }, [jobId, job, onError]);

  // Progress percentage
  const progressPercent = job?.total
    ? Math.round(((job.sent + job.failed + job.skipped) / job.total) * 100)
    : 0;

  return {
    job,
    isLoading,
    progressPercent,
    cancelJob,
    refetch: jobId ? () => fetchJob(jobId) : undefined,
  };
}

// Hook to fetch broadcast history
export function useBroadcastHistory(limit = 20) {
  const [jobs, setJobs] = useState<BroadcastJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("broadcast_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      const typedJobs: BroadcastJob[] = (data || []).map((job) => ({
        ...job,
        target_filter: (job.target_filter as Record<string, unknown>) || {},
        results: (job.results as BroadcastJob["results"]) || [],
        status: job.status as BroadcastJob["status"],
      }));

      setJobs(typedJobs);
    } catch (error) {
      console.error("[useBroadcastHistory] Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { jobs, isLoading, refetch: fetchHistory };
}
