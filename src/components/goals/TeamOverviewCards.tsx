import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Trophy, Users } from "lucide-react";
import { TeamMemberProgress } from "@/hooks/useTeamGoalProgress";
import { cn } from "@/lib/utils";

interface TeamOverviewCardsProps {
  teamTargetValue: number;
  teamCurrentValue: number;
  teamPercentage: number;
  members: TeamMemberProgress[];
  isLoading?: boolean;
}

export function TeamOverviewCards({
  teamTargetValue,
  teamCurrentValue,
  teamPercentage,
  members,
  isLoading = false,
}: TeamOverviewCardsProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getTeamStatusColor = (pct: number) => {
    if (pct >= 100) return "text-green-500";
    if (pct >= 90) return "text-emerald-500";
    if (pct >= 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getTeamStatusMessage = (pct: number) => {
    if (pct >= 100) return "Meta batida!";
    if (pct >= 90) return "Quase lá!";
    if (pct >= 70) return "Bom ritmo";
    return "Acelerar vendas";
  };

  // Find top performer (highest percentage)
  const topPerformer = members.length > 0 
    ? members.reduce((max, m) => m.percentage > max.percentage ? m : max, members[0])
    : null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Meta Total da Equipe */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 via-card to-primary/10 hover:shadow-xl transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Meta Total da Equipe</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(teamTargetValue)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {members.length} colaboradores
                </span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <Target className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atingimento Médio da Equipe */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-card via-card to-muted/30 hover:shadow-xl transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Atingimento Médio</p>
              <p className={cn("text-3xl font-bold", getTeamStatusColor(teamPercentage))}>
                {teamPercentage.toFixed(0)}%
              </p>
              <Badge 
                variant="secondary" 
                className={cn(
                  "mt-2",
                  teamPercentage >= 100 
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" 
                    : teamPercentage >= 70 
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                )}
              >
                {getTeamStatusMessage(teamPercentage)}
              </Badge>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  teamPercentage >= 100 ? "bg-green-500" : teamPercentage >= 70 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${Math.min(teamPercentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(teamCurrentValue)} de {formatCurrency(teamTargetValue)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Top Performer do Mês */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-500/5 via-card to-amber-500/10 hover:shadow-xl transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Top Performer do Mês</p>
              {topPerformer ? (
                <div className="flex items-center gap-3 mt-2">
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-2 border-amber-500">
                      <AvatarImage src={topPerformer.avatar_url || undefined} />
                      <AvatarFallback className="bg-amber-100 text-amber-700">
                        {topPerformer.name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      1º
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{topPerformer.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(topPerformer.currentValue)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum colaborador</p>
              )}
              {topPerformer && topPerformer.percentage >= 100 && (
                <Badge className="bg-green-500 text-white mt-2 animate-pulse">
                  <Trophy className="h-3 w-3 mr-1" />
                  Meta Batida!
                </Badge>
              )}
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Trophy className="h-6 w-6 text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
