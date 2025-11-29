import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUsers } from "@/hooks/useUsers";
import { useCSGoals } from "@/hooks/useCSGoals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Briefcase, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Users, 
  TrendingDown, 
  UserPlus, 
  Phone, 
  Mail, 
  ArrowLeft,
  Send,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CSGoalDialog } from "@/components/CSGoalDialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ConsultantDetail() {
  const { id: consultantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [targetConsultantId, setTargetConsultantId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Get consultant info
  const consultant = users?.find(u => u.id === consultantId);

  // Fetch clients for this consultant
  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ["portfolio-clients", consultantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(`
          *,
          profiles!contacts_assigned_to_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq("consultant_id", consultantId)
        .eq("status", "customer")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate health scores and onboarding progress
      const enrichedClients = await Promise.all(
        (data || []).map(async (client) => {
          // Get onboarding steps
          const { data: steps } = await supabase
            .from("customer_journey_steps")
            .select("completed, is_critical")
            .eq("contact_id", client.id);

          const totalSteps = steps?.length || 0;
          const completedSteps = steps?.filter(s => s.completed).length || 0;
          const criticalPending = steps?.filter(s => s.is_critical && !s.completed).length || 0;
          const onboardingProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

          // Calculate health score
          const daysSinceContact = client.last_contact_date 
            ? Math.floor((new Date().getTime() - new Date(client.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          
          let healthScore: "green" | "yellow" | "red" = "green";
          if (daysSinceContact > 30) healthScore = "red";
          else if (daysSinceContact > 14) healthScore = "yellow";

          const isNewClient = client.created_at && 
            Math.floor((new Date().getTime() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)) <= 30;

          return {
            ...client,
            seller_name: client.profiles?.full_name || null,
            seller_avatar: client.profiles?.avatar_url || null,
            total_steps: totalSteps,
            completed_steps: completedSteps,
            critical_pending: criticalPending,
            onboarding_progress: onboardingProgress,
            health_score: healthScore,
            is_new_client: isNewClient,
          };
        })
      );

      return enrichedClients;
    },
    enabled: !!consultantId,
  });

  // Calculate KPIs
  const kpis = {
    totalClients: clients?.length || 0,
    totalRevenue: clients?.reduce((sum, c) => sum + (c.total_ltv || 0), 0) || 0,
    atRiskCount: clients?.filter(c => c.health_score === "red").length || 0,
    newArrivalsCount: clients?.filter(c => c.is_new_client).length || 0,
  };

  // Get current month for goals
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const { data: goals } = useCSGoals(consultantId, currentMonth);
  const existingGoal = goals?.[0];

  // Get other consultants for transfer
  const otherConsultants = users?.filter(
    u => u.role === "consultant" && u.id !== consultantId
  );

  // Filter clients based on tab
  const filteredClients = clients?.filter((client) => {
    const matchesSearch = 
      client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;

    if (!matchesSearch) return false;

    if (activeTab === "new") return client.is_new_client;
    if (activeTab === "onboarding") return client.critical_pending > 0;
    if (activeTab === "active") return client.onboarding_progress === 100;
    return true;
  });

  const getHealthIcon = (score: "green" | "yellow" | "red") => {
    if (score === "green") return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score === "yellow") return <Clock className="h-5 w-5 text-yellow-500" />;
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedClients.length === filteredClients?.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients?.map(c => c.id) || []);
    }
  };

  const handleTransferClients = async () => {
    if (!targetConsultantId || selectedClients.length === 0) {
      toast.error("Selecione um consultor de destino e pelo menos um cliente");
      return;
    }

    setIsTransferring(true);
    
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ consultant_id: targetConsultantId })
        .in("id", selectedClients);

      if (error) throw error;

      toast.success(`${selectedClients.length} cliente(s) transferido(s) com sucesso!`);
      setSelectedClients([]);
      setTransferDialogOpen(false);
      setTargetConsultantId("");
      refetch();
    } catch (error) {
      console.error("Error transferring clients:", error);
      toast.error("Erro ao transferir clientes");
    } finally {
      setIsTransferring(false);
    }
  };

  if (!consultant) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Consultor não encontrado</p>
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
          onClick={() => navigate("/cs-management")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16">
            <AvatarImage src={consultant.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {consultant.full_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{consultant.full_name}</h1>
            <p className="text-muted-foreground">
              {clients?.length || 0} clientes ativos • {consultant.email}
            </p>
          </div>
          <Badge variant="default">
            Consultor CS
          </Badge>
          <CSGoalDialog 
            consultantId={consultant.id}
            consultantName={consultant.full_name}
            existingGoal={existingGoal}
            currentMonth={currentMonth}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.totalClients}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes ativos sob gestão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Sob Gestão</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {kpis.totalRevenue.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor mensal total da carteira
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {kpis.atRiskCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Sem contato há mais de 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recém-Chegados</CardTitle>
            <UserPlus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {kpis.newArrivalsCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Finalizaram onboarding recentemente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CS Goals Info Banner */}
      {existingGoal && (
        <Card className="bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">🎯 Metas Definidas para Este Mês</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">GMV Target</p>
                    <p className="font-medium">R$ {existingGoal.target_gmv.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Upsell Target</p>
                    <p className="font-medium">R$ {existingGoal.target_upsell.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Churn Máximo</p>
                    <p className="font-medium">{existingGoal.max_churn_rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bônus</p>
                    <p className="font-medium">R$ {existingGoal.bonus_amount.toLocaleString("pt-BR")}</p>
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
                Nenhuma meta definida para este consultor neste mês. Clique em "Definir Meta" para configurar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table with Bulk Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="new">
                    Novos
                    {clients?.filter(c => c.is_new_client).length! > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {clients?.filter(c => c.is_new_client).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="onboarding">Em Onboarding</TabsTrigger>
                  <TabsTrigger value="active">Ativos</TabsTrigger>
                </TabsList>
              </Tabs>

              {selectedClients.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="default">{selectedClients.length} selecionado(s)</Badge>
                  <Button
                    size="sm"
                    onClick={() => setTransferDialogOpen(true)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Transferir Selecionados
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedClients([])}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Select All Checkbox */}
          {filteredClients && filteredClients.length > 0 && (
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Checkbox
                checked={selectedClients.length === filteredClients.length && filteredClients.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                Selecionar todos ({filteredClients.length})
              </span>
            </div>
          )}

          {/* Clients List */}
          <div className="space-y-4">
            {filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={() => toggleClientSelection(client.id)}
                      />

                      {/* Client Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {client.first_name[0]}{client.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {client.first_name} {client.last_name}
                            </p>
                            {client.is_new_client && (
                              <Badge variant="destructive" className="animate-pulse">
                                Novo Cliente
                              </Badge>
                            )}
                          </div>
                          {client.company && (
                            <p className="text-sm text-muted-foreground">{client.company}</p>
                          )}
                        </div>
                      </div>

                      {/* Subscription Plan */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Plano</span>
                        <Badge variant="outline">
                          {client.subscription_plan || "N/A"}
                        </Badge>
                      </div>

                      {/* Onboarding Progress */}
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Onboarding</span>
                          <span className="text-xs font-semibold">{client.onboarding_progress}%</span>
                        </div>
                        <Progress value={client.onboarding_progress} />
                      </div>

                      {/* Last Contact */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Último Contato</span>
                        <p className="text-sm">
                          {client.last_contact_date
                            ? formatDistanceToNow(new Date(client.last_contact_date), {
                                addSuffix: true,
                                locale: ptBR,
                              })
                            : "Nunca"}
                        </p>
                      </div>

                        {/* Health Score */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">Saúde</span>
                          <div className="flex items-center gap-1">
                            {getHealthIcon(client.health_score)}
                          </div>
                        </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2">
                        {client.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://wa.me/55${client.phone.replace(/\D/g, "")}`, "_blank")}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        {client.email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = `mailto:${client.email}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/contacts/${client.id}`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "Nenhum cliente encontrado com esse filtro"
                    : "Nenhum cliente na carteira"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Clientes</DialogTitle>
            <DialogDescription>
              Transferir {selectedClients.length} cliente(s) para outro consultor
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Consultor de Destino</label>
              <Select value={targetConsultantId} onValueChange={setTargetConsultantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o consultor" />
                </SelectTrigger>
                <SelectContent>
                  {otherConsultants?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setTransferDialogOpen(false)}
                disabled={isTransferring}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransferClients}
                disabled={!targetConsultantId || isTransferring}
              >
                {isTransferring ? "Transferindo..." : "Transferir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
