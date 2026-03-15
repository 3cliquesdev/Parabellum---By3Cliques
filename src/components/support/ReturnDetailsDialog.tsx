import { AdminReturn, useUpdateReturnStatus } from "@/hooks/useReturns";
import { REASON_LABELS, STATUS_CONFIG } from "@/hooks/useClientReturns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReturnDetailsDialogProps {
  returnData: AdminReturn | null;
  onClose: () => void;
}

export function ReturnDetailsDialog({ returnData, onClose }: ReturnDetailsDialogProps) {
  const updateStatus = useUpdateReturnStatus();
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    if (returnData) setNewStatus(returnData.status);
  }, [returnData]);

  if (!returnData) return null;

  const statusCfg = STATUS_CONFIG[returnData.status] || STATUS_CONFIG.pending;
  const clientName = returnData.contacts
    ? `${returnData.contacts.first_name} ${returnData.contacts.last_name}`
    : returnData.registered_email || "Não vinculado";

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
              <p className="font-medium text-foreground">{REASON_LABELS[returnData.reason] || returnData.reason}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status Atual</p>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
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
                  <SelectItem value="refunded">Reembolsada</SelectItem>
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
