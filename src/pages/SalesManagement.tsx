import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesManagerKPIs } from "@/hooks/useSalesManagerKPIs";
import { useSalesRepPerformance } from "@/hooks/useSalesRepPerformance";
import { useRottenDeals } from "@/hooks/useRottenDeals";
import { DollarSign, TrendingUp, Zap, Flame, Eye, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function SalesManagement() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpisLoading } = useSalesManagerKPIs();
  const { data: salesReps, isLoading: salesRepsLoading } = useSalesRepPerformance();
  const { data: rottenDeals, isLoading: rottenLoading } = useRottenDeals();
  
  // Pagination state for team table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil((salesReps?.length || 0) / itemsPerPage);
  const paginatedSalesReps = salesReps?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Prepare data for donut chart
  const funnelData = kpis?.funnelDistribution.map((stage, index) => ({
    name: stage.stageName,
    value: stage.count,
    color: `hsl(${221.2 - (index * 20)}, 83.2%, ${53.3 + (index * 10)}%)`,
  })) || [];
  
  const totalDealsInFunnel = funnelData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Layout>
      <div className="container mx-auto p-3 md:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard do Gerente de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão estratégica da operação comercial</p>
          </div>
        </div>

        {/* KPIs Compactos - Grid 4 colunas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pipeline Total */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pipeline Total</span>
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-foreground truncate">{formatCurrency(kpis?.pipelineTotal || 0)}</div>
                <p className="text-xs text-muted-foreground">Valor em aberto</p>
              </>
            )}
          </Card>

          {/* Vendas do Mês */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendas do Mês</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-bold text-foreground truncate">{formatCurrency(kpis?.revenueWonThisMonth || 0)}</div>
                <p className="text-xs text-muted-foreground">{kpis?.dealsWonThisMonth || 0} deals ganhos</p>
              </>
            )}
          </Card>

          {/* Taxa de Conversão */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversão</span>
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-3xl font-bold text-foreground">{kpis?.conversionRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Won vs Total</p>
              </>
            )}
          </Card>

          {/* Hot Deals */}
          <Card className="p-4 h-28 flex flex-col justify-between">
            {kpisLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Hot Deals</span>
                  <Flame className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-3xl font-bold text-foreground">{kpis?.hotDealsCount || 0}</div>
                <p className="text-xs text-muted-foreground">Fechando em 7 dias</p>
              </>
            )}
          </Card>
        </div>

        {/* Seção Visual - 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Gráfico de Rosca - Distribuição do Funil */}
          <Card className="p-5">
            <h3 className="text-base font-semibold text-foreground mb-3">📊 Distribuição do Funil</h3>
            {kpisLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="relative h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={funnelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {funnelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Número no centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-3xl font-bold text-foreground">{totalDealsInFunnel}</div>
                  <div className="text-xs text-muted-foreground">Deals</div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
              {funnelData.map((stage, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }}></div>
                  <span className="text-xs text-muted-foreground">{stage.name}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Negócios Estagnados - Compacto */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-semibold text-foreground">🚨 Negócios Estagnados</h3>
              <Badge variant="warning" className="text-xs">{kpis?.rottenDealsCount || 0}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Deals sem movimentação há mais de 14 dias. Ação imediata necessária.
            </p>

            {rottenLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : rottenDeals && rottenDeals.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {rottenDeals.slice(0, 5).map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{deal.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatCurrency(deal.value || 0)} • {deal.daysSinceUpdate} dias parado
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 flex-shrink-0" onClick={() => navigate(`/deals`)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum deal estagnado 🎉</p>
              </div>
            )}
          </Card>
        </div>

        {/* Performance do Time - Full Width + Paginação */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">📊 Performance do Time de Vendas</h2>
          
          {salesRepsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : salesReps && salesReps.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vendedor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pipeline</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vendas Mês</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Conversão</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Última Atividade</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSalesReps?.map((salesRep) => (
                      <tr 
                        key={salesRep.id} 
                        className="border-b hover:bg-accent/50 transition-colors cursor-pointer text-sm"
                        onClick={() => navigate(`/sales-management/rep/${salesRep.id}`)}
                      >
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={salesRep.avatar_url || undefined} />
                              <AvatarFallback>{salesRep.full_name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{salesRep.full_name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <span className="font-medium text-foreground">{formatCurrency(salesRep.pipeline_value)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({salesRep.deals_count})</span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="font-medium text-foreground">{formatCurrency(salesRep.won_this_month)}</span>
                        </td>
                        <td className="py-2 px-4">
                          <Badge variant={salesRep.conversion_rate >= 30 ? "success" : salesRep.conversion_rate >= 15 ? "warning" : "error"}>
                            {salesRep.conversion_rate.toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-sm text-muted-foreground">
                            {salesRep.last_activity 
                              ? formatDistanceToNow(new Date(salesRep.last_activity), { addSuffix: true, locale: ptBR })
                              : "Nunca"
                            }
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sales-management/rep/${salesRep.id}`);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, salesReps.length)} de {salesReps.length} vendedores
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
              <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum vendedor cadastrado</p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
