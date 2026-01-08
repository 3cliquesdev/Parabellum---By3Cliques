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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { useSalesReps } from "@/hooks/useSalesReps";
import { usePipelineSalesReps, useUpdatePipelineSalesReps } from "@/hooks/usePipelineSalesReps";

interface PipelineSalesRepsDialogProps {
  pipelineId: string;
  pipelineName?: string;
  trigger?: React.ReactNode;
}

export default function PipelineSalesRepsDialog({
  pipelineId,
  pipelineName,
  trigger,
}: PipelineSalesRepsDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: salesReps } = useSalesReps();
  const { data: pipelineReps } = usePipelineSalesReps(pipelineId);
  const updatePipelineReps = useUpdatePipelineSalesReps();

  // Sync selected users when dialog opens
  useEffect(() => {
    if (pipelineReps) {
      setSelectedUserIds(pipelineReps.map((r) => r.user_id));
    }
  }, [pipelineReps]);

  const handleToggle = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
    await updatePipelineReps.mutateAsync({
      pipelineId,
      userIds: selectedUserIds,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            Equipe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Equipe do Pipeline
          </DialogTitle>
          {pipelineName && (
            <p className="text-sm text-muted-foreground">
              Selecione os vendedores que podem receber deals em "{pipelineName}"
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {salesReps?.map((rep) => (
              <div
                key={rep.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                onClick={() => handleToggle(rep.id)}
              >
                <Checkbox
                  checked={selectedUserIds.includes(rep.id)}
                  onCheckedChange={() => handleToggle(rep.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={
                      rep.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${rep.full_name}`
                    }
                    alt={rep.full_name || ""}
                  />
                  <AvatarFallback className="text-xs">
                    {rep.full_name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {rep.full_name}
                  </p>
                  {rep.job_title && (
                    <p className="text-xs text-muted-foreground truncate">
                      {rep.job_title}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {(!salesReps || salesReps.length === 0) && (
              <p className="text-center text-muted-foreground py-4">
                Nenhum vendedor disponível
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground mt-2">
          {selectedUserIds.length === 0
            ? "⚠️ Sem restrição: todos os vendedores poderão receber deals"
            : `${selectedUserIds.length} vendedor(es) selecionado(s)`}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updatePipelineReps.isPending}>
            {updatePipelineReps.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
