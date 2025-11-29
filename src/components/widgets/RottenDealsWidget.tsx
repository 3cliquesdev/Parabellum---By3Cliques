import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skull } from "lucide-react";
import { useRottenDeals } from "@/hooks/useRottenDeals";
import { useNavigate } from "react-router-dom";

export default function RottenDealsWidget() {
  const { data: rottenDeals, isLoading } = useRottenDeals();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5 text-destructive" />
            Negócios Estagnados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topRottenDeals = rottenDeals?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Skull className="h-5 w-5 text-destructive" />
          Negócios Estagnados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topRottenDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum negócio estagnado! 🎉
          </p>
        ) : (
          <div className="space-y-3">
            {topRottenDeals.map((deal) => (
              <div
                key={deal.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onClick={() => navigate("/deals")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{deal.title}</p>
                    {deal.contacts && (
                      <p className="text-xs text-muted-foreground truncate">
                        {deal.contacts.first_name} {deal.contacts.last_name}
                      </p>
                    )}
                  </div>
                  <Badge variant="cold" className="text-xs whitespace-nowrap">
                    {deal.daysSinceUpdate}d
                  </Badge>
                </div>
                {deal.value && (
                  <p className="text-sm font-semibold text-success mt-1">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: deal.currency || "BRL",
                    }).format(deal.value)}
                  </p>
                )}
              </div>
            ))}
            {rottenDeals && rottenDeals.length > 5 && (
              <button
                onClick={() => navigate("/deals?filter=rotten")}
                className="w-full text-sm text-primary hover:underline mt-2"
              >
                Ver todos ({rottenDeals.length})
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
