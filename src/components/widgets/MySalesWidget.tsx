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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Minhas Vendas
        </CardTitle>
        <CardDescription>Suas vendas e performance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total de Vendas</p>
            <p className="text-2xl font-bold text-foreground">
              ${salesData?.totalSales.toLocaleString() || 0}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-primary" />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground">Fechados este mês</p>
            <p className="text-xl font-semibold text-foreground">{salesData?.dealsThisMonth || 0}</p>
          </div>
          <Target className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">Total de Deals Ganhos</p>
          <p className="text-xl font-semibold text-foreground">{salesData?.totalDeals || 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}
