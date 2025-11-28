import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { AIInsightsWidget } from "@/components/widgets/AIInsightsWidget";
import { YoYComparisonWidget } from "@/components/widgets/YoYComparisonWidget";
import { ChannelQualityWidget } from "@/components/widgets/ChannelQualityWidget";
import { SalesLeaderboard } from "@/components/widgets/SalesLeaderboard";
import { AIUsageWidget } from "@/components/widgets/AIUsageWidget";
import { SentimentDistributionWidget } from "@/components/widgets/SentimentDistributionWidget";
import { SupportKPIsWidget } from "@/components/widgets/SupportKPIsWidget";
import { VolumeResolutionWidget } from "@/components/widgets/VolumeResolutionWidget";
import { BusyHoursHeatmap } from "@/components/widgets/BusyHoursHeatmap";
import { ChatConversionFunnel } from "@/components/widgets/ChatConversionFunnel";
import { RevenueByChannelWidget } from "@/components/widgets/RevenueByChannelWidget";
import { TeamPerformanceTable } from "@/components/widgets/TeamPerformanceTable";
import { ChurnAnalyticsWidget } from "@/components/widgets/ChurnAnalyticsWidget";
import { CadencePerformanceWidget } from "@/components/widgets/CadencePerformanceWidget";
import { ChannelPerformanceComparison } from "@/components/widgets/ChannelPerformanceComparison";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { BarChart3, Sparkles, CalendarIcon, Headphones, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

type PeriodFilter = {
  type: 'preset' | 'custom';
  daysBack?: number;
  dateRange?: DateRange;
};

export default function Analytics() {
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>({
    type: 'preset',
    daysBack: 90
  });

  // Calculate period BEFORE any conditional return (React Hooks Rule)
  const { startDate, endDate, daysBack } = useMemo(() => {
    if (periodFilter.type === 'custom' && periodFilter.dateRange?.from && periodFilter.dateRange?.to) {
      return {
        startDate: periodFilter.dateRange.from,
        endDate: periodFilter.dateRange.to,
        daysBack: Math.ceil((periodFilter.dateRange.to.getTime() - periodFilter.dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
      };
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (periodFilter.daysBack || 90));
      return { 
        startDate: start, 
        endDate: end,
        daysBack: periodFilter.daysBack || 90
      };
    }
  }, [periodFilter]);

  // Permission validation - only admin and manager can access Analytics
  useEffect(() => {
    if (!roleLoading && role !== null && role === 'sales_rep') {
      navigate('/dashboard');
    }
  }, [roleLoading, role, navigate]);

  if (roleLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (role === 'sales_rep') {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                  Analytics 2.0
                  <Sparkles className="h-6 w-6 text-primary" />
                </h1>
                <p className="text-muted-foreground">
                  Business Intelligence com Métricas Operacionais Avançadas
                </p>
              </div>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-4">
              <Tabs 
                value={periodFilter.type === 'preset' ? String(periodFilter.daysBack) : 'custom'}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    setPeriodFilter({ type: 'custom' });
                  } else {
                    setPeriodFilter({ type: 'preset', daysBack: parseInt(value) });
                  }
                }}
              >
                <TabsList>
                  <TabsTrigger value="1">Hoje</TabsTrigger>
                  <TabsTrigger value="7">7 dias</TabsTrigger>
                  <TabsTrigger value="30">30 dias</TabsTrigger>
                  <TabsTrigger value="90">90 dias</TabsTrigger>
                  <TabsTrigger value="custom">Customizado</TabsTrigger>
                </TabsList>
              </Tabs>

              {periodFilter.type === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[280px] justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodFilter.dateRange?.from && periodFilter.dateRange?.to
                        ? `${format(periodFilter.dateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(periodFilter.dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                        : "Selecione o período"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={periodFilter.dateRange}
                      onSelect={(range) => setPeriodFilter({
                        type: 'custom',
                        dateRange: range
                      })}
                      numberOfMonths={2}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </div>

        {/* Main Tabs: Support vs Sales Performance */}
        <Tabs defaultValue="support" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="support" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Performance de Atendimento
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Comercial
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Support Performance */}
          <TabsContent value="support" className="space-y-6">
            {/* The 3 Clocks: FRT, MTTR, CSAT */}
            <SupportKPIsWidget startDate={startDate} endDate={endDate} />

            {/* Churn Analytics - Global View */}
            <ChurnAnalyticsWidget />

            {/* Volume vs Resolution + Busy Hours Heatmap */}
            <div className="grid gap-6 md:grid-cols-2">
              <VolumeResolutionWidget startDate={startDate} endDate={endDate} />
              <BusyHoursHeatmap startDate={startDate} endDate={endDate} />
            </div>

            {/* AI Insights + Sentiment Distribution */}
            <div className="grid gap-6 md:grid-cols-2">
              <AIInsightsWidget startDate={startDate} endDate={endDate} />
              <SentimentDistributionWidget startDate={startDate} endDate={endDate} />
            </div>

            {/* AI Usage */}
            <div className="w-full">
              <AIUsageWidget startDate={startDate} endDate={endDate} />
            </div>
          </TabsContent>

          {/* TAB 2: Sales Performance */}
          <TabsContent value="sales" className="space-y-6">
            {/* Cadence Performance - Full Width */}
            <CadencePerformanceWidget />
            
            {/* Channel Performance Comparison - Full Width */}
            <ChannelPerformanceComparison startDate={startDate} endDate={endDate} />
            
            {/* Chat Conversion Funnel - Full Width */}
            <ChatConversionFunnel startDate={startDate} endDate={endDate} />

            {/* Revenue by Channel + Channel Quality */}
            <div className="grid gap-6 md:grid-cols-2">
              <RevenueByChannelWidget startDate={startDate} endDate={endDate} />
              <ChannelQualityWidget startDate={startDate} endDate={endDate} />
            </div>

            {/* Conversion Rate Trend */}
            <ConversionRateWidget daysBack={daysBack} />

            {/* YoY Comparison */}
            <YoYComparisonWidget startDate={startDate} endDate={endDate} />

            {/* Sales Leaderboard */}
            <SalesLeaderboard />
          </TabsContent>
        </Tabs>

        {/* Team Performance Table - Always Visible */}
        <div className="w-full border-t pt-6">
          <TeamPerformanceTable startDate={startDate} endDate={endDate} />
        </div>
      </div>
    </div>
  );
}
