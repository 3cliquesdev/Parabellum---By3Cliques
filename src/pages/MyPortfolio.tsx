import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolioClients } from "@/hooks/usePortfolioClients";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Search, Briefcase, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MyPortfolio() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = usePortfolioClients();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

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
            <h1 className="text-3xl font-bold">Minha Carteira</h1>
            <p className="text-muted-foreground">
              {clients?.length || 0} clientes ativos
            </p>
          </div>
        </div>
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

                      {/* Health Score */}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Saúde</span>
                        {getHealthIcon(client.health_score)}
                      </div>

                      {/* Actions */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/contacts/${client.id}`)}
                      >
                        Ver Detalhes
                      </Button>
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
    </div>
  );
}
