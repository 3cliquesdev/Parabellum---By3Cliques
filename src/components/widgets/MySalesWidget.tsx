import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Target } from "lucide-react";

interface MySalesWidgetProps {
  userId?: string;
}

export function MySalesWidget({ userId }: MySalesWidgetProps) {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["my-sales", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("deals")
        .select("value, status, closed_at")
        .eq("assigned_to", userId)
        .eq("status", "won");

      if (error) throw error;

      const totalSales = data?.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0) || 0;
      const dealsThisMonth = data?.filter((deal) => {
        const closedDate = new Date(deal.closed_at || "");
        const now = new Date();
        return (
          closedDate.getMonth() === now.getMonth() &&
          closedDate.getFullYear() === now.getFullYear()
        );
      }).length || 0;

      return {
        totalSales,
        dealsThisMonth,
        totalDeals: data?.length || 0,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Minhas Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-slate-400" />
          Minhas Vendas
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total de Vendas</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(salesData?.totalSales || 0)}
            </p>
          </div>
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Fechados este mês</p>
            <p className="text-lg font-semibold">{salesData?.dealsThisMonth || 0}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Ganhos</p>
            <p className="text-lg font-semibold">{salesData?.totalDeals || 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
