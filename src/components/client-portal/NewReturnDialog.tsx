import { useState, useRef, useCallback } from "react";
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
import { useRegisterReturn, useLinkReturn, REASON_LABELS } from "@/hooks/useClientReturns";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, AlertTriangle, Upload, X, ImageIcon, Package, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "form" | "success" | "duplicate";

const MAX_PHOTOS = 5;
const MAX_SIZE_MB = 5;

export function NewReturnDialog({ open, onOpenChange }: NewReturnDialogProps) {
  const { user } = useAuth();
  const registerReturn = useRegisterReturn();
  const linkReturn = useLinkReturn();

  const [step, setStep] = useState<Step>("form");
  
  const [orderId, setOrderId] = useState("");
  const [trackingOutbound, setTrackingOutbound] = useState("");
  const [trackingReturn, setTrackingReturn] = useState("");
  const [trackingOriginal, setTrackingOriginal] = useState<string | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingSearched, setTrackingSearched] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [protocol, setProtocol] = useState("");
  const [duplicateReturnId, setDuplicateReturnId] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [productItems, setProductItems] = useState<{ title: string; sku: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSearchedRef = useRef<string>("");

  const resetForm = () => {
    setStep("form");
    
    setOrderId("");
    setTrackingOutbound("");
    setTrackingReturn("");
    setTrackingOriginal(null);
    setLoadingTracking(false);
    setTrackingSearched(false);
    setReason("");
    setDescription("");
    setProtocol("");
    setDuplicateReturnId("");
    setPhotos([]);
    setBuyerName(null);
    setProductItems([]);
  };

  const lookupOrderByTracking = useCallback(async (trackingVal: string) => {
    const trimmed = trackingVal.trim();
    if (!trimmed || trimmed === lastSearchedRef.current) return;
    lastSearchedRef.current = trimmed;
    setLoadingTracking(true);
    setTrackingSearched(false);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-order-by-tracking', {
        body: { tracking_code: trackingVal.trim() },
      });
      if (!error && data?.found && data?.external_order_id) {
        setOrderId(data.external_order_id);
        setTrackingOriginal(data.external_order_id);
      } else {
        setTrackingOriginal(null);
      }
    } catch {
      setTrackingOriginal(null);
    } finally {
      setLoadingTracking(false);
      setTrackingSearched(true);
    }
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleUploadPhoto = async (file: File) => {
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Máximo de ${MAX_PHOTOS} fotos permitidas`);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Tipo não permitido. Use JPEG, PNG ou WebP.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('upload-return-photo', {
        body: formData,
      });

      if (error) throw error;
      if (data?.url) {
        setPhotos(prev => [...prev, data.url]);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err?.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(handleUploadPhoto);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const userEmail = user?.email || "";
    if (!userEmail || !orderId || !reason) return;

    const result = await registerReturn.mutateAsync({
      email: userEmail,
      external_order_id: orderId,
      tracking_code_return: trackingReturn || undefined,
      reason,
      description: description || undefined,
      photos: photos.length > 0 ? photos : undefined,
    });

    if (result.duplicate) {
      setDuplicateReturnId(result.return_id);
      setStep("duplicate");
    } else if (result.success) {
      setProtocol(result.protocol);
      setStep("success");
    }
  };

  const handleLink = async () => {
    await linkReturn.mutateAsync({
      return_id: duplicateReturnId,
      email: user?.email || "",
    });
    setStep("success");
    setProtocol(duplicateReturnId.substring(0, 8).toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "form" && "Nova Devolução"}
            {step === "success" && "Devolução Registrada"}
            {step === "duplicate" && "Devolução Encontrada"}
          </DialogTitle>
          <DialogDescription>
            {step === "form" && "Preencha os dados para solicitar uma devolução"}
            {step === "success" && "Sua solicitação foi recebida com sucesso"}
            {step === "duplicate" && "Encontramos um registro existente"}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rastreio de Envio do Pedido</Label>
              <Input
                value={trackingOutbound}
                onChange={(e) => {
                  setTrackingOutbound(e.target.value);
                  lastSearchedRef.current = "";
                  setTrackingSearched(false);
                  setTrackingOriginal(null);
                  setOrderId("");
                }}
                onBlur={() => lookupOrderByTracking(trackingOutbound)}
                placeholder="Cole o código de rastreio de envio"
              />
            </div>

            <div className="space-y-2">
              <Label>Número do Pedido</Label>
              {loadingTracking ? (
                <div className="flex items-center gap-2 h-10 px-4 rounded-lg border border-input bg-muted/50">
                  <Search className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Buscando...</span>
                </div>
              ) : trackingSearched && !trackingOriginal ? (
                <Input
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Não localizado — digite manualmente"
                />
              ) : (
                <Input
                  value={orderId}
                  readOnly={!!trackingOriginal}
                  onChange={!trackingOriginal ? (e) => setOrderId(e.target.value) : undefined}
                  placeholder="Preenchido automaticamente"
                  className={trackingOriginal ? "bg-muted/50 cursor-default" : ""}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Código de Rastreio da Devolução (opcional)</Label>
              <Input
                value={trackingReturn}
                onChange={(e) => setTrackingReturn(e.target.value)}
                placeholder="Código de rastreio reverso"
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o motivo da devolução..."
                rows={3}
              />
            </div>

            {/* Upload de Fotos */}
            <div className="space-y-2">
              <Label>Fotos do produto (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Até {MAX_PHOTOS} fotos, máx. {MAX_SIZE_MB}MB cada (JPEG, PNG, WebP)
              </p>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden border border-border">
                      <img
                        src={url}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-20 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < MAX_PHOTOS && (
                <div
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Enviando...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Clique para adicionar fotos
                      </span>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!orderId || !reason || !description || registerReturn.isPending || uploading}
            >
              {registerReturn.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Cadastrar Devolução
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="text-center space-y-4 py-4">
            <CheckCircle className="h-12 w-12 text-success mx-auto" />
            <div>
              <p className="font-medium text-foreground">Devolução cadastrada!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Protocolo: <strong>{protocol}</strong>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Você receberá um email de confirmação.
              </p>
            </div>
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full">
              Fechar
            </Button>
          </div>
        )}

        {step === "duplicate" && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                Já existe um cadastro para este pedido registrado pela nossa equipe. Deseja vincular ao seu perfil?
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleLink}
                disabled={linkReturn.isPending}
                className="flex-1"
              >
                {linkReturn.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Sim, vincular
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
