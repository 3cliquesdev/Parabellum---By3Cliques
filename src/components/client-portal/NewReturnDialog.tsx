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
import { useRegisterReturn, useLinkReturn, REASON_LABELS } from "@/hooks/useClientReturns";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface NewReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "form" | "success" | "duplicate";

export function NewReturnDialog({ open, onOpenChange }: NewReturnDialogProps) {
  const { user } = useAuth();
  const registerReturn = useRegisterReturn();
  const linkReturn = useLinkReturn();

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState(user?.email || "");
  const [orderId, setOrderId] = useState("");
  const [trackingReturn, setTrackingReturn] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [protocol, setProtocol] = useState("");
  const [duplicateReturnId, setDuplicateReturnId] = useState("");

  const resetForm = () => {
    setStep("form");
    setEmail(user?.email || "");
    setOrderId("");
    setTrackingReturn("");
    setReason("");
    setDescription("");
    setProtocol("");
    setDuplicateReturnId("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleSubmit = async () => {
    if (!email || !orderId || !reason) return;

    const result = await registerReturn.mutateAsync({
      email,
      external_order_id: orderId,
      tracking_code_return: trackingReturn || undefined,
      reason,
      description: description || undefined,
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
      email,
    });
    setStep("success");
    setProtocol(duplicateReturnId.substring(0, 8).toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
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
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Número do Pedido</Label>
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Ex: SA-12345"
              />
            </div>

            <div className="space-y-2">
              <Label>Código de Rastreio da Devolução (opcional)</Label>
              <Input
                value={trackingReturn}
                onChange={(e) => setTrackingReturn(e.target.value)}
                placeholder="Código de rastreio"
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
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o motivo da devolução..."
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!email || !orderId || !reason || registerReturn.isPending}
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
