import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Loader2, Edit, Trash2, Package, ExternalLink, Activity, Kanban, GitMerge, Plus } from "lucide-react";
import { useProducts, useDeleteProduct } from "@/hooks/useProducts";
import { ProductDialog } from "@/components/ProductDialog";
import { ProductMappingDiagnostic } from "@/components/products/ProductMappingDiagnostic";
import ProductBoardMappingsContent from "@/components/products/ProductBoardMappingsContent";
import { MergeProductDialog } from "@/components/products/MergeProductDialog";
import { LinkOfferToProductDialog } from "@/components/products/LinkOfferToProductDialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Products() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'products';
  
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const { data: products, isLoading } = useProducts();
  const deleteProduct = useDeleteProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [initialProductData, setInitialProductData] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [productToMerge, setProductToMerge] = useState<{ id: string; name: string; external_id?: string | null } | null>(null);
  const [linkOfferDialogOpen, setLinkOfferDialogOpen] = useState(false);
  const [offerToLink, setOfferToLink] = useState<{
    kiwify_product_id: string;
    product_name: string;
    offer_id?: string;
    offer_name?: string;
    alert_ids?: string[];
  } | null>(null);

  const handleMerge = (product: any) => {
    setProductToMerge({
      id: product.id,
      name: product.name,
      external_id: product.external_id,
    });
    setMergeDialogOpen(true);
  };

  const handleEdit = (product: any) => {
    setSelectedProduct(product);
    setInitialProductData(null);
    setDialogOpen(true);
  };

  const handleMapUnmapped = (kiwifyProductId: string, productName: string, offerId?: string, offerName?: string, alertIds?: string[]) => {
    setOfferToLink({
      kiwify_product_id: kiwifyProductId,
      product_name: productName,
      offer_id: offerId,
      offer_name: offerName,
      alert_ids: alertIds,
    });
    setLinkOfferDialogOpen(true);
  };

  const handleCreateNewFromOffer = () => {
    if (offerToLink) {
      setSelectedProduct(null);
      setInitialProductData({
        name: offerToLink.product_name,
        external_id: offerToLink.kiwify_product_id,
      });
      setDialogOpen(true);
    }
  };

  // Listen for edit-product event from diagnostic
  useEffect(() => {
    const handleEditProductEvent = (event: CustomEvent) => {
      const productId = event.detail;
      const product = products?.find(p => p.id === productId);
      if (product) {
        handleEdit(product);
      }
    };

    const handleMapUnmappedEvent = (event: CustomEvent) => {
      const { kiwify_product_id, product_name, offer_id, offer_name, alert_ids } = event.detail;
      handleMapUnmapped(kiwify_product_id, product_name, offer_id, offer_name, alert_ids);
    };

    window.addEventListener('edit-product', handleEditProductEvent as EventListener);
    window.addEventListener('map-unmapped-product', handleMapUnmappedEvent as EventListener);
    return () => {
      window.removeEventListener('edit-product', handleEditProductEvent as EventListener);
      window.removeEventListener('map-unmapped-product', handleMapUnmappedEvent as EventListener);
    };
  }, [products]);

  if (permLoading || isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission('products.manage')) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteProduct.mutateAsync(productToDelete);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };


  return (
    <div className="min-h-screen p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Produtos</h1>
          <p className="text-muted-foreground mt-2">
            Configure playbooks e regras de distribuição para produtos
          </p>
        </div>
        <Button onClick={() => {
          setSelectedProduct(null);
          setInitialProductData(null);
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Kanban className="h-4 w-4" />
            Automação Kanban
          </TabsTrigger>
          <TabsTrigger value="diagnostic" className="gap-2">
            <Activity className="h-4 w-4" />
            Diagnóstico de Mapeamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          {!products || products.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Nenhum produto importado
                </h3>
                <p className="text-muted-foreground text-center">
                  Os produtos serão criados automaticamente quando receberem vendas da Kiwify
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 flex-wrap">
                          {product.name}
                          {!product.is_active && (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </CardTitle>
                         {product.description && (
                          <CardDescription className="mt-2">
                            {product.description}
                          </CardDescription>
                         )}
                        
                        {/* Kiwify ID Badge */}
                        {product.external_id && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Kiwify: {product.external_id}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Playbook Badge */}
                        {product.onboarding_playbooks && product.onboarding_playbooks.length > 0 && (
                          <div className="mt-2">
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              🎯 {product.onboarding_playbooks[0].name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {product.requires_account_manager ? (
                          <Badge className="bg-primary">
                            Requer Consultor
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Self-Service
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMerge(product)}
                          title="Unificar com outro produto"
                        >
                          <GitMerge className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="automations">
          <ProductBoardMappingsContent />
        </TabsContent>

        <TabsContent value="diagnostic">
          <ProductMappingDiagnostic />
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
        initialData={initialProductData}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MergeProductDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sourceProduct={productToMerge}
      />

      <LinkOfferToProductDialog
        open={linkOfferDialogOpen}
        onOpenChange={setLinkOfferDialogOpen}
        offerData={offerToLink}
        onCreateNew={handleCreateNewFromOffer}
      />
    </div>
  );
}
