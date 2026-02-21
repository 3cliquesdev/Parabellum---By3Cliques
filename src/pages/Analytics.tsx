import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { BarChart3, Sparkles, LayoutGrid, TrendingUp, Headphones, UserMinus, Target, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { TeamPerformanceTable } from "@/components/widgets/TeamPerformanceTable";

// Unified Tabs
import { GlobalFilters } from "@/components/analytics/GlobalFilters";
import { UnifiedOverviewTab } from "@/components/analytics/UnifiedOverviewTab";
import { SalesSubscriptionsTab } from "@/components/analytics/SalesSubscriptionsTab";
import { ChurnAnalysisTab } from "@/components/analytics/ChurnAnalysisTab";
import { PerformanceTab } from "@/components/analytics/PerformanceTab";
import { SupportTab } from "@/components/analytics/SupportTab";
import { AdvancedTab } from "@/components/analytics/AdvancedTab";

export default function Analytics() {
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { from: start, to: end };
  });

  const { startDate, endDate } = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return { startDate: dateRange.from, endDate: dateRange.to };
    }
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    return { startDate: start, endDate: end };
  }, [dateRange]);

  useEffect(() => {
    if (!roleLoading && role !== null && role === 'sales_rep') {
      navigate('/');
    }
  }, [roleLoading, role, navigate]);

  if (roleLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (role === 'sales_rep') return null;

  return (
    <div className="container mx-auto p-6 min-w-0 max-w-full overflow-x-hidden bg-slate-50/50 dark:bg-background">
      <div className="space-y-6 min-w-0 max-w-full">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shadow-sm">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Dashboard Premium
              <Sparkles className="h-5 w-5 text-primary" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Business Intelligence Unificado
            </p>
            <Link
              to="/?tab=vendas"
              className="text-xs text-primary hover:underline mt-1 inline-block"
            >
              Ver Dashboard de Vendas (Sistema)
            </Link>
          </div>
        </div>

        {/* Global Filters */}
        <GlobalFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
        />

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-12 bg-card shadow-sm">
            <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Visão Geral</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Vendas</span>
            </TabsTrigger>
            <TabsTrigger value="churn" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <UserMinus className="h-4 w-4" />
              <span className="hidden sm:inline">Churn</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Headphones className="h-4 w-4" />
              <span className="hidden sm:inline">Suporte</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Avançado</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <UnifiedOverviewTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            <SalesSubscriptionsTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="churn" className="space-y-6">
            <ChurnAnalysisTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <PerformanceTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <SupportTab startDate={startDate} endDate={endDate} />
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <AdvancedTab startDate={startDate} endDate={endDate} />
          </TabsContent>
        </Tabs>

        {/* Team Performance - Always Visible */}
        <div className="border-t pt-6">
          <TeamPerformanceTable startDate={startDate} endDate={endDate} />
        </div>
      </div>
    </div>
  );
}
