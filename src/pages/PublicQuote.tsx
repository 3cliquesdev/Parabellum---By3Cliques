import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuoteByToken } from "@/hooks/useQuotes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const { data: quote, isLoading } = useQuoteByToken(token);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  // Enable body scroll for public pages
  useEffect(() => {
    document.documentElement.classList.add('allow-body-scroll');
    return () => {
      document.documentElement.classList.remove('allow-body-scroll');
    };
  }, []);

  const handleAccept = async () => {
    if (!quote || !signatureName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite seu nome completo para aceitar a proposta",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const signatureData = {
        signer_name: signatureName.trim(),
        signed_at: new Date().toISOString(),
        ip_address: "unknown", // Could be enhanced with IP detection
      };

      const { error } = await supabase
        .from("quotes")
        .update({
          status: "accepted",
          signature_data: JSON.stringify(signatureData),
        })
        .eq("id", quote.id);

      if (error) throw error;

      toast({
        title: "✅ Proposta Aceita!",
        description: "Obrigado! Nossa equipe entrará em contato em breve.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao processar assinatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!quote) return;

    setIsProcessing(true);
    try {
      const rejectionData = {
        rejected_at: new Date().toISOString(),
        reason: rejectionReason.trim() || "Não especificado",
      };

      const { error } = await supabase
        .from("quotes")
        .update({
          status: "rejected",
          signature_data: JSON.stringify(rejectionData),
        })
        .eq("id", quote.id);

      if (error) throw error;

      toast({
        title: "Proposta Recusada",
        description: "Obrigado pelo feedback. Ficamos à disposição para futuras oportunidades.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao processar recusa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quote) {
    return <Navigate to="/" replace />;
  }

  const contact = quote.contacts as any;
  const items = (quote as any).items || [];
  const isExpired = quote.expiration_date && new Date(quote.expiration_date) < new Date();
  const isFinal = quote.status === "accepted" || quote.status === "rejected";

  const subtotal = items.reduce((sum: number, item: any) => 
    sum + (item.quantity * item.unit_price), 0
  ) || 0;

  const totalDiscount = items.reduce((sum: number, item: any) => 
    sum + (item.quantity * item.unit_price * (item.discount_percentage / 100)), 0
  ) || 0;

  const total = subtotal - totalDiscount;
  
  const signatureData = quote.signature_data ? JSON.parse(quote.signature_data as string) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  Proposta Comercial
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  Proposta #{quote.quote_number}
                </p>
              </div>
              {quote.status === "accepted" && (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              )}
              {quote.status === "rejected" && (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Nome:</strong> {contact?.first_name} {contact?.last_name}</p>
            {contact?.company && <p><strong>Empresa:</strong> {contact.company}</p>}
            <p><strong>Email:</strong> {contact?.email}</p>
            {contact?.phone && <p><strong>Telefone:</strong> {contact.phone}</p>}
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Itens da Proposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Produto</th>
                    <th className="text-right py-3 px-2">Qtd</th>
                    <th className="text-right py-3 px-2">Preço Unit.</th>
                    <th className="text-right py-3 px-2">Desconto</th>
                    <th className="text-right py-3 px-2">Total</th>
                  </tr>
                </thead>
              <tbody>
                  {items.map((item: any) => {
                    const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percentage / 100);
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="py-3 px-2">{item.products?.name || "Produto"}</td>
                        <td className="text-right py-3 px-2">{item.quantity}</td>
                        <td className="text-right py-3 px-2">
                          R$ {item.unit_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="text-right py-3 px-2">{item.discount_percentage}%</td>
                        <td className="text-right py-3 px-2 font-semibold">
                          R$ {itemTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto Total:</span>
                  <span>- R$ {totalDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-2xl font-bold text-primary">
                <span>Total:</span>
                <span>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expiration */}
        {quote.expiration_date && (
          <Card className={isExpired ? "border-red-500" : ""}>
            <CardContent className="pt-6">
              <p className={`text-sm ${isExpired ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                {isExpired ? "⚠️ Proposta Expirada em: " : "📅 Válida até: "}
                {format(new Date(quote.expiration_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Signature Section */}
        {!isFinal && !isExpired && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle>Assinatura Digital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!showRejectionForm ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="signature-name">Nome Completo do Signatário *</Label>
                    <Input
                      id="signature-name"
                      placeholder="Digite seu nome completo"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleAccept}
                      disabled={isProcessing || !signatureName.trim()}
                      className="flex-1"
                      size="lg"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Aceitar Proposta
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectionForm(true)}
                      disabled={isProcessing}
                      size="lg"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Recusar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="rejection-reason">Motivo da Recusa (Opcional)</Label>
                    <Textarea
                      id="rejection-reason"
                      placeholder="Por favor, nos diga o motivo..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      disabled={isProcessing}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectionForm(false)}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processando...
                        </>
                      ) : (
                        "Confirmar Recusa"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Final */}
        {isFinal && (
          <Card className={quote.status === "accepted" ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-red-500 bg-red-50 dark:bg-red-950/20"}>
            <CardContent className="pt-6 text-center">
              {quote.status === "accepted" ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                    Proposta Aceita!
                  </h3>
                  <p className="text-muted-foreground">
                    Assinada por: {signatureData?.signer_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Em: {signatureData?.signed_at && format(new Date(signatureData.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">
                    Proposta Recusada
                  </h3>
                  {signatureData?.reason && (
                    <p className="text-muted-foreground mt-2">
                      Motivo: {signatureData.reason}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
