import { useState } from "react";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface QuoteProductSelectorProps {
  selectedProducts: string[];
  onProductsChange: (productIds: string[]) => void;
}

type Product = Tables<"products">;

export default function QuoteProductSelector({
  selectedProducts,
  onProductsChange,
}: QuoteProductSelectorProps) {
  const { data: products, isLoading } = useProducts();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleProduct = (productId: string) => {
    if (selectedProducts.includes(productId)) {
      onProductsChange(selectedProducts.filter((id) => id !== productId));
    } else {
      onProductsChange([...selectedProducts, productId]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selected Count Badge */}
      {selectedProducts.length > 0 && (
        <Badge variant="secondary" className="gap-2">
          <Package className="h-3 w-3" />
          {selectedProducts.length} produto(s) selecionado(s)
        </Badge>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts?.map((product) => {
          const isSelected = selectedProducts.includes(product.id);
          
          return (
            <Card
              key={product.id}
              className={`cursor-pointer transition-all hover:border-primary ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleToggleProduct(product.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleProduct(product.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">{product.name}</h4>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    {product.price && (
                      <p className="text-lg font-bold text-primary">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(product.price)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}
