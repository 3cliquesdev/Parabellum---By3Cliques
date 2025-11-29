import { useState } from "react";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCSManagerKPIs } from "@/hooks/useCSManagerKPIs";
import { useConsultantPerformance } from "@/hooks/useConsultantPerformance";
import { useCriticalClients } from "@/hooks/useCriticalClients";
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, Eye, Phone, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CSGoalDialog } from "@/components/CSGoalDialog";
import { useCSGoals } from "@/hooks/useCSGoals";

export default function CSManagement() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpisLoading } = useCSManagerKPIs();
  const { data: consultants, isLoading: consultantsLoading } = useConsultantPerformance();
  const { data: criticalClients, isLoading: criticalLoading } = useCriticalClients();
  
  // Fetch CS goals for current month
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
  const { data: allGoals } = useCSGoals(undefined, currentMonth);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getHealthBadge = (score: number) => {
    if (score >= 1.5) return { label: "Saudável", variant: "success" as const };
    if (score >= 0.75) return { label: "Atenção", variant: "warning" as const };
    return { label: "Crítico", variant: "error" as const };
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard do Gerente de CS</h1>
            <p className="text-muted-foreground mt-1">Visão estratégica da operação de Customer Success</p>
          </div>
        </div>

        {/* KPIs Globais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ARR Total */}
          <Card className="p-6">
            {kpisLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">ARR Total</span>
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(kpis?.arrTotal || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">Receita Recorrente Anual</p>
              </>
            )}
          </Card>

          {/* Churn Rate */}
          <Card className="p-6">
            {kpisLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Churn Rate</span>
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">{kpis?.churnRateMonthly.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">Perdas este mês</p>
              </>
            )}
          </Card>

          {/* Expansão (Upsell) */}
          <Card className="p-6">
            {kpisLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Expansão</span>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(kpis?.upsellRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">Upsell este mês</p>
              </>
            )}
          </Card>

          {/* Saúde da Base */}
          <Card className="p-6">
            {kpisLoading ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Saúde da Base</span>
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm font-medium">{kpis?.healthDistribution.green || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-sm font-medium">{kpis?.healthDistribution.yellow || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <span className="text-sm font-medium">{kpis?.healthDistribution.red || 0}</span>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Clientes em UTI */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="text-xl font-semibold text-foreground">🚨 Clientes em UTI</h2>
            <Badge variant="error">{criticalClients?.length || 0}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Top 10 clientes de maior valor com saúde crítica. Ação imediata necessária.
          </p>

          {criticalLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : criticalClients && criticalClients.length > 0 ? (
            <div className="space-y-3">
              {criticalClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar>
                      <AvatarImage src={client.avatar_url || undefined} />
                      <AvatarFallback>{client.first_name[0]}{client.last_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{client.first_name} {client.last_name}</div>
                      <div className="text-sm text-muted-foreground">
                        LTV: {formatCurrency(client.total_ltv)} • Consultor: {client.consultant_name || "Não atribuído"}
                      </div>
                      <div className="text-xs text-rose-600 mt-1">
                        {client.last_contact_date 
                          ? `Último contato: ${formatDistanceToNow(new Date(client.last_contact_date), { addSuffix: true, locale: ptBR })}`
                          : "Nunca contatado"
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.phone && (
                      <Button size="sm" variant="outline" onClick={() => window.open(`https://wa.me/${client.phone}`, "_blank")}>
                        <Phone className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" onClick={() => navigate(`/contacts/${client.id}`)}>
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Perfil
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum cliente crítico no momento 🎉</p>
            </div>
          )}
        </Card>

        {/* Performance do Time */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">📊 Performance do Time de CS</h2>
          
          {consultantsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : consultants && consultants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Consultor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Carteira</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor da Carteira</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Saúde Média</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Última Atividade</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {consultants.map((consultant) => {
                    const healthBadge = getHealthBadge(consultant.avg_health_score);
                    const existingGoal = allGoals?.find(g => g.consultant_id === consultant.id);
                    
                    return (
                      <tr key={consultant.id} className="border-b hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={consultant.avatar_url || undefined} />
                              <AvatarFallback>{consultant.full_name[0]}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{consultant.full_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-foreground">{consultant.portfolio_count} clientes</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground">{formatCurrency(consultant.portfolio_value)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={healthBadge.variant}>{healthBadge.label}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-muted-foreground">
                            {consultant.last_activity 
                              ? formatDistanceToNow(new Date(consultant.last_activity), { addSuffix: true, locale: ptBR })
                              : "Nunca"
                            }
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <CSGoalDialog 
                              consultantId={consultant.id}
                              consultantName={consultant.full_name}
                              existingGoal={existingGoal}
                              currentMonth={currentMonth}
                            />
                            <Button size="sm" variant="outline" onClick={() => navigate(`/my-portfolio?consultant=${consultant.id}`)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Carteira
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum consultor cadastrado</p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
