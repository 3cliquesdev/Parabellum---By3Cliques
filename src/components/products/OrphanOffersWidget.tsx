import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Users, TrendingUp, Link2 } from "lucide-react";
import { useUnmappedOffers } from "@/hooks/useUnmappedOffers";
import { useProducts } from "@/hooks/useProducts";
import { useCreateProductOffer } from "@/hooks/useProductOffers";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function OrphanOffersWidget() {
  const { data: unmappedOffers, isLoading } = useUnmappedOffers();
  const { data: products } = useProducts();
  const createOffer = useCreateProductOffer();
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});

  const handleMapOffer = (planId: string, planName: string) => {
    const productId = selectedProducts[planId];
    if (!productId) return;

    createOffer.mutate({
      product_id: productId,
      offer_id: planId,
      offer_name: planName,
      price: 0,
      source: 'kiwify',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Ofertas Não Mapeadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!unmappedOffers?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Ofertas Mapeadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Todas as ofertas estão mapeadas corretamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalLostSales = unmappedOffers.reduce((sum, o) => sum + (o.event_count || 0), 0);
  const totalLostRevenue = unmappedOffers.reduce((sum, o) => sum + (o.total_revenue || 0), 0);

  return (
    <Card className="border-warning/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          Ofertas Não Mapeadas ({unmappedOffers.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalLostSales} vendas nos últimos 30 dias sem produto identificado
          {totalLostRevenue > 0 && ` (R$ ${totalLostRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {unmappedOffers.slice(0, 10).map((offer) => (
          <div
            key={offer.plan_id}
            className="flex flex-col gap-3 p-3 rounded-lg border bg-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{offer.plan_name}</span>
                  <Badge variant={offer.detected_source_type === 'afiliado' ? 'secondary' : 'outline'}>
                    {offer.detected_source_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {offer.event_count} vendas
                  </span>
                  {offer.total_revenue > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      R$ {offer.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <code className="text-xs text-muted-foreground block mt-1 truncate">
                  {offer.plan_id}
                </code>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedProducts[offer.plan_id] || ''}
                onValueChange={(value) => 
                  setSelectedProducts(prev => ({ ...prev, [offer.plan_id]: value }))
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar produto..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                disabled={!selectedProducts[offer.plan_id] || createOffer.isPending}
                onClick={() => handleMapOffer(offer.plan_id, offer.plan_name)}
              >
                Mapear
              </Button>
            </div>
          </div>
        ))}

        {unmappedOffers.length > 10 && (
          <p className="text-sm text-muted-foreground text-center">
            + {unmappedOffers.length - 10} outras ofertas não mapeadas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
