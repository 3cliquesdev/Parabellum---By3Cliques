import { useState, useRef } from "react";
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
import { useReturnReasons } from "@/hooks/useReturnReasons";
import { Loader2, Search, CheckCircle2, AlertCircle, Upload, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LookupResult {
  found: boolean;
  external_order_id?: string;
  tracking_code?: string;
  buyer_name?: string | null;
  product_items?: { title: string; sku: string }[];
}

export function AdminReturnDialog({ open, onOpenChange }: AdminReturnDialogProps) {
  const createReturn = useCreateAdminReturn();
  const { data: reasons } = useReturnReasons();
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
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const lastSearchedRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPhotos([]);
    setUploadingPhoto(false);
  };

  const handleUploadPhoto = async (file: File) => {
    if (photos.length >= 5) {
      toast.error("Máximo de 5 fotos permitidas");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Use JPEG, PNG ou WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máximo 5MB por foto");
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data, error } = await supabase.functions.invoke("upload-return-photo", { body: formData });
      if (error) throw error;
      if (data?.url) {
        setPhotos((prev) => [...prev, data.url]);
        toast.success("Foto enviada!");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTrackingBlur = async () => {
    const trimmed = trackingOriginal.trim();
    if (!trimmed || trimmed === lastSearchedRef.current) {
      if (!trimmed) {
      setLookupResult(null);
      setOrderId("");
      setOrderIdManual(false);
      setBuyerName(null);
      }
      return;
    }

    lastSearchedRef.current = trimmed;
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
        setBuyerName(result.buyer_name || null);
        setOrderIdManual(false);
      } else {
        setOrderId("");
        setBuyerName(null);
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
      photos: photos.length > 0 ? photos : undefined,
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
                  lastSearchedRef.current = "";
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

          {/* Dados do comprador */}
          {lookupResult?.found && buyerName && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Seller</p>
              <p className="font-medium">{buyerName}</p>
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

          {/* Produto e SKU - abaixo do número do pedido */}
          {lookupResult?.found && lookupResult.product_items && lookupResult.product_items.length > 0 && (
            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
              {lookupResult.product_items.map((item, i) => (
                <div key={i} className="space-y-0.5">
                  {item.title && (
                    <div>
                      <span className="text-xs text-muted-foreground">Produto: </span>
                      <span className="font-medium">{item.title}</span>
                    </div>
                  )}
                  {item.sku && (
                    <div>
                      <span className="text-xs text-muted-foreground">SKU: </span>
                      <span className="font-medium">{item.sku}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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
              {reasons?.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
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

          {/* 7. Fotos */}
          <div className="space-y-2">
            <Label>Fotos do produto (opcional)</Label>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`Foto ${i + 1}`} className="w-full h-20 object-cover rounded-md border border-border" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 5 && (
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhoto ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Enviando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Clique para adicionar ({photos.length}/5)</span>
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadPhoto(file);
                e.target.value = "";
              }}
            />
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
