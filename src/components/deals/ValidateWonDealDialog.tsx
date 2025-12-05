import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Trophy, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ValidateWonDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: {
    id: string;
    title: string;
    contact_id?: string | null;
  } | null;
  onValidationSuccess: (validatedData: {
    value: number;
    gross_value: number;
    customer_email: string;
    customer_name: string;
    product_name: string;
    order_ref: string;
  }) => void;
}

type ValidationState = "idle" | "validating" | "success" | "error";

export default function ValidateWonDealDialog({
  open,
  onOpenChange,
  deal,
  onValidationSuccess,
}: ValidateWonDealDialogProps) {
  const [kiwifyOrderRef, setKiwifyOrderRef] = useState("");
  const [validationState, setValidationState] = useState<ValidationState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [validatedData, setValidatedData] = useState<{
    value: number;
    gross_value: number;
    customer_email: string;
    customer_name: string;
    product_name: string;
    order_ref: string;
  } | null>(null);
  const { toast } = useToast();

  const handleValidate = async () => {
    if (!kiwifyOrderRef.trim()) {
      toast({
        title: "ID obrigatório",
        description: "Digite o ID da transação Kiwify.",
        variant: "destructive",
      });
      return;
    }

    setValidationState("validating");
    setErrorMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("validate-deal-closure", {
        body: {
          deal_id: deal?.id,
          kiwify_order_ref: kiwifyOrderRef.trim(),
        },
      });

      if (error || !data?.success) {
        setValidationState("error");
        setErrorMessage(data?.error || error?.message || "Erro desconhecido");
        return;
      }

      setValidationState("success");
      setValidatedData(data.data);
    } catch (err: any) {
      setValidationState("error");
      setErrorMessage(err.message || "Erro ao validar transação");
    }
  };

  const handleConfirmClose = () => {
    if (validatedData) {
      onValidationSuccess(validatedData);
    }
  };

  const handleClose = () => {
    setKiwifyOrderRef("");
    setValidationState("idle");
    setErrorMessage("");
    setValidatedData(null);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Confirmar Venda Kiwify
          </DialogTitle>
          <DialogDescription>
            Para marcar "{deal.title}" como ganho, informe o ID da transação Kiwify para validação.
          </DialogDescription>
        </DialogHeader>

        {validationState === "idle" || validationState === "validating" || validationState === "error" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="kiwify-id">ID da Venda Kiwify</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Este é o ID curto visível na interface da Kiwify (ex: VYyDiMg). Você encontra na página de detalhes da venda.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="kiwify-id"
                placeholder="Ex: VYyDiMg"
                value={kiwifyOrderRef}
                onChange={(e) => setKiwifyOrderRef(e.target.value)}
                disabled={validationState === "validating"}
                className="font-mono"
              />
            </div>

            {validationState === "error" && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{errorMessage}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-700">Venda Validada!</p>
                <p className="text-sm text-muted-foreground">Transação encontrada e pronta para vincular.</p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <span className="text-sm font-medium">{validatedData?.customer_name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email:</span>
                <span className="text-sm font-medium">{validatedData?.customer_email || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Produto:</span>
                <span className="text-sm font-medium">{validatedData?.product_name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor Líquido:</span>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(validatedData?.value || 0)}
                </span>
              </div>
              {validatedData?.gross_value && validatedData.gross_value !== validatedData.value && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor Bruto:</span>
                  <span className="text-sm">{formatCurrency(validatedData.gross_value)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          
          {validationState !== "success" ? (
            <Button
              onClick={handleValidate}
              disabled={validationState === "validating" || !kiwifyOrderRef.trim()}
            >
              {validationState === "validating" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                "Validar"
              )}
            </Button>
          ) : (
            <Button onClick={handleConfirmClose} className="bg-green-600 hover:bg-green-700">
              <Trophy className="h-4 w-4 mr-2" />
              Fechar Negócio
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}