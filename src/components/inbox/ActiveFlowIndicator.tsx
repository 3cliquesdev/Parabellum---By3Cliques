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

const ACTIVE_STATUSES = ["in_progress", "active", "waiting_input"];

function getStatusConfig(status: string, flowIsActive: boolean) {
  if (ACTIVE_STATUSES.includes(status)) {
    return {
      label: flowIsActive ? "Ativo" : "Rascunho",
      badgeVariant: (flowIsActive ? "info" : "warning") as "info" | "warning",
      borderClass: flowIsActive
        ? "border-info/30 bg-info/5 text-info"
        : "border-warning/30 bg-warning/5 text-warning",
      canCancel: true,
    };
  }
  if (status === "completed") {
    return {
      label: "Concluído",
      badgeVariant: "success" as const,
      borderClass: "border-success/30 bg-success/5 text-success",
      canCancel: false,
    };
  }
  if (status === "transferred") {
    return {
      label: "Transferido",
      badgeVariant: "warning" as const,
      borderClass: "border-warning/30 bg-warning/5 text-warning",
      canCancel: false,
    };
  }
  // cancelled or unknown
  return {
    label: "Cancelado",
    badgeVariant: "cold" as const,
    borderClass: "border-muted-foreground/30 bg-muted text-muted-foreground",
    canCancel: false,
  };
}

export function ActiveFlowIndicator({ conversationId }: ActiveFlowIndicatorProps) {
  const { activeFlow, cancelFlow, isCancelling } = useActiveFlowState(conversationId);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!activeFlow) return null;

  const config = getStatusConfig(activeFlow.status, activeFlow.flowIsActive);

  return (
    <>
      <div
        className={`mx-4 mt-2 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${config.borderClass}`}
      >
        <Workflow className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">
          Fluxo: <strong>"{activeFlow.flowName}"</strong>
        </span>
        <Badge variant={config.badgeVariant} className="shrink-0 text-[10px]">
          {config.label}
        </Badge>
        {config.canCancel && (
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
        )}
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
