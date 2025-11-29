import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCSGoals } from "@/hooks/useCSGoals";
import { useCSGoalProgress } from "@/hooks/useCSGoalProgress";
import { DollarSign, Shield, TrendingUp, Rocket, Gift, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function CSGoalsWidget() {
  const { user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7) + "-01"; // YYYY-MM-01
  
  const { data: goals, isLoading: goalsLoading } = useCSGoals(user?.id, currentMonth);
  const goal = goals?.[0];

  const { data: progress, isLoading: progressLoading } = useCSGoalProgress(
    user?.id || "",
    currentMonth
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (goalsLoading || progressLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!goal || !progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Minhas Metas de Sucesso
          </CardTitle>
          <CardDescription>
            Nenhuma meta definida para este mês. Entre em contato com seu gerente.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-emerald-500";
    if (percentage >= 75) return "bg-blue-500";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getRetentionColor = (retentionRate: number, maxChurn: number) => {
    const currentChurn = 100 - retentionRate;
    if (currentChurn <= maxChurn) return "bg-emerald-500";
    if (currentChurn <= maxChurn * 1.5) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            🎯 Minhas Metas de Sucesso
          </CardTitle>
          <CardDescription>
            Acompanhe seu desempenho em tempo real e saiba o que precisa fazer para bater suas metas
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 4 Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 1. Carteira Ativa (GMV) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base text-foreground">💰 Carteira Ativa (GMV)</CardTitle>
              </div>
              <Badge variant={progress.gmvPercentage >= 100 ? "success" : "secondary"}>
                {progress.gmvPercentage.toFixed(0)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Atual</span>
                <span className="font-bold text-foreground">{formatCurrency(progress.currentGMV)}</span>
              </div>
              <Progress 
                value={Math.min(progress.gmvPercentage, 100)} 
                className={`h-3 ${getProgressColor(progress.gmvPercentage)}`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta: {formatCurrency(progress.targetGMV)}</span>
                {progress.gmvPercentage < 100 && (
                  <span className="text-rose-500 font-medium">
                    Faltam {formatCurrency(progress.targetGMV - progress.currentGMV)}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Seus clientes precisam vender mais! Ligue para quem está parado.
            </p>
          </CardContent>
        </Card>

        {/* 2. Blindagem (Retenção) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base text-foreground">🛡️ Blindagem (Retenção)</CardTitle>
              </div>
              <Badge variant={progress.retentionRate >= (100 - goal.max_churn_rate) ? "success" : "error"}>
                {progress.retentionRate.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Churn: {progress.churnedClients} de {progress.totalClients} clientes</span>
                <span className="font-bold text-foreground">{(100 - progress.retentionRate).toFixed(1)}%</span>
              </div>
              <Progress 
                value={progress.retentionRate} 
                className={`h-3 ${getRetentionColor(progress.retentionRate, goal.max_churn_rate)}`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Teto permitido: {goal.max_churn_rate}%</span>
                {progress.retentionRate < (100 - goal.max_churn_rate) && (
                  <span className="text-rose-500 font-medium">
                    ⚠️ Acima do limite!
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Previna cancelamentos! Entre em contato com clientes em risco.
            </p>
          </CardContent>
        </Card>

        {/* 3. Expansão (Upsell) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base text-foreground">📈 Expansão (Upsell)</CardTitle>
              </div>
              <Badge variant={progress.upsellPercentage >= 100 ? "success" : "secondary"}>
                {progress.upsellPercentage.toFixed(0)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendas Adicionais</span>
                <span className="font-bold text-foreground">{formatCurrency(progress.currentUpsell)}</span>
              </div>
              <Progress 
                value={Math.min(progress.upsellPercentage, 100)} 
                className={`h-3 ${getProgressColor(progress.upsellPercentage)}`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta: {formatCurrency(progress.targetUpsell)}</span>
                {progress.upsellPercentage < 100 && (
                  <span className="text-rose-500 font-medium">
                    Faltam {formatCurrency(progress.targetUpsell - progress.currentUpsell)}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Ofereça produtos complementares para sua base!
            </p>
          </CardContent>
        </Card>

        {/* 4. Ativações */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-base text-foreground">🚀 Ativações</CardTitle>
              </div>
              <Badge variant={progress.activationsPercentage >= 100 ? "success" : "secondary"}>
                {progress.activationsPercentage.toFixed(0)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Clientes Ativados</span>
                <span className="font-bold text-foreground">
                  {progress.currentActivations} / {progress.targetActivations}
                </span>
              </div>
              <Progress 
                value={Math.min(progress.activationsPercentage, 100)} 
                className={`h-3 ${getProgressColor(progress.activationsPercentage)}`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta: {progress.targetActivations} ativações</span>
                {progress.activationsPercentage < 100 && (
                  <span className="text-rose-500 font-medium">
                    Faltam {progress.targetActivations - progress.currentActivations}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Garanta que novos clientes façam seu primeiro pedido!
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bonus Simulator Card - Full Width */}
      <Card className={`border-2 ${progress.bonusUnlocked ? 'border-yellow-500 bg-yellow-500/5' : 'border-slate-200'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className={`h-6 w-6 ${progress.bonusUnlocked ? 'text-yellow-500' : 'text-slate-400'}`} />
              <CardTitle className="text-foreground">
                {progress.bonusUnlocked ? "🎉 Meu Bônus Desbloqueado!" : "💰 Meu Bônus Estimado"}
              </CardTitle>
            </div>
            {progress.bonusUnlocked ? (
              <div className="text-3xl font-bold text-yellow-500 animate-pulse">
                {formatCurrency(progress.bonusAmount)}
              </div>
            ) : (
              <div className="text-3xl font-bold text-slate-400">
                R$ 0,00
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {progress.bonusUnlocked ? (
            <div className="text-center py-4">
              <p className="text-lg font-semibold text-emerald-600">
                ✅ Parabéns! Você atingiu todas as metas e desbloqueou seu bônus de {formatCurrency(progress.bonusAmount)}!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para desbloquear o bônus de <span className="font-bold text-foreground">{formatCurrency(progress.bonusAmount)}</span>, você precisa atingir:
              </p>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-sm">
                  {progress.bonusRequirements.gmvMet ? (
                    <Badge variant="success">✓</Badge>
                  ) : (
                    <Badge variant="error">✗</Badge>
                  )}
                  <span className={progress.bonusRequirements.gmvMet ? "text-emerald-600 font-medium" : "text-foreground"}>
                    GMV ≥ 100%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {progress.bonusRequirements.retentionMet ? (
                    <Badge variant="success">✓</Badge>
                  ) : (
                    <Badge variant="error">✗</Badge>
                  )}
                  <span className={progress.bonusRequirements.retentionMet ? "text-emerald-600 font-medium" : "text-foreground"}>
                    Churn ≤ {goal.max_churn_rate}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {progress.bonusRequirements.upsellMet ? (
                    <Badge variant="success">✓</Badge>
                  ) : (
                    <Badge variant="error">✗</Badge>
                  )}
                  <span className={progress.bonusRequirements.upsellMet ? "text-emerald-600 font-medium" : "text-foreground"}>
                    Upsell ≥ 100%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {progress.bonusRequirements.activationsMet ? (
                    <Badge variant="success">✓</Badge>
                  ) : (
                    <Badge variant="error">✗</Badge>
                  )}
                  <span className={progress.bonusRequirements.activationsMet ? "text-emerald-600 font-medium" : "text-foreground"}>
                    Ativações ≥ {progress.targetActivations}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
