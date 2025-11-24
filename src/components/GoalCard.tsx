import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, Target, CheckCircle2 } from "lucide-react";
import { useGoalProgress } from "@/hooks/useGoalProgress";
import type { Goal } from "@/hooks/useGoals";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
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
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <Avatar className="h-8 w-8">
              <AvatarImage src={goal.assigned_user.avatar_url || undefined} />
              <AvatarFallback>
                {goal.assigned_user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{goal.assigned_user.full_name}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Progress Bar */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-bold">{progress?.percentage || 0}%</span>
          </div>
          <Progress value={progress?.percentage || 0} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(progress?.currentValue || 0)}</span>
            <span>{formatCurrency(goal.target_value)}</span>
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>Marcos Conquistados</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
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

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Vendas Fechadas</p>
              <p className="text-sm font-bold">{progress?.dealCount || 0}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Período</p>
            <p className="text-sm font-bold">
              {goal.period_month}/{goal.period_year}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
