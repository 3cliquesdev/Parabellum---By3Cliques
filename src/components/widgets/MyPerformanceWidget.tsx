import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, TrendingUp, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface MyPerformanceWidgetProps {
  userId?: string;
}

export function MyPerformanceWidget({ userId }: MyPerformanceWidgetProps) {
  const { data: performanceData, isLoading } = useQuery({
    queryKey: ["my-performance", userId],
    queryFn: async () => {
      if (!userId) return null;

      // Buscar vendas do usuário este mês
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: myDeals, error } = await supabase
        .from("deals")
        .select("value")
        .eq("assigned_to", userId)
        .eq("status", "won")
        .gte("closed_at", firstDayOfMonth.toISOString());

      if (error) throw error;

      const mySales = myDeals?.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0) || 0;

      // Buscar todas as vendas do time para ranking (apenas users com role sales_rep ou manager)
      const { data: allUsers, error: usersError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["sales_rep", "manager"]);

      if (usersError) throw usersError;

      const userIds = allUsers?.map((u) => u.user_id) || [];

      const { data: allDeals, error: allDealsError } = await supabase
        .from("deals")
        .select("assigned_to, value")
        .in("assigned_to", userIds)
        .eq("status", "won")
        .gte("closed_at", firstDayOfMonth.toISOString());

      if (allDealsError) throw allDealsError;

      // Agrupar vendas por vendedor
      const salesByUser = allDeals?.reduce((acc, deal) => {
        const assignedTo = deal.assigned_to || "";
        if (!acc[assignedTo]) acc[assignedTo] = 0;
        acc[assignedTo] += Number(deal.value) || 0;
        return acc;
      }, {} as Record<string, number>) || {};

      // Ordenar vendedores por valor
      const sortedSales = Object.entries(salesByUser).sort(([, a], [, b]) => b - a);
      const myRank = sortedSales.findIndex(([id]) => id === userId) + 1;
      const totalSellers = sortedSales.length;

      // Meta fictícia (pode vir de uma tabela de metas)
      const monthlyGoal = 50000;
      const goalProgress = monthlyGoal > 0 ? Math.min((mySales / monthlyGoal) * 100, 100) : 0;

      return {
        mySales,
        myRank,
        totalSellers,
        monthlyGoal,
        goalProgress,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Minha Performance
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
          <Award className="h-5 w-5" />
          Minha Performance
        </CardTitle>
        <CardDescription>Seu desempenho no time</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Ranking no Time</p>
            <p className="text-2xl font-bold text-foreground">
              #{performanceData?.myRank || "-"} de {performanceData?.totalSellers || "-"}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-primary" />
        </div>

        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Meta Mensal</p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              ${performanceData?.mySales.toLocaleString()} / ${performanceData?.monthlyGoal.toLocaleString()}
            </p>
          </div>
          <Progress value={performanceData?.goalProgress || 0} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {performanceData?.goalProgress.toFixed(1)}% da meta
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">Vendas Este Mês</p>
          <p className="text-xl font-semibold text-foreground">
            ${performanceData?.mySales.toLocaleString() || 0}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
