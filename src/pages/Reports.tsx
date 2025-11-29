import { useState } from "react";
import { FileSpreadsheet, TrendingUp, Users, MessageSquare, DollarSign, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import ReportCard from "@/components/ReportCard";
import ReportFilterPanel from "@/components/ReportFilterPanel";

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const reportCategories = [
    {
      id: 'support',
      name: '🎧 Atendimento',
      icon: Users,
      reports: [
        {
          id: 'tickets_all',
          name: 'Todos os Tickets',
          description: 'Lista completa de tickets com detalhes de atendimento',
          icon: FileSpreadsheet,
        },
        {
          id: 'agent_performance',
          name: 'Performance por Agente',
          description: 'Métricas de produtividade e qualidade por agente',
          icon: TrendingUp,
        },
        {
          id: 'csat_survey',
          name: 'Pesquisa CSAT',
          description: 'Avaliações de satisfação dos clientes',
          icon: MessageSquare,
        },
      ],
    },
    {
      id: 'sales',
      name: '💰 Vendas',
      icon: DollarSign,
      reports: [
        {
          id: 'deals_won_lost',
          name: 'Deals Ganhos/Perdidos',
          description: 'Histórico completo de negociações fechadas',
          icon: TrendingUp,
        },
        {
          id: 'commissions',
          name: 'Comissões Detalhadas',
          description: 'Cálculo de comissões por vendedor',
          icon: DollarSign,
        },
        {
          id: 'lost_reasons',
          name: 'Motivos de Perda',
          description: 'Análise agregada de por que deals foram perdidos',
          icon: FileSpreadsheet,
        },
        {
          id: 'team_goals_performance',
          name: 'Performance de Metas da Equipe',
          description: 'Comparativo de metas vs realizados com comissões',
          icon: Target,
        },
      ],
    },
    {
      id: 'onboarding',
      name: '🚀 Onboarding',
      icon: Users,
      reports: [
        {
          id: 'stuck_customers',
          name: 'Clientes Travados',
          description: 'Clientes parados em etapas críticas do onboarding',
          icon: Users,
        },
        {
          id: 'completion_times',
          name: 'Tempos de Conclusão',
          description: 'Análise de tempo médio de conclusão de playbooks',
          icon: TrendingUp,
        },
      ],
    },
    {
      id: 'ai_chat',
      name: '🤖 IA & Chat',
      icon: MessageSquare,
      reports: [
        {
          id: 'conversation_history',
          name: 'Histórico de Conversas',
          description: 'Exportação de conversas por período e departamento',
          icon: MessageSquare,
        },
        {
          id: 'unanswered_questions',
          name: 'Perguntas sem Resposta',
          description: 'Questões que AI não conseguiu responder',
          icon: FileSpreadsheet,
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <FileSpreadsheet className="h-10 w-10 text-primary" />
          Central de Relatórios
        </h1>
        <p className="text-muted-foreground text-lg">
          Extraia inteligência do sistema com relatórios personalizados
        </p>
      </div>

      <Tabs defaultValue="support" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          {reportCategories.map((category) => (
            <TabsTrigger key={category.id} value={category.id}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {reportCategories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onClick={() => setSelectedReport(report)}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {selectedReport && (
        <ReportFilterPanel
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => !open && setSelectedReport(null)}
        />
      )}
    </div>
  );
}
