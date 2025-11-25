import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2 } from "lucide-react";
import { useGenerateQBR } from "@/hooks/useGenerateQBR";

interface QBRGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  companyName: string | null;
}

export default function QBRGeneratorDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  companyName,
}: QBRGeneratorDialogProps) {
  const [period, setPeriod] = useState<string>("last_30_days");
  const generateQBR = useGenerateQBR();

  const handleGenerate = () => {
    const periodLabels: Record<string, string> = {
      last_7_days: "Últimos 7 dias",
      last_30_days: "Últimos 30 dias",
      last_90_days: "Últimos 90 dias",
      this_quarter: "Trimestre atual",
    };

    generateQBR.mutate({
      contactId,
      contactName,
      companyName: companyName || "N/A",
      period: periodLabels[period] || "Últimos 30 dias",
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Relatório QBR
          </DialogTitle>
          <DialogDescription>
            Gere um relatório executivo para apresentação ao cliente com métricas de uso,
            suporte e saúde da conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cliente Info */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-semibold">{contactName}</p>
            {companyName && (
              <p className="text-sm text-muted-foreground">{companyName}</p>
            )}
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label htmlFor="period">Período do Relatório</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="period">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_7_days">Últimos 7 dias</SelectItem>
                <SelectItem value="last_30_days">Últimos 30 dias</SelectItem>
                <SelectItem value="last_90_days">Últimos 90 dias</SelectItem>
                <SelectItem value="this_quarter">Trimestre atual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Métricas que serão incluídas */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium mb-3">Métricas incluídas no relatório:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Health Score e tendência de engajamento</li>
              <li>Progresso de onboarding e adoção</li>
              <li>Histórico de interações e touchpoints</li>
              <li>Tickets de suporte (abertos/resolvidos)</li>
              <li>Métricas financeiras (LTV, saldo, pedidos)</li>
              <li>Recomendações de ações</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={generateQBR.isPending}>
            {generateQBR.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
