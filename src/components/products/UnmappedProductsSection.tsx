import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Package } from "lucide-react";
import { ReprocessSalesButton } from "./ReprocessSalesButton";
import { useState } from "react";
import { ReprocessingReportDialog } from "./ReprocessingReportDialog";

interface UnmappedAlert {
  id: string;
  title: string;
  message: string | null;
  metadata: any;
  created_at: string | null;
}

interface ProductGroup {
  kiwify_product_id: string;
  product_name: string;
  offer_id?: string;
  offer_name?: string;
  alerts: UnmappedAlert[];
  is_offer_mapped: boolean; // Oferta vinculada a produto interno
  is_ready_to_reprocess: boolean; // Mapeado + tem delivery_group
}

interface UnmappedProductsSectionProps {
  alerts: UnmappedAlert[];
  products: any[];
}

export function UnmappedProductsSection({ alerts, products }: UnmappedProductsSectionProps) {
  const [reportData, setReportData] = useState<any>(null);

  // Group alerts by Kiwify product_id
  const groupedByProduct = alerts.reduce((acc, alert) => {
    const metadata = alert.metadata as any;
    const productId = metadata?.product_id || 'unknown';
    const productName = metadata?.product_name || 'Produto Desconhecido';
    // Extrair offer_id do metadata se disponível (subscription_plan_id)
    const offerId = metadata?.offer_id || metadata?.subscription_plan_id;
    const offerName = metadata?.offer_name || metadata?.subscription_plan_name;

    // Usar chave composta para agrupar corretamente por offer_id quando existir
    const groupKey = offerId || productId;
    
    if (!acc[groupKey]) {
      acc[groupKey] = {
        kiwify_product_id: productId,
        product_name: productName,
        offer_id: offerId,
        offer_name: offerName,
        alerts: [],
        is_offer_mapped: false,
        is_ready_to_reprocess: false,
      };
    }

    acc[groupKey].alerts.push(alert);
    return acc;
  }, {} as Record<string, ProductGroup>);

  // Check if each product/offer is now mapped
  Object.values(groupedByProduct).forEach((group) => {
    // Encontrar produto interno por:
    // 1. external_id === kiwify_product_id
    // 2. product_offers contém offer_id (para assinaturas)
    // 3. product_offers contém kiwify_product_id (fallback legado)
    const internalProduct = products.find(p => 
      p.external_id === group.kiwify_product_id || 
      (group.offer_id && p.product_offers?.some((o: any) => o.offer_id === group.offer_id)) ||
      p.product_offers?.some((o: any) => o.offer_id === group.kiwify_product_id)
    );

    // Oferta está mapeada se encontrou produto interno
    group.is_offer_mapped = !!internalProduct;
    
    // Pronto para reprocessar se mapeado E tem delivery_group_id
    group.is_ready_to_reprocess = !!(internalProduct && internalProduct.delivery_group_id);
  });

  const productGroups = Object.values(groupedByProduct);

  if (productGroups.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Produtos Não Mapeados com Alertas ({alerts.length})
          </CardTitle>
          <CardDescription>
            Vendas recusadas por falta de mapeamento de produto. Após mapear, clique em "Reprocessar" para iniciar os playbooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {productGroups.map((group) => (
              <Alert key={group.offer_id || group.kiwify_product_id} variant={group.is_offer_mapped ? "default" : "destructive"} className="relative">
                <AlertDescription>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Package className="h-4 w-4" />
                        <p className="font-semibold">{group.offer_name || group.product_name}</p>
                        {group.is_ready_to_reprocess ? (
                          <Badge className="bg-success/10 text-success border-success/20">
                            ✅ Pronto para Reprocessar
                          </Badge>
                        ) : group.is_offer_mapped ? (
                          <Badge className="bg-warning/10 text-warning border-warning/20">
                            ⏳ Mapeado (falta grupo de entrega)
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            ⚠️ Não Mapeado
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm opacity-90 mb-2">
                        {group.alerts.length} {group.alerts.length === 1 ? 'cliente aguardando' : 'clientes aguardando'} reprocessamento
                      </p>

                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          Produto: {group.kiwify_product_id}
                        </Badge>
                        {group.offer_id && group.offer_id !== group.kiwify_product_id && (
                          <Badge variant="outline" className="font-mono text-xs">
                            Oferta: {group.offer_id}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!group.is_offer_mapped && (
                        <>
                          <ReprocessSalesButton
                            kiwifyProductId={group.offer_id || group.kiwify_product_id}
                            productName={group.product_name}
                            variant="secondary"
                            onSuccess={setReportData}
                            disabled
                          >
                            🔄 Reprocessar Vendas
                          </ReprocessSalesButton>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const event = new CustomEvent('map-unmapped-product', {
                                detail: {
                                  kiwify_product_id: group.kiwify_product_id,
                                  product_name: group.product_name,
                                  offer_id: group.offer_id,
                                  offer_name: group.offer_name,
                                  alert_ids: group.alerts.map(a => a.id)
                                }
                              });
                              window.dispatchEvent(event);
                            }}
                          >
                            ✏️ Mapear Primeiro
                          </Button>
                        </>
                      )}

                      {group.is_offer_mapped && !group.is_ready_to_reprocess && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const product = products.find(p => 
                              p.external_id === group.kiwify_product_id || 
                              (group.offer_id && p.product_offers?.some((o: any) => o.offer_id === group.offer_id)) ||
                              p.product_offers?.some((o: any) => o.offer_id === group.kiwify_product_id)
                            );
                            if (product) {
                              window.dispatchEvent(new CustomEvent('edit-product', { detail: product.id }));
                            }
                          }}
                        >
                          ⚙️ Configurar Grupo
                        </Button>
                      )}

                      {group.is_ready_to_reprocess && (
                        <ReprocessSalesButton
                          kiwifyProductId={group.offer_id || group.kiwify_product_id}
                          productName={group.product_name}
                          onSuccess={setReportData}
                        />
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      <ReprocessingReportDialog 
        data={reportData} 
        onClose={() => setReportData(null)} 
      />
    </>
  );
}
