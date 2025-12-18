import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { useKiwifyUnmappedOffers, useKiwifyOfferStats } from "@/hooks/useKiwifyOffers";
import { useCreateProductOffer } from "@/hooks/useProductOffers";
import { supabase } from "@/integrations/supabase/client";
import { Check, Download, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface ImportKiwifyOffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

export function ImportKiwifyOffersDialog({
  open,
  onOpenChange,
  productId,
  productName,
}: ImportKiwifyOffersDialogProps) {
  const queryClient = useQueryClient();
  const { data: unmappedOffers, isLoading, refetch } = useKiwifyUnmappedOffers();
  const { data: stats } = useKiwifyOfferStats();
  const createOffer = useCreateProductOffer();
  const [importing, setImporting] = useState<string | null>(null);
  const [runningBackfill, setRunningBackfill] = useState(false);

  const handleImportOffer = async (offer: {
    offer_id: string | null;
    offer_name: string | null;
    total_revenue: number;
  }) => {
    if (!offer.offer_id) return;

    setImporting(offer.offer_id);

    try {
      await createOffer.mutateAsync({
        product_id: productId,
        offer_id: offer.offer_id,
        offer_name: offer.offer_name || `Oferta ${offer.offer_id}`,
        price: offer.total_revenue / (unmappedOffers?.find(o => o.offer_id === offer.offer_id)?.total_sales || 1),
      });

      toast({
        title: "✅ Oferta vinculada",
        description: `"${offer.offer_name || offer.offer_id}" vinculada ao produto ${productName}`,
      });

      // Revalidar queries
      queryClient.invalidateQueries({ queryKey: ['kiwify-unmapped-offers'] });
      queryClient.invalidateQueries({ queryKey: ['product-offers', productId] });
    } catch (error) {
      console.error('Erro ao importar oferta:', error);
      toast({
        title: "Erro ao importar",
        description: "Não foi possível vincular a oferta",
        variant: "destructive",
      });
    } finally {
      setImporting(null);
    }
  };

  const handleRunBackfill = async () => {
    setRunningBackfill(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-kiwify-offer-ids');

      if (error) throw error;

      toast({
        title: "✅ Backfill concluído",
        description: `${data.fixed} eventos corrigidos`,
      });

      // Revalidar queries
      refetch();
      queryClient.invalidateQueries({ queryKey: ['kiwify-offer-stats'] });
    } catch (error) {
      console.error('Erro no backfill:', error);
      toast({
        title: "Erro no backfill",
        description: "Não foi possível executar a correção",
        variant: "destructive",
      });
    } finally {
      setRunningBackfill(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importar Ofertas do Kiwify
          </DialogTitle>
          <DialogDescription>
            Vincule ofertas Kiwify ao produto <strong>{productName}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Vendas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.withOfferId}</p>
              <p className="text-xs text-muted-foreground">Com Offer ID</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.withoutOfferId}</p>
              <p className="text-xs text-muted-foreground">Sem Offer ID</p>
            </div>
          </div>
        )}

        {/* Backfill Button */}
        {stats && stats.withoutOfferId > 0 && (
          <div className="flex items-center justify-between p-3 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">
                {stats.withoutOfferId} eventos sem offer_id
              </p>
              <p className="text-xs text-muted-foreground">
                Execute o backfill para extrair offer_id dos payloads
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunBackfill}
              disabled={runningBackfill}
            >
              {runningBackfill ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Corrigir Dados
            </Button>
          </div>
        )}

        {/* Lista de ofertas não mapeadas */}
        <ScrollArea className="h-[350px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : unmappedOffers && unmappedOffers.length > 0 ? (
            <div className="space-y-2">
              {unmappedOffers.map((offer) => (
                <div
                  key={offer.offer_id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {offer.offer_name || offer.offer_id}
                      </p>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {offer.total_sales} venda{offer.total_sales > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {offer.offer_id}
                      </code>
                      <span className="flex items-center text-xs text-green-600">
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                        R$ {offer.total_revenue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImportOffer(offer)}
                    disabled={importing === offer.offer_id}
                    className="shrink-0 ml-2"
                  >
                    {importing === offer.offer_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">Todas as ofertas estão mapeadas!</p>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
