import { Button } from "@/components/ui/button";
import { Bot, X, Users } from "lucide-react";
import { useBulkReactivateAI } from "@/hooks/useBulkReactivateAI";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  waitingHumanCount: number;
  waitingHumanIds: string[];
}

export function BulkActionsBar({ 
  selectedIds, 
  onClearSelection,
  waitingHumanCount,
  waitingHumanIds,
}: BulkActionsBarProps) {
  const bulkReactivate = useBulkReactivateAI();

  const handleReactivateSelected = () => {
    if (selectedIds.length > 0) {
      bulkReactivate.mutate(selectedIds, {
        onSuccess: onClearSelection
      });
    }
  };

  const handleReactivateAll = () => {
    if (waitingHumanIds.length > 0) {
      bulkReactivate.mutate(waitingHumanIds);
    }
  };

  if (selectedIds.length === 0 && waitingHumanCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 border-b">
      {selectedIds.length > 0 ? (
        <>
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} selecionada(s)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReactivateSelected}
            disabled={bulkReactivate.isPending}
            className="h-7 gap-1"
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="text-xs">Reativar IA</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 gap-1"
          >
            <X className="h-3.5 w-3.5" />
            <span className="text-xs">Limpar</span>
          </Button>
        </>
      ) : waitingHumanCount > 0 ? (
        <>
          <Users className="h-4 w-4 text-orange-500" />
          <span className="text-sm text-muted-foreground">
            {waitingHumanCount} aguardando humano
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReactivateAll}
            disabled={bulkReactivate.isPending}
            className="h-7 gap-1 ml-auto"
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="text-xs">Reativar Todas</span>
          </Button>
        </>
      ) : null}
    </div>
  );
}
