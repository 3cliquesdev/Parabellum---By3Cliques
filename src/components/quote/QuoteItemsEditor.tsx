import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface QuoteItem {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  discountPercentage: number;
}

interface QuoteItemsEditorProps {
  items: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
}

export default function QuoteItemsEditor({ items, onItemsChange }: QuoteItemsEditorProps) {
  const handleQuantityChange = (productId: string, quantity: number) => {
    const updatedItems = items.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item
    );
    onItemsChange(updatedItems);
  };

  const handleDiscountChange = (productId: string, discount: number) => {
    const updatedItems = items.map((item) =>
      item.productId === productId ? { ...item, discountPercentage: discount } : item
    );
    onItemsChange(updatedItems);
  };

  const handleRemoveItem = (productId: string) => {
    const updatedItems = items.filter((item) => item.productId !== productId);
    onItemsChange(updatedItems);
  };

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

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhum produto selecionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Items Table */}
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.productId} className="border border-border rounded-lg p-4 space-y-4">
            {/* Product Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{item.productName}</h4>
                <p className="text-sm text-muted-foreground">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(item.productPrice)}{" "}
                  / unidade
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveItem(item.productId)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Quantity Input */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`quantity-${item.productId}`}>Quantidade</Label>
                <Input
                  id={`quantity-${item.productId}`}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Item Total */}
              <div className="space-y-2">
                <Label>Total do Item</Label>
                <div className="h-10 flex items-center">
                  <p className="text-lg font-bold text-primary">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(calculateItemTotal(item))}
                  </p>
                </div>
              </div>
            </div>

            {/* Discount Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Desconto</Label>
                <span className="text-sm font-medium text-primary">{item.discountPercentage}%</span>
              </div>
              <Slider
                value={[item.discountPercentage]}
                onValueChange={([value]) => handleDiscountChange(item.productId, value)}
                max={50}
                step={1}
                className="w-full"
              />
              {item.discountPercentage > 0 && (
                <p className="text-xs text-muted-foreground">
                  Economia:{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format((item.productPrice * item.quantity * item.discountPercentage) / 100)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Totals */}
      <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
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
            <span className="font-medium text-destructive">
              -{" "}
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(calculateTotalDiscount())}
            </span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-lg">
          <span className="font-semibold">Total Final:</span>
          <span className="font-bold text-primary">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(calculateTotal())}
          </span>
        </div>
      </div>
    </div>
  );
}
