import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Save, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/hooks/useProducts";
import { useCreateQuote } from "@/hooks/useQuotes";
import { useCreateQuoteItem } from "@/hooks/useQuoteItems";
import { useDeals } from "@/hooks/useDeals";
import QuoteStepper from "@/components/quote/QuoteStepper";
import QuoteProductSelector from "@/components/quote/QuoteProductSelector";
import QuoteItemsEditor from "@/components/quote/QuoteItemsEditor";
import QuotePreview from "@/components/quote/QuotePreview";
import { addDays } from "date-fns";

interface QuoteItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  discountPercentage: number;
}

export default function QuoteBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get("deal_id");
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(addDays(new Date(), 15));
  const [terms, setTerms] = useState(
    "Pagamento em até 30 dias após a aprovação da proposta.\nValores sujeitos a alteração sem aviso prévio."
  );

  const { data: products } = useProducts();
  const { data: deals } = useDeals();
  const createQuote = useCreateQuote();
  const createQuoteItem = useCreateQuoteItem();

  const deal = deals?.find((d) => d.id === dealId);
  
  // Type guard for contact with email
  const contactHasDetails = deal?.contacts && 'email' in deal.contacts && 'company' in deal.contacts;

  // Initialize quote items when products are selected
  useEffect(() => {
    if (!products) return;

    const newItems = selectedProducts
      .map((productId) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;

        // Check if item already exists
        const existingItem = quoteItems.find((item) => item.productId === productId);
        if (existingItem) return existingItem;

        return {
          productId: product.id,
          productName: product.name,
          productPrice: product.price || 0,
          quantity: 1,
          discountPercentage: 0,
        };
      })
      .filter((item): item is QuoteItem => item !== null);

    setQuoteItems(newItems);
  }, [selectedProducts, products]);

  const handleNext = () => {
    if (currentStep === 1 && selectedProducts.length === 0) {
      toast({
        title: "Selecione produtos",
        description: "Você precisa selecionar pelo menos um produto",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveDraft = async () => {
    if (!deal || !deal.contact_id) {
      toast({
        title: "Erro",
        description: "Deal ou contato não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      const subtotal = quoteItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
      const totalDiscount = quoteItems.reduce((sum, item) => {
        const itemSubtotal = item.productPrice * item.quantity;
        return sum + (itemSubtotal * item.discountPercentage) / 100;
      }, 0);
      const totalAmount = subtotal - totalDiscount;

      // Create quote
      const quote = await createQuote.mutateAsync({
        deal_id: deal.id,
        contact_id: deal.contact_id,
        status: "draft",
        subtotal,
        discount_percentage: null,
        discount_amount: totalDiscount,
        total_amount: totalAmount,
        expiration_date: expirationDate?.toISOString().split("T")[0],
        signature_token: crypto.randomUUID(),
      });

      // Create quote items
      for (let i = 0; i < quoteItems.length; i++) {
        const item = quoteItems[i];
        await createQuoteItem.mutateAsync({
          quote_id: quote.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.productPrice,
          discount_percentage: item.discountPercentage,
          discount_amount: (item.productPrice * item.quantity * item.discountPercentage) / 100,
          total: item.productPrice * item.quantity * (1 - item.discountPercentage / 100),
          position: i,
        });
      }

      toast({
        title: "Rascunho salvo",
        description: "A proposta foi salva como rascunho",
      });

      navigate("/quotes");
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  };

  const handleSend = async () => {
    if (!deal || !deal.contact_id) {
      toast({
        title: "Erro",
        description: "Deal ou contato não encontrado",
        variant: "destructive",
      });
      return;
    }

    try {
      const subtotal = quoteItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
      const totalDiscount = quoteItems.reduce((sum, item) => {
        const itemSubtotal = item.productPrice * item.quantity;
        return sum + (itemSubtotal * item.discountPercentage) / 100;
      }, 0);
      const totalAmount = subtotal - totalDiscount;

      // Create quote
      const quote = await createQuote.mutateAsync({
        deal_id: deal.id,
        contact_id: deal.contact_id,
        status: "sent",
        subtotal,
        discount_percentage: null,
        discount_amount: totalDiscount,
        total_amount: totalAmount,
        expiration_date: expirationDate?.toISOString().split("T")[0],
        signature_token: crypto.randomUUID(),
      });

      // Create quote items
      for (let i = 0; i < quoteItems.length; i++) {
        const item = quoteItems[i];
        await createQuoteItem.mutateAsync({
          quote_id: quote.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.productPrice,
          discount_percentage: item.discountPercentage,
          discount_amount: (item.productPrice * item.quantity * item.discountPercentage) / 100,
          total: item.productPrice * item.quantity * (1 - item.discountPercentage / 100),
          position: i,
        });
      }

      toast({
        title: "Proposta enviada",
        description: "A proposta foi enviada para o cliente",
      });

      navigate("/quotes");
    } catch (error) {
      console.error("Error sending quote:", error);
    }
  };

  if (!dealId || !deal) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Nenhum deal selecionado. Por favor, selecione um deal primeiro.
            </p>
            <div className="flex justify-center mt-4">
              <Button onClick={() => navigate("/deals")}>Voltar para Deals</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nova Proposta Comercial</h1>
          <p className="text-muted-foreground">
            Deal: {deal.title} | Cliente: {deal.contacts?.first_name} {deal.contacts?.last_name}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/deals")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <QuoteStepper currentStep={currentStep} onStepClick={setCurrentStep} />
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && "Selecionar Produtos"}
            {currentStep === 2 && "Ajustar Valores"}
            {currentStep === 3 && "Preview e Envio"}
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-[400px]">
          {currentStep === 1 && (
            <QuoteProductSelector
              selectedProducts={selectedProducts}
              onProductsChange={setSelectedProducts}
            />
          )}

          {currentStep === 2 && (
            <QuoteItemsEditor items={quoteItems} onItemsChange={setQuoteItems} />
          )}

          {currentStep === 3 && (
            <QuotePreview
              items={quoteItems}
              contactName={`${deal.contacts?.first_name} ${deal.contacts?.last_name}`}
              contactEmail={(deal.contacts as any)?.email || ""}
              contactCompany={(deal.contacts as any)?.company}
              expirationDate={expirationDate}
              onExpirationDateChange={setExpirationDate}
              terms={terms}
              onTermsChange={setTerms}
            />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="flex gap-2">
          {currentStep === 3 && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={createQuote.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Rascunho
            </Button>
          )}

          {currentStep < 3 ? (
            <Button onClick={handleNext}>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={createQuote.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Enviar Proposta
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
