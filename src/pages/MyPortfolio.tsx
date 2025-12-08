import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolioClients } from "@/hooks/usePortfolioClients";
import { usePortfolioKPIs } from "@/hooks/usePortfolioKPIs";
import { useManagerPortfolioClients } from "@/hooks/useManagerPortfolioClients";
import { useManagerPortfolioKPIs } from "@/hooks/useManagerPortfolioKPIs";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Search, Briefcase, AlertCircle, CheckCircle, Clock, DollarSign, Users, TrendingDown, UserPlus, Phone, Mail, FileText, UserCog } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import FocusTodayWidget from "@/components/FocusTodayWidget";
import ExpansionRadarWidget from "@/components/widgets/ExpansionRadarWidget";
import CommissionTrackerWidget from "@/components/widgets/CommissionTrackerWidget";
import EarlyWarningWidget from "@/components/widgets/EarlyWarningWidget";
import QBRGeneratorDialog from "@/components/QBRGeneratorDialog";
import { useChurnPrediction } from "@/hooks/useChurnPrediction";
import { CSGoalsWidget } from "@/components/widgets/CSGoalsWidget";
import { ChangeConsultantDialog } from "@/components/playbooks/ChangeConsultantDialog";

export default function MyPortfolio() {
  const navigate = useNavigate();
  const { isAdmin, isManager, isCSManager } = useUserRole();
  const { toast } = useToast();
  const isTeamView = isAdmin || isManager || isCSManager;
  const hasShownNotification = useRef(false);

  // Use different hooks based on role
  const { data: individualClients, isLoading: isLoadingIndividual } = usePortfolioClients();
  const { data: teamClients, isLoading: isLoadingTeam } = useManagerPortfolioClients();
  const { data: individualKPIs, isLoading: isLoadingIndividualKPIs } = usePortfolioKPIs();
  const { data: teamKPIs, isLoading: isLoadingTeamKPIs } = useManagerPortfolioKPIs();
  const { data: churnRisks } = useChurnPrediction();

  // Select appropriate data based on role
  const clients = isTeamView ? teamClients : individualClients;
  const kpis = isTeamView ? teamKPIs : individualKPIs;
  const isLoading = isTeamView ? isLoadingTeam : isLoadingIndividual;
  const isLoadingKPIs = isTeamView ? isLoadingTeamKPIs : isLoadingIndividualKPIs;

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Notificar consultor sobre novos clientes (apenas uma vez por sessão)
  useEffect(() => {
    if (!isLoading && clients && !hasShownNotification.current && !isTeamView) {
      const newClientsCount = clients.filter(c => c.is_new_client).length;
      
      if (newClientsCount > 0) {
        hasShownNotification.current = true;
        setActiveTab("new"); // Auto-switch to new clients tab
        toast({
          title: `🎉 Você tem ${newClientsCount} ${newClientsCount === 1 ? 'novo cliente' : 'novos clientes'}!`,
          description: "Confira os detalhes na aba 'Novos'.",
          duration: 8000,
        });
      }
    }
  }, [isLoading, clients, isTeamView, toast]);

  const [qbrDialogOpen, setQbrDialogOpen] = useState(false);
  const [selectedClientForQBR, setSelectedClientForQBR] = useState<{
    id: string;
    name: string;
    company: string | null;
  } | null>(null);

  // State for changing consultant
  const [changeConsultantData, setChangeConsultantData] = useState<{
    contactId: string;
    contactName: string;
    currentConsultantId: string | null;
  } | null>(null);

  // Filter clients based on tab
  const filteredClients = clients?.filter((client) => {
    // Search filter
    const matchesSearch = 
      client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      false;

    if (!matchesSearch) return false;

    // Tab filter
    if (activeTab === "new") return client.is_new_client;
    if (activeTab === "onboarding") return client.critical_pending > 0;
    if (activeTab === "active") return client.onboarding_progress === 100;
    return true; // "all" tab
  });

  const getHealthIcon = (score: "green" | "yellow" | "red") => {
    if (score === "green") return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score === "yellow") return <Clock className="h-5 w-5 text-yellow-500" />;
    return <AlertCircle className="h-5 w-5 text-red-500" />;
  };

  // Calcular tendência de health score para cada cliente
  const getHealthTrend = (clientId: string) => {
    const risk = churnRisks?.find(r => r.id === clientId);
    if (!risk) return null;
    
    if (risk.trend === "down") return "↘️";
    if (risk.trend === "up") return "↗️";
    return "→";
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isTeamView ? "Carteira da Equipe" : "Minha Carteira"}
            </h1>
            <p className="text-muted-foreground">
              {clients?.length || 0} clientes ativos {isTeamView ? "sob gestão da equipe" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingKPIs ? "..." : kpis?.totalClients || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes ativos sob sua gestão
            </p>
          </CardContent>
        </Card>

        {/* Revenue Under Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Sob Gestão</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingKPIs ? "..." : `R$ ${(kpis?.totalRevenue || 0).toLocaleString("pt-BR")}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor mensal total da carteira
            </p>
          </CardContent>
        </Card>

        {/* At Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {isLoadingKPIs ? "..." : kpis?.atRiskCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Sem contato há mais de 30 dias
            </p>
          </CardContent>
        </Card>

        {/* New Arrivals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recém-Chegados</CardTitle>
            <UserPlus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {isLoadingKPIs ? "..." : kpis?.newArrivalsCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Finalizaram onboarding recentemente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CS Goals Widget - Full Width (Individual consultants only) */}
      {!isTeamView && <CSGoalsWidget />}

      {/* Widgets Row - Bento Box Layout: Attack | Meta | Defense */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ExpansionRadarWidget />
        <CommissionTrackerWidget />
        <EarlyWarningWidget />
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
          {/* Clients Table */}
          <div className="space-y-4">
            {filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
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

                      {/* Consultant (Team View Only) */}
                      {isTeamView && 'consultant_name' in client && (
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Consultor</p>
                            <p className="text-sm font-medium">
                              {client.consultant_name || "Não atribuído"}
                            </p>
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={client.consultant_avatar || undefined} />
                            <AvatarFallback>
                              {client.consultant_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setChangeConsultantData({
                                contactId: client.id,
                                contactName: `${client.first_name} ${client.last_name}`,
                                currentConsultantId: client.consultant_id || null,
                              });
                            }}
                            title="Alterar Consultor"
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Original Seller */}
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Vendedor</p>
                          <p className="text-sm font-medium">{client.seller_name || "N/A"}</p>
                        </div>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={client.seller_avatar || undefined} />
                          <AvatarFallback>
                            {client.seller_name?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Onboarding Progress */}
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Onboarding</span>
                          <span className="text-xs font-semibold">{client.onboarding_progress}%</span>
                        </div>
                        <Progress value={client.onboarding_progress} />
                        <span className="text-xs text-muted-foreground">
                          {client.completed_steps}/{client.total_steps} etapas
                        </span>
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

                      {/* Health Score with Trend Arrow */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Saúde</span>
                        <div className="flex items-center gap-1">
                          {getHealthIcon(client.health_score)}
                          {getHealthTrend(client.id) && (
                            <span className="text-lg" title="Tendência de saúde">
                              {getHealthTrend(client.id)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2">
                        {client.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://wa.me/55${client.phone.replace(/\D/g, "")}`, "_blank")}
                            title="WhatsApp"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        {client.email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = `mailto:${client.email}`}
                            title="Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedClientForQBR({
                              id: client.id,
                              name: `${client.first_name} ${client.last_name}`,
                              company: client.company,
                            });
                            setQbrDialogOpen(true);
                          }}
                          title="Gerar Relatório QBR"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
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
                    : "Nenhum cliente na sua carteira ainda"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QBR Generator Dialog */}
      {selectedClientForQBR && (
        <QBRGeneratorDialog
          open={qbrDialogOpen}
          onOpenChange={setQbrDialogOpen}
          contactId={selectedClientForQBR.id}
          contactName={selectedClientForQBR.name}
          companyName={selectedClientForQBR.company}
        />
      )}

      {/* Change Consultant Dialog */}
      <ChangeConsultantDialog
        open={!!changeConsultantData}
        onOpenChange={(open) => !open && setChangeConsultantData(null)}
        contactId={changeConsultantData?.contactId || ""}
        contactName={changeConsultantData?.contactName || ""}
        currentConsultantId={changeConsultantData?.currentConsultantId}
      />
    </div>
  );
}
