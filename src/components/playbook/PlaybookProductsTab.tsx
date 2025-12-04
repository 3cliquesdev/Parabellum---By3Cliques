import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Package, Plus, Link2 } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { usePlaybookProducts, useLinkPlaybookProducts, useUnlinkPlaybookProduct } from "@/hooks/usePlaybookProducts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface PlaybookProductsTabProps {
  playbookId: string | undefined;
  playbookName: string;
}

export function PlaybookProductsTab({ playbookId, playbookName }: PlaybookProductsTabProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productToRemove, setProductToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: linkedProducts = [], isLoading: loadingLinked } = usePlaybookProducts(playbookId);
  const linkProducts = useLinkPlaybookProducts();
  const unlinkProduct = useUnlinkPlaybookProduct();

  const linkedProductIds = linkedProducts.map(lp => lp.product_id);
  const availableProducts = products.filter(p => !linkedProductIds.includes(p.id));

  const handleLink = () => {
    if (!playbookId || !selectedProductId) return;
    
    linkProducts.mutate(
      { playbookId, productIds: [selectedProductId] },
      { onSuccess: () => setSelectedProductId("") }
    );
  };

  const handleUnlink = () => {
    if (!playbookId || !productToRemove) return;
    
    unlinkProduct.mutate(
      { playbookId, productId: productToRemove.id },
      { onSuccess: () => setProductToRemove(null) }
    );
  };

  if (!playbookId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Salve o playbook primeiro para vincular produtos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular Produtos
          </CardTitle>
          <CardDescription>
            Selecione os produtos que devem acionar este playbook automaticamente quando vendidos via Kiwify.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              disabled={loadingProducts || availableProducts.length === 0}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={
                  availableProducts.length === 0 
                    ? "Todos os produtos já estão vinculados" 
                    : "Selecione um produto..."
                } />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map(product => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {product.name}
                      {product.external_id && (
                        <Badge variant="outline" className="text-xs">
                          Kiwify: {product.external_id.slice(0, 8)}...
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleLink}
              disabled={!selectedProductId || linkProducts.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Vincular
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos Vinculados
            <Badge variant="secondary">{linkedProducts.length}</Badge>
          </CardTitle>
          <CardDescription>
            Quando uma venda de qualquer um destes produtos for registrada, o playbook "{playbookName}" será executado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLinked ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : linkedProducts.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum produto vinculado ainda.</p>
              <p className="text-sm text-muted-foreground">
                Vincule produtos acima para ativar este playbook automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedProducts.map(lp => (
                <div 
                  key={lp.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{lp.product?.name || "Produto"}</p>
                      {lp.product?.external_id && (
                        <p className="text-xs text-muted-foreground">
                          Kiwify ID: {lp.product.external_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setProductToRemove({ 
                      id: lp.product_id, 
                      name: lp.product?.name || "Produto" 
                    })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!productToRemove} onOpenChange={() => setProductToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto "{productToRemove?.name}" não acionará mais este playbook automaticamente.
              Vendas existentes não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
