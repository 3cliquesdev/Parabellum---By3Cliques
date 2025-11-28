import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface QuoteItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  discountPercentage: number;
}

interface QuotePreviewProps {
  items: QuoteItem[];
  contactName: string;
  contactEmail: string;
  contactCompany?: string;
  expirationDate?: Date;
  onExpirationDateChange: (date?: Date) => void;
  terms: string;
  onTermsChange: (terms: string) => void;
}

export default function QuotePreview({
  items,
  contactName,
  contactEmail,
  contactCompany,
  expirationDate,
  onExpirationDateChange,
  terms,
  onTermsChange,
}: QuotePreviewProps) {
  const calculateItemTotal = (item: QuoteItem) => {
    const subtotal = item.productPrice * item.quantity;
    const discount = subtotal * (item.discountPercentage / 100);
    return subtotal - discount;
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
  };

  const calculateTotalDiscount = () => {
    return items.reduce((sum, item) => {
      const subtotal = item.productPrice * item.quantity;
      return sum + subtotal * (item.discountPercentage / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/50">
        <h3 className="font-semibold text-foreground">Configurações da Proposta</h3>
        
        {/* Expiration Date */}
        <div className="space-y-2">
          <Label>Data de Validade</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !expirationDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {expirationDate ? (
                  format(expirationDate, "PPP", { locale: ptBR })
                ) : (
                  <span>Selecionar data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={expirationDate}
                onSelect={onExpirationDateChange}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Terms and Conditions */}
        <div className="space-y-2">
          <Label htmlFor="terms">Termos e Condições</Label>
          <Textarea
            id="terms"
            placeholder="Digite os termos e condições da proposta..."
            value={terms}
            onChange={(e) => onTermsChange(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <Separator />

      {/* Preview Section */}
      <div className="border border-border rounded-lg p-6 bg-background space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary mx-auto mb-4">
            <span className="text-3xl font-bold text-primary-foreground">C</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Proposta Comercial</h1>
          <p className="text-muted-foreground">Sistema CRM</p>
        </div>

        <Separator />

        {/* Client Info */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Dados do Cliente</h3>
          <div className="space-y-2 text-sm">
            <p className="text-foreground">
              <span className="font-medium">Nome:</span> {contactName}
            </p>
            <p className="text-foreground">
              <span className="font-medium">Email:</span> {contactEmail}
            </p>
            {contactCompany && (
              <p className="text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="font-medium">Empresa:</span> {contactCompany}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Items Table */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Itens da Proposta</h3>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.productId} className="border-b border-border pb-3 last:border-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {index + 1}. {item.productName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity}x{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(item.productPrice)}
                      {item.discountPercentage > 0 && (
                        <span className="text-green-600 ml-2">
                          ({item.discountPercentage}% desconto)
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-semibold text-foreground">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(calculateItemTotal(item))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(calculateSubtotal())}
            </span>
          </div>
          {calculateTotalDiscount() > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Desconto Total:</span>
              <span className="font-medium text-green-600">
                -{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(calculateTotalDiscount())}
              </span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-xl">
            <span className="font-bold text-foreground">Total:</span>
            <span className="font-bold text-primary">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(calculateTotal())}
            </span>
          </div>
        </div>

        {expirationDate && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground text-center">
              Proposta válida até {format(expirationDate, "PPP", { locale: ptBR })}
            </p>
          </>
        )}

        {terms && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold text-foreground mb-2">Termos e Condições</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{terms}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
