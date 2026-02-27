import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, TrendingUp, Users, MessageSquare, DollarSign, Target, Clock, BarChart3, RefreshCw, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import ReportCard from "@/components/ReportCard";
import ReportFilterPanel from "@/components/ReportFilterPanel";
import { AnalyticsReportPanel } from "@/components/reports/AnalyticsReportPanel";

export default function Reports() {
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const reportCategories = [
    {
      id: 'dashboard',
      name: '📊 Dashboard',
      icon: BarChart3,
      reports: [
        {
          id: 'analytics_sales',
          name: 'Vendas & Assinaturas',
          description: 'Métricas consolidadas de conversão, receita e funil de vendas',
          icon: TrendingUp,
        },
        {
          id: 'analytics_churn',
          name: 'Churn & Reembolsos',
          description: 'Análise de cancelamentos, reembolsos e taxa de retenção',
          icon: RefreshCw,
        },
        {
          id: 'analytics_performance',
          name: 'Performance da Equipe',
          description: 'Métricas de produtividade por vendedor e consultor',
          icon: Target,
        },
      ],
    },
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
          id: 'tickets_export',
          name: 'Relatório de Tickets (Excel)',
          description: 'Exportação completa com métricas de SLA, tempos de resposta e resolução',
          icon: FileSpreadsheet,
          route: '/reports/tickets-export',
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
        {
          id: 'commercial_conversations',
          name: 'Conversas Comerciais',
          description: 'Análise de conversas por categoria e departamento com export',
          icon: MessageSquare,
          route: '/reports/commercial-conversations',
        },
        {
          id: 'conversations_detailed',
          name: 'Relatório de Conversas',
          description: 'Lista detalhada de todas as conversas com filtros avançados e exportação CSV',
          icon: MessageSquare,
          route: '/reports/conversations',
        },
        {
          id: 'inbox_time',
          name: 'Tempo Médio (SLA + Tags)',
          description: 'Métricas de SLA por conversa: tempo IA, fila humano, resolução, CSAT e tags',
          icon: Timer,
          route: '/reports/inbox-time',
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
        {
          id: 'deals_conversion_analysis',
          name: 'Análise de Conversão',
          description: 'Taxa de conversão criados → ganhos e tempo médio de ciclo',
          icon: Clock,
        },
        {
          id: 'form_leads_conversion',
          name: 'Leads Formulário vs Conversão',
          description: 'Comparativo de leads criados por formulário vs deals fechados (Excel)',
          icon: FileSpreadsheet,
          route: '/reports/form-leads-conversion',
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
        {
          id: 'email_sequence',
          name: 'Sequência de E-mails',
          description: 'Exportação com todas as etapas de e-mail por venda/execução',
          icon: FileSpreadsheet,
          route: '/reports/playbook-email-sequence',
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
    {
      id: 'financial',
      name: '💰 Financeiro Kiwify',
      icon: DollarSign,
      reports: [
        {
          id: 'kiwify_detailed_sales',
          name: 'Vendas Detalhadas Kiwify',
          description: 'Todas as vendas com breakdown completo de valores',
          icon: FileSpreadsheet,
        },
        {
          id: 'affiliate_commissions',
          name: 'Comissões de Afiliados',
          description: 'Vendas agrupadas por afiliado com total de comissões',
          icon: Users,
        },
        {
          id: 'margin_analysis',
          name: 'Análise de Margens',
          description: 'Margem líquida por produto e oferta',
          icon: TrendingUp,
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

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
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
                  onClick={() => {
                    if ((report as any).route) {
                      navigate((report as any).route);
                    } else {
                      setSelectedReport(report);
                    }
                  }}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {selectedReport && selectedReport.id.startsWith('analytics_') ? (
        <AnalyticsReportPanel
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => !open && setSelectedReport(null)}
        />
      ) : selectedReport ? (
        <ReportFilterPanel
          report={selectedReport}
          open={!!selectedReport}
          onOpenChange={(open) => !open && setSelectedReport(null)}
        />
      ) : null}
    </div>
  );
}
