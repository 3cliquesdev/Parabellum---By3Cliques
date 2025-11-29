import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, CheckCircle2 } from "lucide-react";
import { useGoalProgress } from "@/hooks/useGoalProgress";
import type { Goal } from "@/hooks/useGoals";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { PacingGauge } from "./widgets/PacingGauge";
import { ForecastCard } from "./widgets/ForecastCard";
import { CommissionCard } from "./widgets/CommissionCard";
import { ProductMixProgress } from "./widgets/ProductMixProgress";

interface GoalCardProps {
  goal: Goal;
}

export function GoalCard({ goal }: GoalCardProps) {
  const { data: progress } = useGoalProgress(
    goal.id,
    goal.target_value,
    goal.period_month,
    goal.period_year,
    goal.assigned_to
  );

  const previousMilestones = useRef<number[]>([]);

  // Calculate days elapsed and total days in month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isCurrentPeriod = goal.period_year === currentYear && goal.period_month === currentMonth;
  
  const totalDays = new Date(goal.period_year, goal.period_month, 0).getDate();
  const daysElapsed = isCurrentPeriod ? now.getDate() : totalDays;

  // Detect new milestones and show notifications
  useEffect(() => {
    if (!progress) return;

    const newMilestones = progress.milestonesAchieved.filter(
      (m) => !previousMilestones.current.includes(m)
    );

    newMilestones.forEach((milestone) => {
      toast.success(`🎉 Marco de ${milestone}% atingido!`, {
        description: `Meta: ${goal.title}`,
      });
    });

    previousMilestones.current = progress.milestonesAchieved;
  }, [progress, goal.title]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case "individual": return "Individual";
      case "team": return "Equipe";
      case "company": return "Empresa";
      default: return type;
    }
  };

  const getMilestoneIcon = (milestone: number, achieved: boolean) => {
    if (achieved) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
  };

  // Parse product targets from JSONB
  const productTargets = goal.product_targets || [];

  return (
    <div className="space-y-4">
      {/* Main Goal Card - Compact */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{goal.title}</CardTitle>
              </div>
              {goal.description && (
                <CardDescription className="text-sm">{goal.description}</CardDescription>
              )}
            </div>
            <Badge variant="secondary">{getGoalTypeLabel(goal.goal_type)}</Badge>
          </div>

          {goal.assigned_user && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
              <Avatar className="h-7 w-7">
                <AvatarImage src={goal.assigned_user.avatar_url || undefined} />
                <AvatarFallback>
                  {goal.assigned_user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{goal.assigned_user.full_name}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="pb-4">
          {/* Progress Bar */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-bold text-lg">{progress?.percentage || 0}%</span>
            </div>
            <Progress value={progress?.percentage || 0} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(progress?.currentValue || 0)}</span>
              <span>{formatCurrency(goal.target_value)}</span>
            </div>
          </div>

          {/* Milestones - Compact */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Trophy className="h-3 w-3" />
              <span>Marcos</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((milestone) => {
                const achieved = progress?.milestonesAchieved.includes(milestone) || false;
                return (
                  <div
                    key={milestone}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                      achieved ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'
                    }`}
                  >
                    {getMilestoneIcon(milestone, achieved)}
                    <span className={`text-xs font-medium ${achieved ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {milestone}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enterprise Widgets Grid */}
      {isCurrentPeriod && (
        <div className="grid gap-4 md:grid-cols-2">
          <PacingGauge
            currentValue={progress?.currentValue || 0}
            targetValue={goal.target_value}
            daysElapsed={daysElapsed}
            totalDays={totalDays}
          />
          <ForecastCard
            currentValue={progress?.currentValue || 0}
            targetValue={goal.target_value}
            daysElapsed={daysElapsed}
            totalDays={totalDays}
          />
        </div>
      )}

      {/* Commission Card - Full Width */}
      {goal.commission_rate && goal.commission_rate > 0 && (
        <CommissionCard
          currentValue={progress?.currentValue || 0}
          targetValue={goal.target_value}
          commissionRate={goal.commission_rate}
        />
      )}

      {/* Product Mix - Full Width */}
      {productTargets.length > 0 && (
        <ProductMixProgress productTargets={productTargets} />
      )}
    </div>
  );
}