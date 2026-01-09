import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProducts } from "@/hooks/useProducts";
import { useCreateProductOffer } from "@/hooks/useProductOffers";
import { Search, Package, Plus, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface LinkOfferToProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerData: {
    kiwify_product_id: string;
    product_name: string;
    offer_id?: string;
    offer_name?: string;
    alert_ids?: string[];
  } | null;
  onCreateNew: () => void;
}

export function LinkOfferToProductDialog({
  open,
  onOpenChange,
  offerData,
  onCreateNew,
}: LinkOfferToProductDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  const { data: products, isLoading } = useProducts();
  const createOffer = useCreateProductOffer();
  const queryClient = useQueryClient();

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!search.trim()) return products;
    
    const searchLower = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.external_id?.toLowerCase().includes(searchLower)
    );
  }, [products, search]);

  const handleLink = async () => {
    if (!selectedProductId || !offerData) return;

    // Usar offer_id quando disponível, senão usar kiwify_product_id como fallback
    // (para compatibilidade com alerts legados que não têm offer_id)
    const offerId = offerData.offer_id || offerData.kiwify_product_id;

    await createOffer.mutateAsync({
      product_id: selectedProductId,
      offer_id: offerId,
      offer_name: offerData.offer_name || offerData.product_name,
      price: 0,
      source: "kiwify",
    });

    // Marcar os alerts como lidos após vincular com sucesso
    if (offerData.alert_ids && offerData.alert_ids.length > 0) {
      await supabase
        .from('admin_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', offerData.alert_ids);
      
      // Invalidar a query de alerts para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ['unmapped-product-alerts'] });
    }

    setSelectedProductId(null);
    setSearch("");
    onOpenChange(false);
  };

  const handleCreateNew = () => {
    setSelectedProductId(null);
    setSearch("");
    onOpenChange(false);
    onCreateNew();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedProductId(null);
      setSearch("");
    }
    onOpenChange(open);
  };

  if (!offerData) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Oferta a Produto</DialogTitle>
          <DialogDescription>
            Escolha um produto existente ou crie um novo para vincular esta oferta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Offer Info */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium text-foreground">
              {offerData.offer_name || offerData.product_name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                {offerData.offer_id || offerData.kiwify_product_id}
              </Badge>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Products List */}
          <ScrollArea className="h-[200px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Package className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedProductId(product.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-md transition-colors",
                      "hover:bg-accent",
                      selectedProductId === product.id
                        ? "bg-primary/10 border border-primary"
                        : "border border-transparent"
                    )}
                  >
                    <p className="font-medium text-sm text-foreground">
                      {product.name}
                    </p>
                    {product.external_id && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ID: {product.external_id}
                      </p>
                    )}
                    {product.product_offers && product.product_offers.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.product_offers.length} oferta(s) vinculada(s)
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Create New Option */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCreateNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Novo Produto
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedProductId || createOffer.isPending}
          >
            {createOffer.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
