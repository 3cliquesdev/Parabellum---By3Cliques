import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";
import { useStages } from "@/hooks/useStages";
import { useMoveDealToPipeline } from "@/hooks/useMoveDealToPipeline";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals"> & {
  contacts?: { first_name: string; last_name: string } | null;
  organizations?: { name: string } | null;
};

interface MoveToPipelineDialogProps {
  deal: Deal;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

export default function MoveToPipelineDialog({ deal, trigger, onSuccess }: MoveToPipelineDialogProps) {
  const [open, setOpen] = useState(false);
  const [targetPipelineId, setTargetPipelineId] = useState<string>("");
  const [targetStageId, setTargetStageId] = useState<string>("");
  const [keepHistory, setKeepHistory] = useState(true);

  const { data: pipelines } = usePipelines();
  const { data: targetStages } = useStages(targetPipelineId);
  const moveDeal = useMoveDealToPipeline();

  // Reset stage when pipeline changes
  useEffect(() => {
    if (targetStages && targetStages.length > 0) {
      setTargetStageId(targetStages[0].id);
    } else {
      setTargetStageId("");
    }
  }, [targetStages]);

  // Filter out current pipeline
  const availablePipelines = pipelines?.filter(p => p.id !== deal.pipeline_id) || [];

  const currentPipeline = pipelines?.find(p => p.id === deal.pipeline_id);
  const selectedPipeline = pipelines?.find(p => p.id === targetPipelineId);
  const selectedStage = targetStages?.find(s => s.id === targetStageId);

  const handleMove = async () => {
    if (!targetPipelineId || !targetStageId) return;

    await moveDeal.mutateAsync({
      dealId: deal.id,
      targetPipelineId,
      targetStageId,
      sourcePipelineName: currentPipeline?.name || "Pipeline anterior",
      targetPipelineName: selectedPipeline?.name || "Novo pipeline",
      targetStageName: selectedStage?.name || "Nova etapa",
      keepHistory,
    });

    setOpen(false);
    setTargetPipelineId("");
    setTargetStageId("");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Migrar Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Deal Info */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="font-medium text-foreground">{deal.title}</p>
            <p className="text-sm text-muted-foreground">
              Pipeline Atual: <span className="font-medium">{currentPipeline?.name || "Não definido"}</span>
            </p>
            {deal.value && (
              <p className="text-sm text-green-600 font-semibold mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
              </p>
            )}
          </div>

          {/* Target Pipeline */}
          <div className="space-y-2">
            <Label>Para qual Pipeline?</Label>
            <Select value={targetPipelineId} onValueChange={setTargetPipelineId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pipeline de destino" />
              </SelectTrigger>
              <SelectContent>
                {availablePipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                    {pipeline.is_default && " (Padrão)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Stage */}
          {targetPipelineId && (
            <div className="space-y-2">
              <Label>Para qual Etapa?</Label>
              <Select value={targetStageId} onValueChange={setTargetStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa de destino" />
                </SelectTrigger>
                <SelectContent>
                  {targetStages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Keep History Option */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="keepHistory"
              checked={keepHistory}
              onCheckedChange={(checked) => setKeepHistory(checked as boolean)}
            />
            <Label htmlFor="keepHistory" className="text-sm font-normal cursor-pointer">
              Manter histórico de atividades e timeline
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMove}
            disabled={!targetPipelineId || !targetStageId || moveDeal.isPending}
          >
            {moveDeal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Migrar Negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
