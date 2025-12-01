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
  alerts: UnmappedAlert[];
  is_mapped: boolean;
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

    if (!acc[productId]) {
      acc[productId] = {
        kiwify_product_id: productId,
        product_name: productName,
        alerts: [],
        is_mapped: false,
      };
    }

    acc[productId].alerts.push(alert);
    return acc;
  }, {} as Record<string, ProductGroup>);

  // Check if each product is now mapped
  Object.values(groupedByProduct).forEach((group) => {
    const internalProduct = products.find(p => 
      p.external_id === group.kiwify_product_id || 
      p.product_offers?.some((o: any) => o.offer_id === group.kiwify_product_id)
    );

    group.is_mapped = internalProduct?.is_mapped || false;
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
              <Alert key={group.kiwify_product_id} variant="destructive" className="relative">
                <AlertDescription>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-4 w-4" />
                        <p className="font-semibold">{group.product_name}</p>
                        {group.is_mapped ? (
                          <Badge className="bg-success/10 text-success border-success/20">
                            ✅ Mapeado
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

                      <Badge variant="outline" className="font-mono text-xs">
                        {group.kiwify_product_id}
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      {!group.is_mapped && (
                        <>
                          <ReprocessSalesButton
                            kiwifyProductId={group.kiwify_product_id}
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
                                  product_name: group.product_name
                                }
                              });
                              window.dispatchEvent(event);
                            }}
                          >
                            ✏️ Mapear Primeiro
                          </Button>
                        </>
                      )}

                      {group.is_mapped && (
                        <ReprocessSalesButton
                          kiwifyProductId={group.kiwify_product_id}
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
