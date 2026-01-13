import { TrendingUp, Target, DollarSign, Clock, Headphones, MessageSquare, Users } from "lucide-react";
import { DateRange } from "react-day-picker";
import { BentoGrid, BentoCard } from "@/components/ui/bento-grid";
import { KPICard } from "@/components/widgets/KPICard";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { useDealsConversionAnalysis } from "@/hooks/useDealsConversionAnalysis";
import { useSLAAlerts } from "@/hooks/useSLAAlerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OverviewDashboardTabProps {
  dateRange?: DateRange;
}

export function OverviewDashboardTab({ dateRange }: OverviewDashboardTabProps) {
  const { data: kiwifyFinancials } = useKiwifyFinancials();
  const { totalPipelineValue, weightedValue } = usePipelineValue();
  const { data: conversionData } = useDealsConversionAnalysis(dateRange);
  const { data: slaAlerts } = useSLAAlerts();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const activeSlaAlerts = slaAlerts?.length || 0;

  return (
    <BentoGrid cols={4}>
      {/* Seção Vendas */}
      <BentoCard span="full">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="pb-2 px-0 pt-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="Pipeline" 
                value={formatCurrency(totalPipelineValue)} 
                icon={TrendingUp}
                description="valor total"
              />
              <KPICard 
                title="Pipeline Ponderado" 
                value={formatCurrency(weightedValue)} 
                icon={Target}
                description="por probabilidade"
              />
              <KPICard 
                title="Taxa Conversão" 
                value={`${conversionData?.createdToWonRate?.toFixed(1) || 0}%`}
                icon={Target}
                description={`${conversionData?.totalWon || 0} de ${conversionData?.totalCreated || 0}`}
              />
              <KPICard 
                title="Ciclo Médio" 
                value={`${conversionData?.avgTimeToWinDays || 0} dias`}
                icon={Clock}
                description="tempo p/ ganhar"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>

      {/* Seção Suporte */}
      <BentoCard span="full">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="pb-2 px-0 pt-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Headphones className="h-5 w-5 text-blue-500" />
              Suporte
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="SLA em Risco" 
                value={activeSlaAlerts.toString()}
                icon={Clock}
                description="alertas ativos"
              />
              <KPICard 
                title="Tickets Abertos" 
                value="--"
                icon={Headphones}
                description="aguardando"
              />
              <KPICard 
                title="FRT Médio" 
                value="--"
                icon={Clock}
                description="first response"
              />
              <KPICard 
                title="CSAT" 
                value="--"
                icon={Target}
                description="satisfação"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>

      {/* Seção Financeiro */}
      <BentoCard span="full">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="pb-2 px-0 pt-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="Receita Líquida" 
                value={formatCurrency(kiwifyFinancials?.totalNetRevenue || 0)}
                icon={DollarSign}
                description="depositado"
              />
              <KPICard 
                title="Receita Bruta" 
                value={formatCurrency(kiwifyFinancials?.totalGrossRevenue || 0)}
                icon={DollarSign}
                description="vendas totais"
              />
              <KPICard 
                title="Taxas" 
                value={formatCurrency(kiwifyFinancials?.totalKiwifyFees || 0)}
                icon={DollarSign}
                description="Kiwify + gateway"
              />
              <KPICard 
                title="Comissões" 
                value={formatCurrency(kiwifyFinancials?.totalAffiliateCommissions || 0)}
                icon={Users}
                description="afiliados"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>

      {/* Seção Operacional */}
      <BentoCard span="full">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="pb-2 px-0 pt-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-500" />
              Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="grid grid-cols-4 gap-4">
              <KPICard 
                title="WhatsApp" 
                value="--"
                icon={MessageSquare}
                description="instâncias ativas"
              />
              <KPICard 
                title="Equipe Online" 
                value="--"
                icon={Users}
                description="agentes disponíveis"
              />
              <KPICard 
                title="Conversas Ativas" 
                value="--"
                icon={MessageSquare}
                description="em atendimento"
              />
              <KPICard 
                title="Fila" 
                value="--"
                icon={Clock}
                description="aguardando"
              />
            </div>
          </CardContent>
        </Card>
      </BentoCard>
    </BentoGrid>
  );
}
