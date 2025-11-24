import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface MyTasksWidgetProps {
  userId?: string;
}

export function MyTasksWidget({ userId }: MyTasksWidgetProps) {
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["my-tasks", userId],
    queryFn: async () => {
      if (!userId) return null;

      // Buscar conversas não respondidas
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, status")
        .eq("assigned_to", userId)
        .eq("status", "open");

      if (convError) throw convError;

      const unreadConversations = conversations?.length || 0;

      // Buscar deals sem atividade (sem updated_at recente)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: deals, error: dealsError } = await supabase
        .from("deals")
        .select("id, updated_at")
        .eq("assigned_to", userId)
        .eq("status", "open")
        .lt("updated_at", threeDaysAgo.toISOString());

      if (dealsError) throw dealsError;

      const staleDeals = deals?.length || 0;

      // Total de pendências
      const totalPending = unreadConversations + staleDeals;

      return {
        unreadConversations,
        staleDeals,
        totalPending,
      };
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Minhas Tarefas
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
          <CheckCircle2 className="h-5 w-5" />
          Minhas Tarefas
        </CardTitle>
        <CardDescription>Atividades pendentes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Pendente</p>
            <p className="text-2xl font-bold text-foreground">{tasksData?.totalPending || 0}</p>
          </div>
          <AlertCircle className="h-8 w-8 text-primary" />
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Conversas não respondidas</p>
            </div>
            <p className="text-lg font-semibold text-foreground">{tasksData?.unreadConversations || 0}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Deals sem atividade (3+ dias)</p>
            </div>
            <p className="text-lg font-semibold text-foreground">{tasksData?.staleDeals || 0}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex gap-2">
          <Link to="/inbox" className="flex-1">
            <Button variant="outline" className="w-full">Ver Inbox</Button>
          </Link>
          <Link to="/deals" className="flex-1">
            <Button variant="outline" className="w-full">Ver Deals</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
