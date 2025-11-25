import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { AIInsightsWidget } from "@/components/widgets/AIInsightsWidget";
import { YoYComparisonWidget } from "@/components/widgets/YoYComparisonWidget";
import { ChannelQualityWidget } from "@/components/widgets/ChannelQualityWidget";
import { SalesLeaderboard } from "@/components/widgets/SalesLeaderboard";
import { AIUsageWidget } from "@/components/widgets/AIUsageWidget";
import { SentimentDistributionWidget } from "@/components/widgets/SentimentDistributionWidget";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { BarChart3, Sparkles, CalendarIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  // CRITICAL: Calcular período ANTES de qualquer conditional return (React Hooks Rule)
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

  // Validação de permissões - apenas admin e manager podem acessar Analytics
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
                  Análises profundas e Business Intelligence
                </p>
              </div>
            </div>

            {/* Filtro de Período */}
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

        {/* AI Insights - Full Width Destaque */}
        <div className="w-full">
          <AIInsightsWidget startDate={startDate} endDate={endDate} />
        </div>

        {/* YoY Comparison + Channel Quality - 2 Columns */}
        <div className="grid gap-6 md:grid-cols-2">
          <YoYComparisonWidget startDate={startDate} endDate={endDate} />
          <ChannelQualityWidget startDate={startDate} endDate={endDate} />
        </div>

        {/* Conversion Rate Trend - Full Width */}
        <div className="w-full">
          <ConversionRateWidget daysBack={daysBack} />
        </div>

        {/* Sales Leaderboard - Full Width */}
        <div className="w-full">
          <SalesLeaderboard />
        </div>

        {/* AI Metrics Section - 2 Columns */}
        <div className="w-full border-t pt-6 mt-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Métricas de Inteligência Artificial</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <AIUsageWidget startDate={startDate} endDate={endDate} />
            <SentimentDistributionWidget startDate={startDate} endDate={endDate} />
          </div>
        </div>
      </div>
    </div>
  );
}
