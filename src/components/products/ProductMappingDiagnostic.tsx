import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Package, ExternalLink, Settings, AlertCircle } from "lucide-react";
import { UnmappedProductsSection } from "./UnmappedProductsSection";
import { OrphanOffersWidget } from "./OrphanOffersWidget";

interface ProductMappingStatus {
  id: string;
  name: string;
  external_id: string | null;
  delivery_group_id: string | null;
  delivery_group_name: string | null;
  offers_count: number;
  is_mapped: boolean;
  status: 'complete' | 'no_group' | 'no_offers' | 'unmapped';
}

export function ProductMappingDiagnostic() {
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-mapping-diagnostic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          external_id,
          delivery_group_id,
          delivery_groups (
            id,
            name
          ),
          product_offers (
            id,
            offer_id
          )
        `)
        .order('name');

      if (error) throw error;

      return (data || []).map((product: any): ProductMappingStatus => {
        const offersCount = product.product_offers?.length || 0;
        const hasGroup = !!product.delivery_group_id;
        const hasOffers = offersCount > 0;

        let status: ProductMappingStatus['status'] = 'unmapped';
        let isMapped = false;

        if (hasGroup && hasOffers) {
          status = 'complete';
          isMapped = true;
        } else if (!hasGroup && hasOffers) {
          status = 'no_group';
        } else if (hasGroup && !hasOffers) {
          status = 'no_offers';
        }

        return {
          id: product.id,
          name: product.name,
          external_id: product.external_id,
          delivery_group_id: product.delivery_group_id,
          delivery_group_name: product.delivery_groups?.name || null,
          offers_count: offersCount,
          is_mapped: isMapped,
          status,
        };
      });
    },
  });

  const { data: unmappedAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['unmapped-product-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_alerts')
        .select('*')
        .eq('type', 'unmapped_product')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
  });

  const getStatusIcon = (status: ProductMappingStatus['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'no_group':
      case 'no_offers':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'unmapped':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusBadge = (status: ProductMappingStatus['status']) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-success/10 text-success border-success/20">✅ Mapeado</Badge>;
      case 'no_group':
        return <Badge variant="outline" className="border-warning text-warning">⚠️ Sem Grupo</Badge>;
      case 'no_offers':
        return <Badge variant="outline" className="border-warning text-warning">⚠️ Sem Ofertas</Badge>;
      case 'unmapped':
        return <Badge variant="destructive">❌ Não Mapeado</Badge>;
    }
  };

  const getStatusMessage = (status: ProductMappingStatus['status']) => {
    switch (status) {
      case 'complete':
        return 'Produto completo com ofertas e grupo de entrega configurados';
      case 'no_group':
        return 'Produto tem ofertas mas não está vinculado a um grupo de entrega';
      case 'no_offers':
        return 'Produto tem grupo de entrega mas não possui ofertas cadastradas';
      case 'unmapped':
        return 'Produto sem ofertas e sem grupo de entrega';
    }
  };

  const completeProducts = products?.filter(p => p.status === 'complete') || [];
  const incompleteProducts = products?.filter(p => p.status !== 'complete') || [];

  if (productsLoading || alertsLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Carregando diagnóstico...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-foreground">{completeProducts.length}</p>
                <p className="text-sm text-muted-foreground">Produtos Mapeados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-foreground">{incompleteProducts.length}</p>
                <p className="text-sm text-muted-foreground">Produtos Incompletos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-foreground">{unmappedAlerts?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Alertas Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Status de Mapeamento de Produtos
          </CardTitle>
          <CardDescription>
            Diagnóstico de produtos e suas integrações com Kiwify
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {products?.map((product) => (
              <div
                key={product.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(product.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-foreground">{product.name}</h4>
                        {getStatusBadge(product.status)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {getStatusMessage(product.status)}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {product.external_id && (
                          <Badge variant="outline" className="font-mono">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {product.external_id}
                          </Badge>
                        )}
                        
                        <span className="text-muted-foreground">
                          📦 {product.offers_count} {product.offers_count === 1 ? 'oferta' : 'ofertas'}
                        </span>
                        
                        {product.delivery_group_name ? (
                          <span className="text-muted-foreground">
                            🎯 {product.delivery_group_name}
                          </span>
                        ) : (
                          <span className="text-warning">
                            ⚠️ Sem grupo de entrega
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {product.status !== 'complete' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to edit product
                        const event = new CustomEvent('edit-product', { detail: product.id });
                        window.dispatchEvent(event);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {products?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto cadastrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orphan Offers Widget - Subscription offers not mapped */}
      <OrphanOffersWidget />

      {/* Unmapped Products Section with Reprocessing */}
      {unmappedAlerts && unmappedAlerts.length > 0 && (
        <UnmappedProductsSection alerts={unmappedAlerts} products={products || []} />
      )}
    </div>
  );
}
