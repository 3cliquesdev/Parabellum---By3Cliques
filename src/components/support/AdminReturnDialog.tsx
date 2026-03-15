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
import { Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AdminReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LookupResult {
  found: boolean;
  external_order_id?: string;
  tracking_code?: string;
  buyer_name?: string | null;
}

export function AdminReturnDialog({ open, onOpenChange }: AdminReturnDialogProps) {
  const createReturn = useCreateAdminReturn();
  const [trackingOriginal, setTrackingOriginal] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderIdManual, setOrderIdManual] = useState(false);
  const [trackingReturn, setTrackingReturn] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pending");
  const [searching, setSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [buyerName, setBuyerName] = useState<string | null>(null);

  const resetForm = () => {
    setTrackingOriginal("");
    setOrderId("");
    setOrderIdManual(false);
    setTrackingReturn("");
    setReason("");
    setDescription("");
    setStatus("pending");
    setSearching(false);
    setLookupResult(null);
    setBuyerName(null);
  };

  const handleTrackingBlur = async () => {
    const trimmed = trackingOriginal.trim();
    if (!trimmed) {
      setLookupResult(null);
      setOrderId("");
      setOrderIdManual(false);
      setContactId(null);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-order-by-tracking', {
        body: { tracking_code: trimmed },
      });

      if (error) {
        console.error('[AdminReturnDialog] Lookup error:', error);
        setLookupResult({ found: false });
        setOrderIdManual(true);
        return;
      }

      const result = data as LookupResult;
      setLookupResult(result);

      if (result.found && result.external_order_id) {
        setOrderId(result.external_order_id);
        setContactId(result.contact_id || null);
        setOrderIdManual(false);
      } else {
        setOrderId("");
        setContactId(null);
        setOrderIdManual(true);
      }
    } catch (err) {
      console.error('[AdminReturnDialog] Lookup error:', err);
      setLookupResult({ found: false });
      setOrderIdManual(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!orderId || !reason) return;
    await createReturn.mutateAsync({
      external_order_id: orderId,
      tracking_code_original: trackingOriginal.trim() || undefined,
      tracking_code_return: trackingReturn || undefined,
      reason,
      description: description || undefined,
      status,
      contact_id: contactId || undefined,
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
          {/* 1. Rastreio de Ida */}
          <div className="space-y-2">
            <Label>Rastreio de Ida (busca automática)</Label>
            <div className="relative">
              <Input
                value={trackingOriginal}
                onChange={(e) => {
                  setTrackingOriginal(e.target.value);
                  setLookupResult(null);
                  setOrderIdManual(false);
                }}
                onBlur={handleTrackingBlur}
                placeholder="Cole o código de rastreio original"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {!searching && lookupResult?.found && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              )}
              {!searching && lookupResult && !lookupResult.found && (
                <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
              )}
            </div>
          </div>

          {/* Dados do cliente encontrado */}
          {lookupResult?.found && lookupResult.contact && (
            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">
                {lookupResult.contact.first_name} {lookupResult.contact.last_name}
              </p>
              {lookupResult.contact.email && (
                <p className="text-muted-foreground">{lookupResult.contact.email}</p>
              )}
            </div>
          )}

          {/* Mensagem quando não encontrado */}
          {lookupResult && !lookupResult.found && (
            <p className="text-sm text-destructive">
              Pedido não localizado. Preencha o número manualmente.
            </p>
          )}

          {/* 2. Número do Pedido */}
          <div className="space-y-2">
            <Label>Número do Pedido *</Label>
            <Input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Ex: SA-12345"
              readOnly={!orderIdManual && lookupResult?.found === true}
              className={!orderIdManual && lookupResult?.found ? "bg-muted/50 cursor-default" : ""}
            />
          </div>

          {/* 3. Rastreio Devolução */}
          <div className="space-y-2">
            <Label>Rastreio Devolução</Label>
            <Input value={trackingReturn} onChange={(e) => setTrackingReturn(e.target.value)} placeholder="Código de rastreio reverso" />
          </div>

          {/* 4. Motivo */}
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

          {/* 5. Descrição */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {/* 6. Status */}
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
