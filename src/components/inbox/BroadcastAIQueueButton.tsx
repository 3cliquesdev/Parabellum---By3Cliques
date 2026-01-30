import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BroadcastAIQueueDialog } from "./BroadcastAIQueueDialog";
import { BroadcastHistoryDialog } from "./BroadcastHistoryDialog";
import { Radio, History, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

interface BroadcastAIQueueButtonProps {
  queueCount: number;
  filter: string;
}

const ALLOWED_ROLES = ["admin", "manager", "general_manager"];

export function BroadcastAIQueueButton({ queueCount, filter }: BroadcastAIQueueButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hasActiveJob, setHasActiveJob] = useState(false);
  const { role } = useUserRole();

  // Check for active jobs
  useEffect(() => {
    const checkActiveJobs = async () => {
      try {
        const { data } = await supabase
          .from("broadcast_jobs")
          .select("id, status")
          .in("status", ["pending", "running"])
          .limit(1);

        setHasActiveJob((data?.length ?? 0) > 0);
      } catch (error) {
        console.error("[BroadcastAIQueueButton] Error checking active jobs:", error);
      }
    };

    checkActiveJobs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("broadcast-jobs-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "broadcast_jobs",
        },
        () => {
          checkActiveJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Only show button if:
  // 1. Filter is ai_queue
  // 2. There are conversations in the queue
  // 3. User has permission
  const canBroadcast =
    filter === "ai_queue" &&
    queueCount > 0 &&
    role &&
    ALLOWED_ROLES.includes(role);

  if (!canBroadcast) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2 text-xs"
        >
          {hasActiveJob ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radio className="h-3.5 w-3.5" />
          )}
          Broadcast ({queueCount})
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="text-xs px-2"
          title="Histórico de Broadcasts"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </div>

      <BroadcastAIQueueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        queueCount={queueCount}
      />

      <BroadcastHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}
