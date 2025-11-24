import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoalsPerformance } from "@/hooks/useGoalsPerformance";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PerformanceRankingProps {
  month: number;
  year: number;
}

export function PerformanceRanking({ month, year }: PerformanceRankingProps) {
  const { data: performance, isLoading } = useGoalsPerformance(month, year);

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0: return "🥇";
      case 1: return "🥈";
      case 2: return "🥉";
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "exceeding":
        return <Badge className="bg-green-500">Superando</Badge>;
      case "on_track":
        return <Badge className="bg-blue-500">No Caminho</Badge>;
      case "at_risk":
        return <Badge variant="destructive">Em Risco</Badge>;
      default:
        return <Badge variant="secondary">Sem Meta</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "exceeding":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "on_track":
        return <Minus className="h-4 w-4 text-blue-500" />;
      case "at_risk":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Ranking de Performance
          </CardTitle>
          <CardDescription>Carregando ranking...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!performance || performance.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Ranking de Performance
          </CardTitle>
          <CardDescription>Comparação entre vendedores</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma meta individual encontrada para este período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking de Performance
        </CardTitle>
        <CardDescription>Comparação entre vendedores - Metas do mês</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {performance.map((seller, index) => {
            const medal = getMedalIcon(index);
            const isTopThree = index < 3;

            return (
              <div
                key={seller.userId}
                className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                  isTopThree ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                }`}
              >
                {/* Position & Medal */}
                <div className="flex items-center justify-center w-10 text-lg font-bold">
                  {medal || `${index + 1}º`}
                </div>

                {/* Avatar */}
                <Avatar className="h-12 w-12">
                  <AvatarImage src={seller.avatarUrl || undefined} />
                  <AvatarFallback>
                    {seller.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Info & Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{seller.fullName}</p>
                    {getStatusIcon(seller.status)}
                  </div>
                  
                  <div className="space-y-1">
                    <Progress value={Math.min(seller.percentage, 100)} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(seller.currentValue)} de {formatCurrency(seller.targetValue)}</span>
                      <span className="font-semibold">{seller.percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(seller.status)}
                  <span className="text-xs text-muted-foreground">
                    {seller.dealCount} {seller.dealCount === 1 ? 'venda' : 'vendas'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
