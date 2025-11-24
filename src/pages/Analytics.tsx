import { PipelineValueWidget } from "@/components/widgets/PipelineValueWidget";
import { ConversionRateWidget } from "@/components/widgets/ConversionRateWidget";
import { FinancialStatusWidget } from "@/components/widgets/FinancialStatusWidget";
import { SalesByRepWidget } from "@/components/widgets/SalesByRepWidget";
import { RevenueEvolutionWidget } from "@/components/widgets/RevenueEvolutionWidget";
import { SalesFunnelWidget } from "@/components/widgets/SalesFunnelWidget";
import { HotDealsWidget } from "@/components/widgets/HotDealsWidget";
import RottenDealsWidget from "@/components/widgets/RottenDealsWidget";
import LostReasonsWidget from "@/components/widgets/LostReasonsWidget";
import { EmailEngagementWidget } from "@/components/widgets/EmailEngagementWidget";
import { SalesVelocityWidget } from "@/components/widgets/SalesVelocityWidget";
import { ContactEfficiencyWidget } from "@/components/widgets/ContactEfficiencyWidget";
import { MostEngagedLeadsWidget } from "@/components/widgets/MostEngagedLeadsWidget";

export default function Analytics() {
  return (
    <div className="min-h-screen p-6 flex flex-col gap-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Análises & Inteligência de Vendas</h1>
        <p className="text-muted-foreground">
          Insights estratégicos baseados em dados reais do seu CRM
        </p>
      </div>

      {/* SEÇÃO 1: Visão Geral - KPIs */}
      <section>
        <h2 className="text-xl font-semibold mb-4">📊 Visão Geral</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PipelineValueWidget />
          <ConversionRateWidget />
          <FinancialStatusWidget />
        </div>
      </section>

      {/* SEÇÃO 2: Performance de Vendas */}
      <section>
        <h2 className="text-xl font-semibold mb-4">💰 Performance de Vendas</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SalesByRepWidget />
          <RevenueEvolutionWidget />
        </div>
      </section>

      {/* SEÇÃO 3: Funil & Previsão */}
      <section>
        <h2 className="text-xl font-semibold mb-4">🎯 Funil & Previsão</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SalesFunnelWidget />
          <HotDealsWidget />
        </div>
      </section>

      {/* SEÇÃO 4: Inteligência de Vendas (NOVO) */}
      <section>
        <h2 className="text-xl font-semibold mb-4">🧠 Inteligência de Vendas</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <EmailEngagementWidget />
          <SalesVelocityWidget />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          <ContactEfficiencyWidget />
          <RottenDealsWidget />
        </div>
      </section>

      {/* SEÇÃO 5: Lead Scoring (NOVO) */}
      <section>
        <h2 className="text-xl font-semibold mb-4">🔥 Lead Scoring & Engajamento</h2>
        <div className="w-full">
          <MostEngagedLeadsWidget />
        </div>
      </section>

      {/* SEÇÃO 6: Análise de Perdas */}
      <section>
        <h2 className="text-xl font-semibold mb-4">📉 Análise de Perdas</h2>
        <div className="w-full">
          <LostReasonsWidget />
        </div>
      </section>
    </div>
  );
}
