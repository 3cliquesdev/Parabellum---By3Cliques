import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { ArrowRightLeft, Loader2, Users } from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";
import { useStages } from "@/hooks/useStages";
import { useSalesReps } from "@/hooks/useSalesReps";
import { useBulkMoveDealsToPipeline } from "@/hooks/useBulkMoveDealsToPipeline";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface BulkMoveDealsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  currentPipelineId?: string;
  onSuccess?: () => void;
}

export default function BulkMoveDealsDialog({
  open,
  onOpenChange,
  selectedDealIds,
  currentPipelineId,
  onSuccess,
}: BulkMoveDealsDialogProps) {
  const [targetPipelineId, setTargetPipelineId] = useState<string>("");
  const [targetStageId, setTargetStageId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("__keep_current__");
  const [keepHistory, setKeepHistory] = useState(true);

  const { data: pipelines } = usePipelines();
  const { data: targetStages } = useStages(targetPipelineId);
  const { data: salesReps } = useSalesReps();
  const bulkMove = useBulkMoveDealsToPipeline();

  // Reset stage when pipeline changes
  useEffect(() => {
    if (targetStages && targetStages.length > 0) {
      setTargetStageId(targetStages[0].id);
    } else {
      setTargetStageId("");
    }
  }, [targetStages]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTargetPipelineId("");
      setTargetStageId("");
      setAssignedTo("__keep_current__");
      setKeepHistory(true);
    }
  }, [open]);

  const selectedPipeline = pipelines?.find(p => p.id === targetPipelineId);
  const selectedStage = targetStages?.find(s => s.id === targetStageId);

  const handleMove = async () => {
    if (!targetPipelineId || !targetStageId) return;

    await bulkMove.mutateAsync({
      dealIds: selectedDealIds,
      targetPipelineId,
      targetStageId,
      targetPipelineName: selectedPipeline?.name || "Novo pipeline",
      targetStageName: selectedStage?.name || "Nova etapa",
      assignedTo: assignedTo === "__keep_current__" ? undefined : assignedTo,
      keepHistory,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Migrar {selectedDealIds.length} Negócio{selectedDealIds.length > 1 ? "s" : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              Você está prestes a migrar{" "}
              <span className="font-semibold text-foreground">
                {selectedDealIds.length} negócio{selectedDealIds.length > 1 ? "s" : ""}
              </span>{" "}
              em massa.
            </p>
          </div>

          {/* Target Pipeline */}
          <div className="space-y-2">
            <Label>Para qual Pipeline?</Label>
            <Select value={targetPipelineId} onValueChange={setTargetPipelineId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pipeline de destino" />
              </SelectTrigger>
              <SelectContent>
                {pipelines?.map((pipeline) => (
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
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assign to Sales Rep (Optional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Atribuir a vendedor (opcional)
            </Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Manter vendedor atual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__keep_current__">Manter vendedor atual</SelectItem>
                {salesReps?.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage 
                          src={rep.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${rep.full_name}`} 
                        />
                        <AvatarFallback className="text-xs">
                          {rep.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {rep.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keep History Option */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="keepHistory"
              checked={keepHistory}
              onCheckedChange={(checked) => setKeepHistory(checked as boolean)}
            />
            <Label htmlFor="keepHistory" className="text-sm font-normal cursor-pointer">
              Registrar migração na timeline
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMove}
            disabled={!targetPipelineId || !targetStageId || bulkMove.isPending}
          >
            {bulkMove.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Migrar {selectedDealIds.length} Negócio{selectedDealIds.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
