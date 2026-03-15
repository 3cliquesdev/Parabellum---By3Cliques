import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateAdminReturn } from "@/hooks/useReturns";
import { REASON_LABELS } from "@/hooks/useClientReturns";
import { Loader2 } from "lucide-react";

interface AdminReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminReturnDialog({ open, onOpenChange }: AdminReturnDialogProps) {
  const createReturn = useCreateAdminReturn();
  const [orderId, setOrderId] = useState("");
  const [trackingReturn, setTrackingReturn] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pending");

  const resetForm = () => {
    setOrderId("");
    setTrackingReturn("");
    setReason("");
    setDescription("");
    setStatus("pending");
  };

  const handleSubmit = async () => {
    if (!orderId || !reason) return;
    await createReturn.mutateAsync({
      external_order_id: orderId,
      tracking_code_return: trackingReturn || undefined,
      reason,
      description: description || undefined,
      status,
    });
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Devolução (Admin)</DialogTitle>
          <DialogDescription>Cadastre uma devolução manualmente</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número do Pedido *</Label>
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Ex: SA-12345" />
          </div>

          <div className="space-y-2">
            <Label>Rastreio Devolução</Label>
            <Input value={trackingReturn} onChange={(e) => setTrackingReturn(e.target.value)} placeholder="Código de rastreio" />
          </div>

          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="refunded">Reembolsada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!orderId || !reason || createReturn.isPending}>
            {createReturn.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Cadastrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
