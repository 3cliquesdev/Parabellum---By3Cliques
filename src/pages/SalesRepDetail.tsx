import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUsers } from "@/hooks/useUsers";
import { useGoals } from "@/hooks/useGoals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  DollarSign, 
  TrendingUp, 
  Target, 
  CheckCircle, 
  ArrowLeft,
  Eye,
  AlertCircle
} from "lucide-react";
import { GoalDialog } from "@/components/GoalDialog";

export default function SalesRepDetail() {
  const { id: salesRepId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("open");

  // Get sales rep info
  const salesRep = users?.find(u => u.id === salesRepId);

  // Guard: ID não fornecido
  if (!salesRepId) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">ID do vendedor não fornecido</p>
      </div>
    );
  }

  // Get current month for goals
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const { data: goals } = useGoals(currentMonth, currentYear);
  const existingGoal = goals?.find(g => g.assigned_to === salesRepId);

  // Fetch deals for this sales rep
  const { data: deals, isLoading } = useQuery({
    queryKey: ["sales-rep-deals", salesRepId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(`
          *,
          contacts (first_name, last_name, email, phone),
          organizations (name),
          stages (name)
        `)
        .eq("assigned_to", salesRepId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!salesRepId,
  });

  // Calculate KPIs
  const openDeals = deals?.filter(d => d.status === "open") || [];
  const wonDeals = deals?.filter(d => d.status === "won") || [];
  const lostDeals = deals?.filter(d => d.status === "lost") || [];
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const wonThisMonth = wonDeals.filter(d => 
    d.closed_at && new Date(d.closed_at) >= startOfMonth
  );

  const kpis = {
    pipelineValue: openDeals.reduce((sum, d) => sum + (d.value || 0), 0),
    wonThisMonth: wonThisMonth.reduce((sum, d) => sum + (d.value || 0), 0),
    conversionRate: (wonDeals.length + lostDeals.length) > 0 
      ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 
      : 0,
    pendingActivities: 0, // TODO: Fetch from activities table
  };

  // Filter deals based on tab
  const filteredDeals = deals?.filter((deal) => {
    const matchesSearch = 
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.contacts as any)?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.contacts as any)?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;

    if (!matchesSearch) return false;

    if (activeTab === "open") return deal.status === "open";
    if (activeTab === "won") return deal.status === "won";
    if (activeTab === "lost") return deal.status === "lost";
    return true;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!salesRep) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Vendedor não encontrado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/sales-management")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16">
            <AvatarImage src={salesRep.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {salesRep.full_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{salesRep.full_name}</h1>
            <p className="text-muted-foreground">
              {deals?.length || 0} deals totais • {salesRep.email}
            </p>
          </div>
          <Badge variant="default">
            Vendedor
          </Badge>
          <GoalDialog />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis.pipelineValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {openDeals.length} deals em aberto
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis.wonThisMonth)}
            </div>
            <p className="text-xs text-muted-foreground">
              {wonThisMonth.length} deals fechados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.conversionRate.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Taxa de fechamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividades</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.pendingActivities}
            </div>
            <p className="text-xs text-muted-foreground">
              Atividades pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals Info Banner */}
      {existingGoal && (
        <Card className="bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">🎯 Metas Definidas para Este Mês</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Meta de Vendas</p>
                    <p className="font-medium">R$ {existingGoal.target_value.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Comissão</p>
                    <p className="font-medium">{existingGoal.commission_rate || 0}%</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!existingGoal && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                Nenhuma meta definida para este vendedor neste mês. Clique em "Definir Meta" para configurar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="open">
                  Abertos ({openDeals.length})
                </TabsTrigger>
                <TabsTrigger value="won">
                  Ganhos ({wonDeals.length})
                </TabsTrigger>
                <TabsTrigger value="lost">
                  Perdidos ({lostDeals.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar deal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {filteredDeals && filteredDeals.length > 0 ? (
              filteredDeals.map((deal) => (
                <Card key={deal.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{deal.title}</h4>
                          <Badge variant={
                            deal.status === "won" ? "success" : 
                            deal.status === "lost" ? "error" : 
                            "default"
                          }>
                            {deal.status === "won" ? "Ganho" : 
                             deal.status === "lost" ? "Perdido" : 
                             (deal.stages as any)?.name || "Aberto"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {(deal.contacts as any)?.first_name} {(deal.contacts as any)?.last_name}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(deal.value || 0)}
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => navigate(`/deals`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum deal encontrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
