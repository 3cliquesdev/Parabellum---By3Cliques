import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DollarSign, TrendingUp, Target, Briefcase, Clock, PlusCircle, BarChart3,
  Eye, ChevronLeft, ChevronRight, Flame
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Hooks
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useSalesRepPerformance } from "@/hooks/useSalesRepPerformance";
import { useRottenDeals } from "@/hooks/useRottenDeals";

// Premium Widgets
import { DateRangePicker } from "@/components/DateRangePicker";
import { DashboardExportPDF } from "@/components/premium/DashboardExportPDF";
import { PremiumKPICard } from "@/components/widgets/premium/PremiumKPICard";
import { RevenueTimelineChart } from "@/components/widgets/premium/RevenueTimelineChart";
import { TopPerformersWidget } from "@/components/widgets/premium/TopPerformersWidget";
import { TeamActivitiesWidget } from "@/components/widgets/premium/TeamActivitiesWidget";
import { PipelineFunnelChart } from "@/components/widgets/premium/PipelineFunnelChart";
import { ConversionFunnelCard } from "@/components/widgets/ConversionFunnelCard";
import { StageConversionChart } from "@/components/widgets/StageConversionChart";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";

export default function SalesManagement() {
  const navigate = useNavigate();
  
  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  
  // Data hooks
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(dateRange);
  const { data: salesReps, isLoading: salesRepsLoading } = useSalesRepPerformance();
  const { data: rottenDeals, isLoading: rottenLoading } = useRottenDeals();
  const { data: conversionData, isLoading: conversionLoading } = useDealsConversionAnalysis(dateRange);
  
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto p-3 md:p-4 space-y-4">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Vendas</h1>
          <p className="text-sm text-muted-foreground">Métricas premium com filtro por período</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker 
            value={dateRange} 
            onChange={setDateRange}
          />
          <DashboardExportPDF 
            containerId="sales-management-content" 
            dateRange={dateRange}
          />
        </div>
      </div>
      
      <div id="sales-management-content" className="space-y-4">
        {/* ROW 1: KPIs Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PremiumKPICard
            title="Receita Fechada"
            value={formatCurrency(metrics?.revenueWon || 0)}
            subtitle="no período"
            change={metrics?.revenueChange}
            icon={DollarSign}
            iconColor="text-emerald-600"
            isLoading={metricsLoading}
            variant="success"
            tooltip="Receita total de deals ganhos no período selecionado"
          />
          <PremiumKPICard
            title="Pipeline Previsto"
            value={formatCurrency(metrics?.weightedPipeline || 0)}
            subtitle="ponderado por probabilidade"
            icon={BarChart3}
            iconColor="text-blue-600"
            isLoading={metricsLoading}
            tooltip="Soma dos valores de deals abertos multiplicados pela probabilidade"
          />
          <PremiumKPICard
            title="Taxa de Conversão"
            value={`${(metrics?.conversionRate || 0).toFixed(1)}%`}
            subtitle={`${metrics?.dealsWon || 0} ganhos / ${(metrics?.dealsWon || 0) + (metrics?.dealsLost || 0)} fechados`}
            change={metrics?.conversionChange}
            icon={Target}
            iconColor="text-purple-600"
            isLoading={metricsLoading}
            tooltip="Percentual de deals ganhos sobre total de deals fechados"
          />
          <PremiumKPICard
            title="Ciclo de Vendas"
            value={`${metrics?.avgSalesCycle || 0} dias`}
            subtitle="tempo médio até fechamento"
            change={metrics?.salesCycleChange}
            changeLabel="dias vs anterior"
            icon={Clock}
            iconColor="text-amber-600"
            isLoading={metricsLoading}
            tooltip="Média de dias desde criação até fechamento do deal"
          />
        </div>
        
        {/* ROW 2: KPIs Secundários */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <PremiumKPICard
            title="Pipeline Total"
            value={formatCurrency(metrics?.pipelineTotal || 0)}
            subtitle={`${metrics?.dealsOpen || 0} deals abertos`}
            icon={Briefcase}
            iconColor="text-primary"
            isLoading={metricsLoading}
          />
          <PremiumKPICard
            title="Deals Criados"
            value={conversionData?.totalCreated || 0}
            subtitle="no período"
            icon={PlusCircle}
            iconColor="text-blue-600"
            isLoading={conversionLoading}
          />
          <PremiumKPICard
            title="Deals Ganhos"
            value={metrics?.dealsWon || 0}
            subtitle="no período"
            icon={TrendingUp}
            iconColor="text-emerald-600"
            isLoading={metricsLoading}
            variant="success"
          />
          <PremiumKPICard
            title="Deals Perdidos"
            value={metrics?.dealsLost || 0}
            subtitle="no período"
            icon={Target}
            iconColor="text-red-500"
            isLoading={metricsLoading}
            variant="danger"
          />
          <PremiumKPICard
            title="Criados → Ganhos"
            value={`${(conversionData?.createdToWonRate || 0).toFixed(1)}%`}
            subtitle={`${conversionData?.totalWon || 0} de ${conversionData?.totalCreated || 0}`}
            icon={Target}
            iconColor="text-purple-600"
            isLoading={conversionLoading}
            tooltip="Percentual de deals ganhos sobre total de deals criados no período"
          />
        </div>
        
        {/* ROW 3: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenueTimelineChart dateRange={dateRange} />
          <PipelineFunnelChart />
        </div>
        
        {/* ROW 4: Conversão */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConversionFunnelCard dateRange={dateRange} />
          <StageConversionChart />
        </div>
        
        {/* ROW 4: Rankings + Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopPerformersWidget dateRange={dateRange} />
          <TeamActivitiesWidget dateRange={dateRange} />
        </div>

        {/* ROW 5: Negócios Estagnados */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-semibold text-foreground">Negócios Estagnados</h3>
            <Badge variant="warning" className="text-xs">{rottenDeals?.length || 0}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Deals sem movimentação há mais de 14 dias. Ação imediata necessária.
          </p>

          {rottenLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : rottenDeals && rottenDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rottenDeals.slice(0, 6).map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
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
              <Flame className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum deal estagnado</p>
            </div>
          )}
        </Card>

        {/* ROW 6: Performance do Time - Full Width + Paginação */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Performance do Time de Vendas</h2>
          
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
    </div>
  );
}
