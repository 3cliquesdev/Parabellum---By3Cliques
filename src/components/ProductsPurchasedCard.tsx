import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductsPurchasedCardProps {
  contactId: string;
}

export default function ProductsPurchasedCard({ contactId }: ProductsPurchasedCardProps) {
  const { data: wonDeals, isLoading } = useQuery({
    queryKey: ["won-deals-products", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id,
          title,
          value,
          currency,
          closed_at,
          products (
            id,
            name
          )
        `)
        .eq("contact_id", contactId)
        .eq("status", "won")
        .order("closed_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Produtos Comprados
          </CardTitle>
          {wonDeals && wonDeals.length > 0 && (
            <Badge variant="secondary">{wonDeals.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!wonDeals || wonDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum produto comprado
          </p>
        ) : (
          <div className="space-y-2">
            {wonDeals.map(deal => (
              <div 
                key={deal.id} 
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {deal.products?.name || deal.title}
                  </p>
                  <p className="text-xs text-green-500 font-semibold mt-1">
                    {formatCurrency(deal.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
