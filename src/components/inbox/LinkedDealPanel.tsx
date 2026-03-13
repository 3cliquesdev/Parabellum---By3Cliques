import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Trophy, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LostReasonDialog from "@/components/LostReasonDialog";

interface LinkedDealPanelProps {
  dealId: string;
}

export function LinkedDealPanel({ dealId }: LinkedDealPanelProps) {
  const queryClient = useQueryClient();
  const [showLostDialog, setShowLostDialog] = useState(false);

  const { data: deal, isLoading } = useQuery({
    queryKey: ["linked-deal", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, value, currency, status, stage_id, pipeline_stages(name)")
        .eq("id", dealId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const wonMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("deals")
        .update({ status: "won", closed_at: new Date().toISOString() })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-deal", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Negócio marcado como ganho! 🎉");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const lostMutation = useMutation({
    mutationFn: async ({ reason, notes }: { reason: string; notes?: string }) => {
      const { error } = await supabase
        .from("deals")
        .update({
          status: "lost",
          lost_reason: reason,
          closed_at: new Date().toISOString(),
        })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-deal", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Negócio marcado como perdido");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  if (isLoading || !deal) return null;
  if (deal.status === "won" || deal.status === "lost") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/50 bg-muted/30">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">{deal.title}</span>
        <Badge variant={deal.status === "won" ? "success" : "destructive"} className="text-[10px] px-1.5 py-0 h-4">
          {deal.status === "won" ? "Ganho" : "Perdido"}
        </Badge>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: deal.currency || "BRL",
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/30">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate">{deal.title}</span>
        {deal.value != null && (
          <span className="text-xs font-semibold text-foreground tabular-nums shrink-0">
            {formatCurrency(deal.value)}
          </span>
        )}
        {(deal as any).pipeline_stages?.name && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
            {(deal as any).pipeline_stages.name}
          </Badge>
        )}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <Button
            variant="ghost"
            size="xs"
            className="h-6 px-2 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => wonMutation.mutate()}
            disabled={wonMutation.isPending || lostMutation.isPending}
          >
            {wonMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trophy className="h-3 w-3" />}
            <span className="text-[11px]">Ganho</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="h-6 px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowLostDialog(true)}
            disabled={wonMutation.isPending || lostMutation.isPending}
          >
            {lostMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            <span className="text-[11px]">Perdido</span>
          </Button>
        </div>
      </div>

      <LostReasonDialog
        open={showLostDialog}
        onClose={() => setShowLostDialog(false)}
        onConfirm={(reason, notes) => {
          lostMutation.mutate({ reason, notes });
          setShowLostDialog(false);
        }}
        dealTitle={deal.title}
      />
    </>
  );
}
