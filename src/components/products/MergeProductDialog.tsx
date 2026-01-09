import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, GitMerge, AlertTriangle, ArrowRight, Search } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useMergeProduct, useMergeProductPreview, MergeProductPreview } from "@/hooks/useMergeProduct";

interface MergeProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceProduct: {
    id: string;
    name: string;
    external_id?: string | null;
  } | null;
}

export function MergeProductDialog({ open, onOpenChange, sourceProduct }: MergeProductDialogProps) {
  const { data: products } = useProducts();
  const mergeProduct = useMergeProduct();
  const previewMutation = useMergeProductPreview();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [convertExternalId, setConvertExternalId] = useState(true);
  const [preview, setPreview] = useState<MergeProductPreview | null>(null);

  // Filter products (exclude source)
  const filteredProducts = products?.filter(
    (p) =>
      p.id !== sourceProduct?.id &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load preview when dialog opens
  useEffect(() => {
    if (open && sourceProduct) {
      previewMutation.mutate(sourceProduct.id, {
        onSuccess: setPreview,
      });
    } else {
      setPreview(null);
      setSelectedDestination(null);
      setSearchTerm("");
    }
  }, [open, sourceProduct?.id]);

  const handleMerge = async () => {
    if (!sourceProduct || !selectedDestination) return;

    await mergeProduct.mutateAsync({
      sourceProductId: sourceProduct.id,
      destinationProductId: selectedDestination,
      convertExternalIdToOffer: convertExternalId && !!preview?.sourceExternalId,
    });

    onOpenChange(false);
  };

  const selectedProduct = products?.find((p) => p.id === selectedDestination);

  const hasItemsToTransfer =
    preview &&
    (preview.offersCount > 0 ||
      preview.dealsCount > 0 ||
      preview.playbooksCount > 0 ||
      preview.boardMappingsCount > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Unificar Produto
          </DialogTitle>
          <DialogDescription>
            Transfira todas as referências para outro produto e exclua este.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Product */}
          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground">Produto Origem (será excluído)</Label>
            <div className="font-medium">{sourceProduct?.name}</div>
            {previewMutation.isPending ? (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando...
              </div>
            ) : preview ? (
              <div className="flex flex-wrap gap-1 mt-2">
                {preview.dealsCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {preview.dealsCount} deals
                  </Badge>
                )}
                {preview.offersCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {preview.offersCount} ofertas
                  </Badge>
                )}
                {preview.playbooksCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {preview.playbooksCount} playbooks
                  </Badge>
                )}
                {preview.boardMappingsCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {preview.boardMappingsCount} mapeamentos
                  </Badge>
                )}
                {preview.sourceExternalId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {preview.sourceExternalId}
                  </Badge>
                )}
              </div>
            ) : null}
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Destination Search */}
          <div className="space-y-2">
            <Label>Produto Destino</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto destino..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[180px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredProducts?.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => setSelectedDestination(product.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors ${
                      selectedDestination === product.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium text-sm">{product.name}</div>
                    <div className="text-xs opacity-70">
                      {product.product_offers?.length ?? 0} ofertas
                    </div>
                  </button>
                ))}
                {filteredProducts?.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhum produto encontrado
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Convert External ID Option */}
          {preview?.sourceExternalId && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="convertExternalId"
                checked={convertExternalId}
                onCheckedChange={(checked) => setConvertExternalId(!!checked)}
              />
              <div>
                <Label htmlFor="convertExternalId" className="cursor-pointer">
                  Converter ID Kiwify em oferta
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  O ID <code className="bg-muted px-1 rounded">{preview.sourceExternalId}</code> será
                  adicionado como oferta no produto destino para manter compatibilidade.
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-sm">
              <span className="font-medium text-destructive">Atenção:</span>
              <span className="text-muted-foreground">
                {" "}
                O produto "{sourceProduct?.name}" será permanentemente excluído após a unificação.
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!selectedDestination || mergeProduct.isPending}
          >
            {mergeProduct.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Unificando...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-2" />
                Unificar Produtos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
