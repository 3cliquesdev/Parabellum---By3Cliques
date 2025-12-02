import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Plus, Pencil, Trash2, GripVertical, Loader2, Zap } from "lucide-react";
import { useStages } from "@/hooks/useStages";
import { useCreateStage } from "@/hooks/useCreateStage";
import { useUpdateStage } from "@/hooks/useUpdateStage";
import { useDeleteStage } from "@/hooks/useDeleteStage";
import { usePipelines } from "@/hooks/usePipelines";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PipelineStagesDialogProps {
  pipelineId: string;
  pipelineName?: string;
  trigger?: React.ReactNode;
}

export default function PipelineStagesDialog({ 
  pipelineId, 
  pipelineName,
  trigger 
}: PipelineStagesDialogProps) {
  const [open, setOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [editingStage, setEditingStage] = useState<{ id: string; name: string } | null>(null);
  const [expandedAutomation, setExpandedAutomation] = useState<string | null>(null);

  const { data: stages, isLoading } = useStages(pipelineId);
  const { data: pipelines } = usePipelines();
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const { toast } = useToast();

  const otherPipelines = pipelines?.filter(p => p.id !== pipelineId) || [];

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    
    createStage.mutate(
      { name: newStageName.trim(), pipeline_id: pipelineId },
      {
        onSuccess: () => setNewStageName(""),
      }
    );
  };

  const handleUpdateStage = () => {
    if (!editingStage || !editingStage.name.trim()) return;
    
    updateStage.mutate(
      { id: editingStage.id, name: editingStage.name.trim() },
      {
        onSuccess: () => setEditingStage(null),
      }
    );
  };

  const handleDeleteStage = (stageId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta etapa? Deals nesta etapa ficarão sem etapa definida.")) {
      return;
    }
    deleteStage.mutate(stageId);
  };

  const handleSaveAutomation = async (stageId: string, targetPipelineId: string, targetStageId: string) => {
    try {
      const config = targetPipelineId && targetStageId 
        ? { on_status: "won", target_pipeline_id: targetPipelineId, target_stage_id: targetStageId }
        : null;

      const { error } = await supabase
        .from("stages")
        .update({ auto_move_config: config } as any)
        .eq("id", stageId);

      if (error) throw error;

      toast({
        title: "Automação salva",
        description: config 
          ? "Deal será movido automaticamente ao ser marcado como ganho"
          : "Automação removida",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar automação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Etapas: {pipelineName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add New Stage */}
          <div className="flex gap-2">
            <Input
              placeholder="Nome da nova etapa..."
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
            />
            <Button onClick={handleAddStage} disabled={createStage.isPending}>
              {createStage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Stages List */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : stages && stages.length > 0 ? (
              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <StageItem
                    key={stage.id}
                    stage={stage}
                    index={index}
                    isEditing={editingStage?.id === stage.id}
                    editingName={editingStage?.name || ""}
                    onEditStart={() => setEditingStage({ id: stage.id, name: stage.name })}
                    onEditChange={(name) => setEditingStage({ id: stage.id, name })}
                    onEditSave={handleUpdateStage}
                    onEditCancel={() => setEditingStage(null)}
                    onDelete={() => handleDeleteStage(stage.id)}
                    isExpanded={expandedAutomation === stage.id}
                    onToggleExpand={() => setExpandedAutomation(
                      expandedAutomation === stage.id ? null : stage.id
                    )}
                    otherPipelines={otherPipelines}
                    onSaveAutomation={(targetPipelineId, targetStageId) => 
                      handleSaveAutomation(stage.id, targetPipelineId, targetStageId)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma etapa configurada
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StageItemProps {
  stage: any;
  index: number;
  isEditing: boolean;
  editingName: string;
  onEditStart: () => void;
  onEditChange: (name: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  otherPipelines: any[];
  onSaveAutomation: (targetPipelineId: string, targetStageId: string) => void;
}

function StageItem({
  stage,
  index,
  isEditing,
  editingName,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  isExpanded,
  onToggleExpand,
  otherPipelines,
  onSaveAutomation,
}: StageItemProps) {
  const [automationPipelineId, setAutomationPipelineId] = useState<string>(
    stage.auto_move_config?.target_pipeline_id || ""
  );
  const [automationStageId, setAutomationStageId] = useState<string>(
    stage.auto_move_config?.target_stage_id || ""
  );
  
  const { data: automationStages } = useStages(automationPipelineId);

  const hasAutomation = !!stage.auto_move_config?.target_pipeline_id;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
        <span className="text-xs text-muted-foreground font-mono w-6">{index + 1}</span>
        
        {isEditing ? (
          <div className="flex-1 flex gap-2">
            <Input
              value={editingName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onEditSave();
                if (e.key === "Escape") onEditCancel();
              }}
              autoFocus
              className="h-8"
            />
            <Button size="sm" onClick={onEditSave}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={onEditCancel}>Cancelar</Button>
          </div>
        ) : (
          <>
            <span className="flex-1 font-medium text-foreground">{stage.name}</span>
            {hasAutomation && (
              <Zap className="h-4 w-4 text-yellow-500" />
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
              <Zap className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditStart}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Automation Config */}
      {isExpanded && !isEditing && (
        <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Automação: Ao marcar como GANHO
          </Label>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mover para Pipeline</Label>
              <Select value={automationPipelineId} onValueChange={setAutomationPipelineId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (desativar)</SelectItem>
                  {otherPipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Etapa de Destino</Label>
              <Select 
                value={automationStageId} 
                onValueChange={setAutomationStageId}
                disabled={!automationPipelineId}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {automationStages?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            size="sm" 
            variant="secondary"
            className="w-full"
            onClick={() => onSaveAutomation(automationPipelineId, automationStageId)}
          >
            Salvar Automação
          </Button>
        </div>
      )}
    </div>
  );
}
