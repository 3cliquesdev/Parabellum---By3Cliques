import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Rocket, MessageCircle, DollarSign, TrendingUp } from "lucide-react";

// AI Widgets
import { AIExecutiveSummary } from "@/components/widgets/AIExecutiveSummary";
import { AIEconomyWidget } from "@/components/widgets/AIEconomyWidget";
import { AIUsageWidget } from "@/components/widgets/AIUsageWidget";
import { TopTopicsWidget } from "@/components/widgets/TopTopicsWidget";

// Onboarding
import { OnboardingFunnelWidget } from "@/components/widgets/OnboardingFunnelWidget";
import { CSEmailFunnelWidget } from "@/components/widgets/CSEmailFunnelWidget";

// WhatsApp
import { WhatsAppTrafficWidget } from "@/components/widgets/WhatsAppTrafficWidget";

// Cadence
import { CadencePerformanceWidget } from "@/components/widgets/CadencePerformanceWidget";

// Financial
import { KiwifyFinancialReport } from "@/components/widgets/KiwifyFinancialReport";
import { useKiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";

interface AdvancedTabProps {
  startDate: Date;
  endDate: Date;
}

export function AdvancedTab({ startDate, endDate }: AdvancedTabProps) {
  const { data: kiwifyMetrics } = useKiwifyCompleteMetrics(startDate, endDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Análises Avançadas</h3>
        <p className="text-sm text-muted-foreground">
          IA, Onboarding, WhatsApp, Cadências e Financeiro
        </p>
      </div>

      {/* Sub-tabs for different advanced sections */}
      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="ai" className="flex items-center gap-2 text-xs">
            <Brain className="h-4 w-4" />
            IA
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2 text-xs">
            <Rocket className="h-4 w-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2 text-xs">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="cadences" className="flex items-center gap-2 text-xs">
            <TrendingUp className="h-4 w-4" />
            Cadências
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-2 text-xs">
            <DollarSign className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
        </TabsList>

        {/* AI Tab */}
        <TabsContent value="ai" className="space-y-6">
          <AIExecutiveSummary 
            data={{ 
              context: 'ai',
              message: 'Aguardando coleta de métricas de IA para análise.',
            }}
            context="ai"
            startDate={startDate}
            endDate={endDate}
          />
          <AIEconomyWidget startDate={startDate} endDate={endDate} />
          <div className="grid gap-6 md:grid-cols-2">
            <AIUsageWidget startDate={startDate} endDate={endDate} />
            <TopTopicsWidget startDate={startDate} endDate={endDate} />
          </div>
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-6">
          <AIExecutiveSummary 
            data={{ 
              context: 'onboarding',
              message: 'Aguardando coleta de dados de onboarding para análise.',
            }}
            context="onboarding"
            startDate={startDate}
            endDate={endDate}
          />
          <OnboardingFunnelWidget startDate={startDate} endDate={endDate} />
          <CSEmailFunnelWidget startDate={startDate} endDate={endDate} />
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-6">
          <AIExecutiveSummary 
            data={{ 
              context: 'whatsapp',
              message: 'Aguardando coleta de dados de WhatsApp para análise.',
            }}
            context="whatsapp"
            startDate={startDate}
            endDate={endDate}
          />
          <WhatsAppTrafficWidget startDate={startDate} endDate={endDate} />
        </TabsContent>

        {/* Cadences Tab */}
        <TabsContent value="cadences" className="space-y-6">
          <AIExecutiveSummary 
            data={{ 
              context: 'sales',
              message: 'Aguardando coleta de métricas de cadências para análise.',
            }}
            context="sales"
            startDate={startDate}
            endDate={endDate}
          />
          <CadencePerformanceWidget />
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <AIExecutiveSummary 
            data={kiwifyMetrics ? {
              vendasAprovadas: kiwifyMetrics.vendasAprovadas,
              vendasNovas: kiwifyMetrics.vendasNovas,
              renovacoes: kiwifyMetrics.renovacoes,
              receitaBruta: `R$ ${kiwifyMetrics.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              receitaLiquida: `R$ ${kiwifyMetrics.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              taxaKiwify: `R$ ${kiwifyMetrics.taxaKiwify.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              comissaoAfiliados: `R$ ${kiwifyMetrics.comissaoAfiliados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              reembolsos: `${kiwifyMetrics.reembolsos.quantidade}`,
              chargebacks: `${kiwifyMetrics.chargebacks.quantidade}`,
              taxaChurn: `${kiwifyMetrics.taxaChurn.toFixed(1)}%`,
            } : { message: 'Carregando dados financeiros...' }}
            context="financial"
            startDate={startDate}
            endDate={endDate}
          />
          <KiwifyFinancialReport startDate={startDate} endDate={endDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
