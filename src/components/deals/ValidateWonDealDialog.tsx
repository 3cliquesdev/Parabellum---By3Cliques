import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle, AlertCircle, Trophy, HelpCircle, CreditCard, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSalesChannels } from "@/hooks/useSalesChannels";

interface ValidateWonDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: {
    id: string;
    title: string;
    contact_id?: string | null;
    assigned_to?: string | null;
  } | null;
  onValidationSuccess: (validatedData: {
    value: number;
    gross_value: number;
    customer_email: string;
    customer_name: string;
    product_name: string;
    order_ref: string;
  }) => void;
  onManualSuccess?: (data: {
    value: number;
    observation: string;
    sales_channel_id?: string;
    sales_channel_name?: string;
    external_order_id?: string;
    company_name?: string;
  }) => void;
}

type ValidationState = "idle" | "validating" | "success" | "error";

export default function ValidateWonDealDialog({
  open,
  onOpenChange,
  deal,
  onValidationSuccess,
  onManualSuccess,
}: ValidateWonDealDialogProps) {
  const [closureMode, setClosureMode] = useState<"kiwify" | "manual">("kiwify");
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
  
  // Manual closure states
  const [manualValue, setManualValue] = useState("");
  const [manualObservation, setManualObservation] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  const { toast } = useToast();
  const { data: salesChannels } = useSalesChannels();

  const selectedChannel = salesChannels?.find(c => c.id === selectedChannelId);
  const requiresOrderId = selectedChannel?.requires_order_id || false;

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

  const handleManualClose = async () => {
    const value = parseFloat(manualValue.replace(/[^\d.,]/g, '').replace(',', '.'));
    
    if (isNaN(value) || value <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor válido para a venda.",
        variant: "destructive",
      });
      return;
    }

    if (manualObservation.trim().length < 10) {
      toast({
        title: "Observação obrigatória",
        description: "A observação deve ter no mínimo 10 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (requiresOrderId && !externalOrderId.trim()) {
      toast({
        title: "ID da Venda obrigatório",
        description: `O canal "${selectedChannel?.name}" exige o ID da venda.`,
        variant: "destructive",
      });
      return;
    }

    if (!onManualSuccess) {
      toast({
        title: "Erro",
        description: "Função de fechamento manual não configurada.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingManual(true);
    try {
      await onManualSuccess({
        value,
        observation: manualObservation.trim(),
        sales_channel_id: selectedChannelId || undefined,
        sales_channel_name: selectedChannel?.name || undefined,
        external_order_id: externalOrderId.trim() || undefined,
        company_name: companyName.trim() || undefined,
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleClose = () => {
    setKiwifyOrderRef("");
    setValidationState("idle");
    setErrorMessage("");
    setValidatedData(null);
    setManualValue("");
    setManualObservation("");
    setClosureMode("kiwify");
    setSelectedChannelId("");
    setExternalOrderId("");
    setCompanyName("");
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
            Confirmar Venda
          </DialogTitle>
          <DialogDescription>
            Para marcar "{deal.title}" como ganho, escolha o método de validação.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={closureMode} onValueChange={(v) => setClosureMode(v as "kiwify" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kiwify" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Kiwify
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Banknote className="h-4 w-4" />
              Outros Canais
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kiwify" className="mt-4">
            {validationState === "idle" || validationState === "validating" || validationState === "error" ? (
              <div className="space-y-4">
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
              <div className="space-y-4">
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
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-700">
                  Selecione o canal de venda e preencha os dados do fechamento.
                </p>
              </div>

              {/* Canal de Venda */}
              <div className="space-y-2">
                <Label>Canal de Venda</Label>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {salesChannels?.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        <span className="flex items-center gap-2">
                          <span>{ch.icon}</span>
                          <span>{ch.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ID da Venda (condicional) */}
              <div className="space-y-2">
                <Label htmlFor="external-order-id">
                  ID da Venda {requiresOrderId ? "*" : "(opcional)"}
                </Label>
                <Input
                  id="external-order-id"
                  placeholder="Ex: ORD-12345"
                  value={externalOrderId}
                  onChange={(e) => setExternalOrderId(e.target.value)}
                  disabled={isSubmittingManual}
                  className="font-mono"
                />
                {requiresOrderId && (
                  <p className="text-xs text-amber-600">
                    O canal "{selectedChannel?.name}" exige o ID da venda
                  </p>
                )}
              </div>

              {/* Empresa */}
              <div className="space-y-2">
                <Label htmlFor="company-name">Empresa (opcional)</Label>
                <Input
                  id="company-name"
                  placeholder="Nome da empresa..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isSubmittingManual}
                />
              </div>

              {/* Valor */}
              <div className="space-y-2">
                <Label htmlFor="manual-value">Valor da Venda *</Label>
                <Input
                  id="manual-value"
                  placeholder="Ex: 500,00"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  disabled={isSubmittingManual}
                />
              </div>

              {/* Observação */}
              <div className="space-y-2">
                <Label htmlFor="manual-observation">Observação * (mín. 10 caracteres)</Label>
                <Textarea
                  id="manual-observation"
                  placeholder="Ex: Cliente pagou via PIX direto..."
                  value={manualObservation}
                  onChange={(e) => setManualObservation(e.target.value)}
                  disabled={isSubmittingManual}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {manualObservation.length}/10 caracteres mínimos
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          
          {closureMode === "kiwify" ? (
            validationState !== "success" ? (
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
            )
          ) : (
            <Button 
              onClick={handleManualClose} 
              disabled={isSubmittingManual || !manualValue || manualObservation.length < 10 || (requiresOrderId && !externalOrderId.trim())}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmittingManual ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4 mr-2" />
                  Fechar Negócio
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
