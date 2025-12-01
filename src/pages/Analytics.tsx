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
import { AutomationROIWidget } from "@/components/widgets/AutomationROIWidget";
import { SLAComplianceWidget } from "@/components/widgets/SLAComplianceWidget";
import { TeamEfficiencyWidget } from "@/components/widgets/TeamEfficiencyWidget";
import { AIEconomyWidget } from "@/components/widgets/AIEconomyWidget";
import { TopTopicsWidget } from "@/components/widgets/TopTopicsWidget";
import { OnboardingFunnelWidget } from "@/components/widgets/OnboardingFunnelWidget";
import { WhatsAppTrafficWidget } from "@/components/widgets/WhatsAppTrafficWidget";
import { AIExecutiveSummary } from "@/components/widgets/AIExecutiveSummary";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { BarChart3, Sparkles, Headphones, TrendingUp, Brain, Rocket, MessageCircle, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRange } from "react-day-picker";
import { FinancialKPIsWidget } from "@/components/widgets/FinancialKPIsWidget";
import { RevenueBreakdownWidget } from "@/components/widgets/RevenueBreakdownWidget";
import { ProductMarginTable } from "@/components/widgets/ProductMarginTable";
import { TopAffiliatesWidget } from "@/components/widgets/TopAffiliatesWidget";

export default function Analytics() {
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('support');
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1); // Default: último mês
    return { from: start, to: end };
  });

  // Calculate period from dateRange
  const { startDate, endDate, daysBack } = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return {
        startDate: dateRange.from,
        endDate: dateRange.to,
        daysBack: Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))
      };
    } else {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return { 
        startDate: start, 
        endDate: end,
        daysBack: 30
      };
    }
  }, [dateRange]);

  // Permission validation - only admin and manager can access Analytics
  useEffect(() => {
  if (!roleLoading && role !== null && role === 'sales_rep') {
    navigate('/');
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

            {/* The Time Machine - Controle de Tempo Global */}
            <div className="w-full max-w-2xl">
              <DateRangePicker 
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
          </div>
        </div>

        {/* Main Tabs: Support, AI, Onboarding, WhatsApp, Sales, Financeiro */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="support" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Suporte
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Inteligência Artificial
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Onboarding
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Support Performance */}
          <TabsContent value="support" className="space-y-6">
            {/* AI Executive Summary */}
            <AIExecutiveSummary 
              data={{ 
                context: 'support',
                message: 'Aguardando coleta de KPIs para análise. Clique em "Gerar Análise" para processar.',
              }}
              context="support"
              startDate={startDate}
              endDate={endDate}
            />

            {/* The 3 Clocks: FRT, MTTR, CSAT */}
            <SupportKPIsWidget startDate={startDate} endDate={endDate} />

            {/* SLA Compliance + Team Efficiency */}
            <div className="grid gap-6 md:grid-cols-2">
              <SLAComplianceWidget startDate={startDate} endDate={endDate} />
              <TeamEfficiencyWidget startDate={startDate} endDate={endDate} />
            </div>

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

            {/* Churn Analytics */}
            <ChurnAnalyticsWidget />
          </TabsContent>

          {/* TAB 2: AI Analytics */}
          <TabsContent value="ai" className="space-y-6">
            {/* AI Executive Summary */}
            <AIExecutiveSummary 
              data={{ 
                context: 'ai',
                message: 'Aguardando coleta de métricas de IA para análise. Clique em "Gerar Análise" para processar.',
              }}
              context="ai"
              startDate={startDate}
              endDate={endDate}
            />

            {/* AI Economy Chart */}
            <AIEconomyWidget startDate={startDate} endDate={endDate} />

            {/* AI Usage + Top Topics */}
            <div className="grid gap-6 md:grid-cols-2">
              <AIUsageWidget startDate={startDate} endDate={endDate} />
              <TopTopicsWidget startDate={startDate} endDate={endDate} />
            </div>
          </TabsContent>

          {/* TAB 3: Onboarding Funnel */}
          <TabsContent value="onboarding" className="space-y-6">
            {/* AI Executive Summary */}
            <AIExecutiveSummary 
              data={{ 
                context: 'onboarding',
                message: 'Aguardando coleta de dados de onboarding para análise. Clique em "Gerar Análise" para processar.',
              }}
              context="onboarding"
              startDate={startDate}
              endDate={endDate}
            />

            <OnboardingFunnelWidget startDate={startDate} endDate={endDate} />
          </TabsContent>

          {/* TAB 4: WhatsApp Traffic */}
          <TabsContent value="whatsapp" className="space-y-6">
            {/* AI Executive Summary */}
            <AIExecutiveSummary 
              data={{ 
                context: 'whatsapp',
                message: 'Aguardando coleta de dados de WhatsApp para análise. Clique em "Gerar Análise" para processar.',
              }}
              context="whatsapp"
              startDate={startDate}
              endDate={endDate}
            />

            <WhatsAppTrafficWidget startDate={startDate} endDate={endDate} />
          </TabsContent>

          {/* TAB 5: Sales Performance */}
          <TabsContent value="sales" className="space-y-6">
            {/* AI Executive Summary */}
            <AIExecutiveSummary 
              data={{ 
                context: 'sales',
                message: 'Aguardando coleta de métricas de vendas para análise. Clique em "Gerar Análise" para processar.',
              }}
              context="sales"
              startDate={startDate}
              endDate={endDate}
            />

            {/* Cadence Performance - Full Width */}
            <CadencePerformanceWidget />
            
            {/* Channel Performance Comparison - Full Width */}
            <ChannelPerformanceComparison startDate={startDate} endDate={endDate} />
            
            {/* Automation ROI - Full Width */}
            <AutomationROIWidget />
            
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

          {/* TAB 6: Financeiro Kiwify */}
          <TabsContent value="financial" className="space-y-6">
            {/* AI Executive Summary */}
            <AIExecutiveSummary 
              data={{ 
                context: 'financial',
                message: 'Aguardando coleta de dados financeiros Kiwify para análise. Clique em "Gerar Análise" para processar.',
              }}
              context="financial"
              startDate={startDate}
              endDate={endDate}
            />

            {/* KPIs Financeiros (4 colunas) */}
            <FinancialKPIsWidget startDate={startDate} endDate={endDate} />

            {/* Top Afiliados (full width) */}
            <TopAffiliatesWidget startDate={startDate} endDate={endDate} />

            {/* Evolução de Receita */}
            <RevenueBreakdownWidget startDate={startDate} endDate={endDate} />

            {/* Tabela por Produto */}
            <ProductMarginTable startDate={startDate} endDate={endDate} />
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
