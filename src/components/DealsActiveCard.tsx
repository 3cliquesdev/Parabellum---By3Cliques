import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DealsActiveCardProps {
  contactId: string;
}

export default function DealsActiveCard({ contactId }: DealsActiveCardProps) {
  const navigate = useNavigate();

  const { data: openDeals, isLoading } = useQuery({
    queryKey: ["open-deals", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          id,
          title,
          value,
          currency,
          status,
          stage_id,
          stages (
            id,
            name
          )
        `)
        .eq("contact_id", contactId)
        .eq("status", "open");

      if (error) throw error;
      return data || [];
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
              <Skeleton key={i} className="h-20 w-full" />
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
            <TrendingUp className="h-5 w-5 text-primary" />
            Negócios Ativos
          </CardTitle>
          {openDeals.length > 0 && (
            <Badge variant="secondary">{openDeals.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {openDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum negócio ativo
          </p>
        ) : (
          <div className="space-y-2">
            {openDeals.map(deal => (
              <div 
                key={deal.id} 
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate('/deals')}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-medium text-sm truncate">{deal.title}</p>
                  {deal.stages && (
                    <Badge variant="outline" className="mt-1">
                      {deal.stages.name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 text-green-500 font-bold whitespace-nowrap">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">
                    {formatCurrency(deal.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
