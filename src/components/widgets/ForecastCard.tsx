import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, AlertCircle, CheckCircle } from "lucide-react";

interface ForecastCardProps {
  currentValue: number;
  targetValue: number;
  daysElapsed: number;
  totalDays: number;
}

export function ForecastCard({ currentValue, targetValue, daysElapsed, totalDays }: ForecastCardProps) {
  const dailyAverage = daysElapsed > 0 ? currentValue / daysElapsed : 0;
  const forecastValue = dailyAverage * totalDays;
  const shortfall = targetValue - forecastValue;
  const willMeetGoal = forecastValue >= targetValue;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Previsão de Fechamento
        </CardTitle>
        <CardDescription>
          Baseado na sua média diária atual
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Forecast Value */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-2">Projeção para o final do mês</p>
          <p className={`text-4xl font-bold mb-2 ${
            willMeetGoal ? 'text-green-600' : 'text-destructive'
          }`}>
            {formatCurrency(forecastValue)}
          </p>
          <Badge variant={willMeetGoal ? "default" : "destructive"} className="text-xs">
            {willMeetGoal ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Meta será atingida
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Abaixo da meta
              </>
            )}
          </Badge>
        </div>

        {/* Shortfall Alert */}
        {!willMeetGoal && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive mb-1">
                  Faltam {formatCurrency(Math.abs(shortfall))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Você precisa acelerar as vendas para atingir a meta de {formatCurrency(targetValue)}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Média Diária</p>
            <p className="text-lg font-bold">{formatCurrency(dailyAverage)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Meta Diária Ideal</p>
            <p className="text-lg font-bold">
              {formatCurrency(targetValue / totalDays)}
            </p>
          </div>
        </div>

        {/* What You Need */}
        {!willMeetGoal && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Para atingir a meta, venda:</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(Math.abs(shortfall) / (totalDays - daysElapsed))}
              <span className="text-sm font-normal text-muted-foreground">/dia</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}