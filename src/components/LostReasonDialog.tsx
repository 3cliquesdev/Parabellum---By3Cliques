import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LostReasonDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes?: string) => void;
  dealTitle: string;
}

const LOST_REASONS = [
  { value: "price", label: "Preço" },
  { value: "competition", label: "Concorrência" },
  { value: "no_response", label: "Sem Resposta do Cliente" },
  { value: "timing", label: "Timing Ruim" },
  { value: "not_interested", label: "Perdeu o Interesse" },
  { value: "budget", label: "Sem Orçamento" },
  { value: "other", label: "Outros" },
];

export default function LostReasonDialog({
  open,
  onClose,
  onConfirm,
  dealTitle,
}: LostReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, notes);
    // Reset state
    setReason("");
    setNotes("");
  };

  const handleCancel = () => {
    setReason("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">⚠️ Marcar Negócio como Perdido</DialogTitle>
          <DialogDescription>
            Você está marcando <strong>"{dealTitle}"</strong> como perdido.
            <br />
            <span className="text-muted-foreground text-xs">
              Por favor, informe o motivo para análise futura.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Motivo da Perda <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Observações Adicionais
            </Label>
            <Textarea
              id="notes"
              placeholder="Detalhes sobre a perda (opcional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason}
          >
            Confirmar Perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
