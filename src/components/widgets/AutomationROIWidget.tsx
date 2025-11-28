import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationROI } from "@/hooks/useAutomationROI";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, DollarSign, TrendingUp, Bot, Clock, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function AutomationROIWidget() {
  const { data: roi, isLoading } = useAutomationROI();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!roi || roi.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            ROI de Automações
          </CardTitle>
          <CardDescription>Retorno sobre investimento em playbooks automatizados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Bot className="h-8 w-8 mb-2 opacity-50" />
            <p>Nenhum playbook ativo encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalRevenue = roi.reduce((sum, r) => sum + r.revenue_generated, 0);
  const totalCost = roi.reduce((sum, r) => sum + r.ai_cost_estimate, 0);
  const totalROI = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          ROI de Automações
        </CardTitle>
        <CardDescription>Retorno sobre investimento em playbooks automatizados</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global ROI Summary */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Revenue Total</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Custo IA Estimado</div>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalCost)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">ROI Global</div>
              <div className="text-2xl font-bold text-primary">
                {totalROI > 0 ? '+' : ''}{totalROI.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Individual Playbook ROI */}
        {roi.map((playbook) => (
          <div key={playbook.playbook_id} className="space-y-4 pb-6 border-b last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-lg">{playbook.playbook_name}</h4>
                <p className="text-sm text-muted-foreground">
                  {playbook.total_executions} execuções · {playbook.completed_executions} completas
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(playbook.revenue_generated)}
                </div>
                <div className="text-xs text-muted-foreground">Revenue Gerado</div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Conversões
                </div>
                <div className="text-xl font-bold text-green-600">
                  {playbook.customers_converted}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Tempo Médio
                </div>
                <div className="text-xl font-bold">
                  {playbook.avg_time_to_convert > 0 ? `${playbook.avg_time_to_convert}d` : '-'}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DollarSign className="h-3 w-3" />
                  Custo IA
                </div>
                <div className="text-xl font-bold text-orange-600">
                  {formatCurrency(playbook.ai_cost_estimate)}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  ROI
                </div>
                <div className="text-xl font-bold text-primary">
                  {playbook.roi_percentage > 0 ? '+' : ''}{playbook.roi_percentage.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Automation Rate Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  Taxa de Automação
                </span>
                <span className="text-muted-foreground font-semibold">
                  {playbook.automation_rate.toFixed(0)}%
                </span>
              </div>
              <Progress value={playbook.automation_rate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {playbook.completed_executions} de {playbook.total_executions} execuções completadas automaticamente
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
