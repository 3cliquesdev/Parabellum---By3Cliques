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
  { value: "nunca_respondeu", label: "Nunca respondeu" },
  { value: "parou_interagir", label: "Parou de interagir" },
  { value: "contato_invalido", label: "Contato inválido" },
  { value: "compra_futura", label: "Compra futura" },
  { value: "preco", label: "Preço" },
  { value: "nicho_fora_catalogo", label: "Nicho de interesse fora do catálogo" },
  { value: "prazo_importacao", label: "Prazo de importação" },
  { value: "confianca_geral", label: "Confiança na marca - geral" },
  { value: "confianca_entrega", label: "Confiança na marca - entrega" },
  { value: "confianca_redes", label: "Confiança na marca - reputação redes sociais" },
  { value: "investimento_hibrido", label: "Investimento para o híbrido" },
  { value: "fora_momento", label: "Fora do momento de compra" },
  { value: "desistiu_queda_vendas", label: "Desistiu da compra - queda de vendas" },
  { value: "ja_comprou_duplicidade", label: "Já comprou/Duplicidade" },
  { value: "sem_interesse_produto", label: "Não tinha interesse em nenhum produto" },
  { value: "sem_interesse_dropshipping", label: "Não tinha interesse em fazer dropshipping" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "estorno", label: "Estorno/Chargeback" },
  { value: "migracao_pagamento_anterior", label: "Migração (pagamento anterior)" },
  { value: "outro", label: "Outro" },
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
          <DialogTitle className="text-lg font-semibold text-destructive">
            ⚠️ Marcar Negócio como Perdido
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Você está marcando <strong className="text-foreground">"{dealTitle}"</strong> como perdido.
            <br />
            <span className="text-xs">
              Por favor, informe o motivo para análise e melhoria contínua.
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
