import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlaybookMetrics } from "@/hooks/usePlaybookMetrics";
import { Mail, MailOpen, MousePointerClick, CheckCircle, TrendingUp, AlertCircle } from "lucide-react";
import { EmailFunnelChart } from "./EmailFunnelChart";
import { PlaybookPerformanceTable } from "./PlaybookPerformanceTable";
import { EmailEvolutionChart } from "./EmailEvolutionChart";

export function PlaybookMetricsDashboard() {
  const { data: metrics, isLoading } = usePlaybookMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Entrega
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {metrics?.emails.deliveryRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.emails.delivered}/{metrics?.emails.sent} emails
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Abertura
            </CardTitle>
            <MailOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics?.emails.openRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.emails.opened} abertos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Cliques
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {metrics?.emails.clickRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.emails.clicked} cliques
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Conclusão Playbooks
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.completionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.completed}/{metrics?.totalExecutions} completos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução de Emails (7 dias)
            </CardTitle>
            <CardDescription>
              Histórico de envios, entregas e aberturas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailEvolutionChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Funil de Conversão
            </CardTitle>
            <CardDescription>
              Jornada do email: enviado → entregue → aberto → clicado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailFunnelChart />
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {metrics?.emails.bounced && metrics.emails.bounced > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                {metrics.emails.bounced} emails com bounce
              </p>
              <p className="text-sm text-amber-600">
                Verifique os endereços de email dos contatos afetados
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Playbook</CardTitle>
          <CardDescription>
            Métricas detalhadas de cada playbook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaybookPerformanceTable data={metrics?.byPlaybook || []} />
        </CardContent>
      </Card>
    </div>
  );
}
