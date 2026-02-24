import { useState } from "react";
import { Workflow, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActiveFlowState } from "@/hooks/useActiveFlowState";

interface ActiveFlowIndicatorProps {
  conversationId: string;
}

export function ActiveFlowIndicator({ conversationId }: ActiveFlowIndicatorProps) {
  const { activeFlow, cancelFlow, isCancelling } = useActiveFlowState(conversationId);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!activeFlow) return null;

  const isDraft = !activeFlow.flowIsActive;

  return (
    <>
      <div
        className={`mx-4 mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          isDraft
            ? "border-warning/30 bg-warning/5 text-warning"
            : "border-info/30 bg-info/5 text-info"
        }`}
      >
        <Workflow className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">
          Fluxo: <strong>"{activeFlow.flowName}"</strong>
        </span>
        <Badge variant={isDraft ? "warning" : "success"} className="shrink-0 text-[10px]">
          {isDraft ? "Rascunho" : "Ativo"}
        </Badge>
        <Button
          variant="ghost"
          size="xs"
          className="h-6 w-6 p-0 shrink-0"
          onClick={() => setShowConfirm(true)}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar fluxo?</AlertDialogTitle>
            <AlertDialogDescription>
              O fluxo "{activeFlow.flowName}" será cancelado nesta conversa. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelFlow(activeFlow.stateId);
                setShowConfirm(false);
              }}
            >
              Cancelar fluxo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
