import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  total_items: number | null;
  processed_items: number;
  contacts_created: number;
  updated_items: number;
  auth_users_created: number;
  deals_created: number;
  deals_updated: number;
  customers_churned?: number;
  tags_added?: number;
  errors: any;
  options: any;
  started_at: string | null;
  completed_at: string | null;
}

export function useSyncJob(jobId: string | null) {
  const [job, setJob] = useState<SyncJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    setIsLoading(true);

    // Buscar job inicial
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) {
        console.error("Erro ao buscar job:", error);
        toast({
          title: "Erro ao buscar status",
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setJob(data);
      setIsLoading(false);
    };

    fetchJob();

    // Subscrever a mudanças em tempo real
    const channel = supabase
      .channel(`sync-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sync_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log("Job atualizado:", payload.new);
          setJob(payload.new as SyncJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, toast]);

  return { job, isLoading };
}