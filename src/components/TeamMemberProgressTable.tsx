import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import { TeamMemberProgress } from "@/hooks/useTeamGoalProgress";

interface TeamMemberProgressTableProps {
  members: TeamMemberProgress[];
}

export function TeamMemberProgressTable({ members }: TeamMemberProgressTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: 'ahead' | 'on_track' | 'behind', percentage: number) => {
    if (percentage >= 100) {
      return (
        <Badge variant="success" className="gap-1">
          <Trophy className="w-3 h-3" />
          Bateu Meta! 🏆
        </Badge>
      );
    }
    if (status === 'on_track') {
      return (
        <Badge variant="warning" className="gap-1">
          <TrendingUp className="w-3 h-3" />
          No Ritmo
        </Badge>
      );
    }
    return (
      <Badge variant="error" className="gap-1">
        <AlertTriangle className="w-3 h-3" />
        Atenção
      </Badge>
    );
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Progresso Individual da Equipe</h3>
      
      {members.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p>Nenhuma meta definida para este período</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Membro</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cargo</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Meta</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Realizado</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Progresso</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b hover:bg-accent/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{member.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className="font-normal">
                      {member.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-foreground">
                    {formatCurrency(member.targetValue)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-foreground">
                    {formatCurrency(member.currentValue)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-semibold text-foreground">
                        {member.percentage.toFixed(0)}%
                      </span>
                      <Progress value={Math.min(member.percentage, 100)} className="w-24 h-2" />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {getStatusBadge(member.status, member.percentage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
