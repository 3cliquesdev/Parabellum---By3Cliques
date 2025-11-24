import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Calendar, Mail, BarChart3, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MyActivitiesWidget } from "@/components/widgets/MyActivitiesWidget";

export default function Dashboard() {
  const { role, loading } = useUserRole();
  const { user } = useAuth();

  // Query para contar tarefas pendentes
  const { data: pendingActivities } = useQuery({
    queryKey: ["pending-activities", user?.id, role],
    queryFn: async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      let query = supabase
        .from("activities")
        .select("id", { count: "exact" })
        .eq("completed", false)
        .lte("due_date", today.toISOString());

      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id && !loading,
  });

  // Query para contar novos leads hoje
  const { data: newLeadsToday } = useQuery({
    queryKey: ["new-leads-today", user?.id, role],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from("contacts")
        .select("id", { count: "exact" })
        .eq("status", "lead")
        .gte("created_at", today.toISOString());

      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id && !loading,
  });

  // Query para contar fechamentos desta semana
  const { data: dealsThisWeek } = useQuery({
    queryKey: ["deals-this-week", user?.id, role],
    queryFn: async () => {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      let query = supabase
        .from("deals")
        .select("id", { count: "exact" })
        .eq("status", "open")
        .gte("expected_close_date", startOfWeek.toISOString().split("T")[0])
        .lte("expected_close_date", endOfWeek.toISOString().split("T")[0]);

      if (role === "sales_rep" && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { count } = await query;
      return count || 0;
    },
    enabled: !!user?.id && !loading,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          {role === "sales_rep" ? "Meu Dashboard" : "Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {role === "sales_rep" ? "Suas tarefas e metas de hoje" : "Centro de ação imediata"}
        </p>
      </div>

      {/* LINHA 1: KPIs Essenciais (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {role === "sales_rep" ? "Minhas Tarefas Pendentes" : "Tarefas Pendentes"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {pendingActivities ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Atividades vencidas ou para hoje
            </p>
            <Button className="w-full mt-4" variant="outline" asChild>
              <Link to="/deals">Ver Todas</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-blue-500" />
              {role === "sales_rep" ? "Meus Novos Leads" : "Novos Leads Hoje"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {newLeadsToday ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Aguardando primeira ação
            </p>
            <Button className="w-full mt-4" variant="outline" asChild>
              <Link to="/contacts">Ver Leads</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Fechamentos Esta Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {dealsThisWeek ?? 0}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Com previsão de fechamento
            </p>
            <Button className="w-full mt-4" variant="outline" asChild>
              <Link to="/deals">Ver Hot Deals</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* LINHA 2: Atalhos Rápidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⚡ Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button className="h-20 flex flex-col gap-2" asChild>
              <Link to="/contacts">
                <Plus className="h-6 w-6" />
                Novo Lead
              </Link>
            </Button>
            <Button className="h-20 flex flex-col gap-2" variant="outline" asChild>
              <Link to="/deals">
                <Calendar className="h-6 w-6" />
                Nova Tarefa
              </Link>
            </Button>
            <Button className="h-20 flex flex-col gap-2" variant="outline" asChild>
              <Link to="/inbox">
                <Mail className="h-6 w-6" />
                Enviar Email
              </Link>
            </Button>
            <Button className="h-20 flex flex-col gap-2" variant="outline" asChild>
              <Link to="/analytics">
                <BarChart3 className="h-6 w-6" />
                Ver Análises
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LINHA 3: Agenda do Dia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📅 Agenda de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MyActivitiesWidget />
        </CardContent>
      </Card>
    </div>
  );
}
