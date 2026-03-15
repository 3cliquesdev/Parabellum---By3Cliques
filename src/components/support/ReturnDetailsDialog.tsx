import { AdminReturn, useUpdateReturnStatus } from "@/hooks/useReturns";
import { STATUS_CONFIG } from "@/hooks/useClientReturns";
import { useReasonLabelsMap } from "@/hooks/useReturnReasons";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReturnDetailsDialogProps {
  returnData: AdminReturn | null;
  onClose: () => void;
}

export function ReturnDetailsDialog({ returnData, onClose }: ReturnDetailsDialogProps) {
  const updateStatus = useUpdateReturnStatus();
  const reasonLabels = useReasonLabelsMap();
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    if (returnData) setNewStatus(returnData.status);
  }, [returnData]);

  if (!returnData) return null;

  const statusCfg = STATUS_CONFIG[returnData.status] || STATUS_CONFIG.pending;
  const clientName = returnData.contacts
    ? `${returnData.contacts.first_name} ${returnData.contacts.last_name}`
    : returnData.registered_email || "Não vinculado";

  const daysOld = differenceInDays(new Date(), new Date(returnData.created_at));
  const isOverSLA = daysOld > 30;
  const isArchived = returnData.status === "archived";

  const handleSave = async () => {
    if (newStatus !== returnData.status) {
      await updateStatus.mutateAsync({ id: returnData.id, status: newStatus });
      onClose();
    }
  };

  return (
    <Dialog open={!!returnData} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da Devolução</DialogTitle>
          <DialogDescription>
            Protocolo: {returnData.id.substring(0, 8).toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alerta SLA 30 dias */}
          {isOverSLA && !isArchived && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta devolução tem mais de 30 dias ({daysOld} dias). Recomenda-se arquivar — reembolso não será mais possível.
              </AlertDescription>
            </Alert>
          )}

          {isArchived && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta devolução foi arquivada. Não é possível reembolsar.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="font-medium text-foreground">{clientName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pedido</p>
              <p className="font-medium text-foreground">{returnData.external_order_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Motivo</p>
              <p className="font-medium text-foreground">{reasonLabels[returnData.reason] || returnData.reason}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status Atual</p>
              <Badge variant={statusCfg.variant as any}>{statusCfg.label}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Rastreio Original</p>
              <p className="font-medium text-foreground">{returnData.tracking_code_original || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rastreio Devolução</p>
              <p className="font-medium text-foreground">{returnData.tracking_code_return || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Criado por</p>
              <Badge variant="outline">{returnData.created_by === "admin" ? "Admin" : "Cliente"}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-medium text-foreground">
                {format(new Date(returnData.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          {returnData.description && (
            <div>
              <p className="text-sm text-muted-foreground">Descrição</p>
              <p className="text-sm text-foreground mt-1">{returnData.description}</p>
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <div className="space-y-2">
              <Label>Alterar Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                  <SelectItem value="refunded" disabled={isArchived || isOverSLA}>
                    Reembolsada {(isArchived || isOverSLA) ? "(bloqueado)" : ""}
                  </SelectItem>
                  <SelectItem value="archived">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={newStatus === returnData.status || updateStatus.isPending}
            >
              {updateStatus.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alteração
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
