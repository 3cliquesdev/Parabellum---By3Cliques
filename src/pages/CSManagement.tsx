import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCSManagerKPIs } from "@/hooks/useCSManagerKPIs";
import { useConsultantPerformance } from "@/hooks/useConsultantPerformance";
import { useCriticalClients } from "@/hooks/useCriticalClients";
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Eye, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function CSManagement() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpisLoading } = useCSManagerKPIs();
  const { data: consultants, isLoading: consultantsLoading } = useConsultantPerformance();
  const { data: criticalClients, isLoading: criticalLoading } = useCriticalClients();
  
  // Pagination state for team table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil((consultants?.length || 0) / itemsPerPage);
  const paginatedConsultants = consultants?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getHealthBadge = (score: number) => {
    if (score >= 1.5) return { label: "Saudável", variant: "success" as const };
    if (score >= 0.75) return { label: "Atenção", variant: "warning" as const };
    return { label: "Crítico", variant: "error" as const };
  };

  // Prepare data for donut chart
  const healthData = [
    { name: 'Saudável', value: kpis?.healthDistribution.green || 0, color: 'hsl(142.1 76.2% 36.3%)' },
    { name: 'Atenção', value: kpis?.healthDistribution.yellow || 0, color: 'hsl(38 92% 50%)' },
    { name: 'Crítico', value: kpis?.healthDistribution.red || 0, color: 'hsl(0 72.2% 50.6%)' },
  ];
  
  const totalClients = (kpis?.healthDistribution.green || 0) + 
                       (kpis?.healthDistribution.yellow || 0) + 
                       (kpis?.healthDistribution.red || 0);

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard do Gerente de CS</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão estratégica da operação de Customer Success</p>
          </div>
        </div>

        {/* KPIs Compactos - Grid 4 colunas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ARR Total */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">ARR Total</span>
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-foreground truncate">{formatCurrency(kpis?.arrTotal || 0)}</div>
                <p className="text-xs text-muted-foreground">Receita Recorrente Anual</p>
              </>
            )}
          </Card>

          {/* Churn Rate */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Churn Rate</span>
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">{kpis?.churnRateMonthly.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Perdas este mês</p>
              </>
            )}
          </Card>

          {/* Expansão (Upsell) */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Expansão</span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-foreground truncate">{formatCurrency(kpis?.upsellRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">Upsell este mês</p>
              </>
            )}
          </Card>

          {/* Saúde da Base - Números Simples */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Saúde da Base</span>
                  <Users className="w-4 h-4 text-slate-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">{totalClients}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-medium">{kpis?.healthDistribution.green || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-xs font-medium">{kpis?.healthDistribution.yellow || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-xs font-medium">{kpis?.healthDistribution.red || 0}</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Seção Visual - 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico de Rosca - Saúde da Base */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-foreground mb-3">Distribuição de Saúde</h3>
            {kpisLoading ? (
              <Skeleton className="h-56" />
            ) : (
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {healthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Número no centro - Apple Style */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-3xl font-bold text-foreground">{totalClients}</div>
                  <div className="text-xs text-muted-foreground">Clientes</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-xs text-muted-foreground">Saudável</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-xs text-muted-foreground">Atenção</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span className="text-xs text-muted-foreground">Crítico</span>
              </div>
            </div>
          </Card>

          {/* Clientes em UTI - Compacto */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-base font-semibold text-foreground">🚨 Clientes em UTI</h3>
              <Badge variant="error" className="text-xs">{criticalClients?.length || 0}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Top clientes de maior valor com saúde crítica. Ação imediata necessária.
            </p>

            {criticalLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : criticalClients && criticalClients.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                {criticalClients.slice(0, 5).map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={client.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{client.first_name[0]}{client.last_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{client.first_name} {client.last_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{formatCurrency(client.total_ltv)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {client.phone && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.open(`https://wa.me/${client.phone}`, "_blank")}>
                          <Phone className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate(`/contacts/${client.id}`)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum cliente crítico 🎉</p>
              </div>
            )}
          </Card>
        </div>

        {/* Performance do Time - Full Width + Paginação */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">📊 Performance do Time de CS</h2>
          
          {consultantsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : consultants && consultants.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Consultor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Carteira</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor da Carteira</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Saúde Média</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Última Atividade</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedConsultants?.map((consultant) => {
                      const healthBadge = getHealthBadge(consultant.avg_health_score);
                      
                      return (
                        <tr 
                          key={consultant.id} 
                          className="border-b hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/cs-management/consultant/${consultant.id}`)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={consultant.avatar_url || undefined} />
                                <AvatarFallback>{consultant.full_name[0]}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-foreground">{consultant.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-foreground">{consultant.portfolio_count} clientes</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-foreground">{formatCurrency(consultant.portfolio_value)}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={healthBadge.variant}>{healthBadge.label}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-muted-foreground">
                              {consultant.last_activity 
                                ? formatDistanceToNow(new Date(consultant.last_activity), { addSuffix: true, locale: ptBR })
                                : "Nunca"
                              }
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/cs-management/consultant/${consultant.id}`);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Detalhes
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, consultants.length)} de {consultants.length} consultores
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum consultor cadastrado</p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}