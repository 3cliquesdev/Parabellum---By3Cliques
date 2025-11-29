import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

interface PacingGaugeProps {
  currentValue: number;
  targetValue: number;
  daysElapsed: number;
  totalDays: number;
}

export function PacingGauge({ currentValue, targetValue, daysElapsed, totalDays }: PacingGaugeProps) {
  const currentPercentage = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const expectedPercentage = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;
  
  const pacingDifference = currentValue - (targetValue * (daysElapsed / totalDays));
  const isPacingBehind = pacingDifference < 0;
  const isPacingAhead = pacingDifference > 0;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getGaugeColor = () => {
    if (currentPercentage >= expectedPercentage) return "hsl(142, 76%, 36%)"; // Green
    if (currentPercentage >= expectedPercentage * 0.8) return "hsl(48, 96%, 53%)"; // Yellow
    return "hsl(0, 84%, 60%)"; // Red
  };

  const gaugeData = [
    {
      name: "Progresso",
      value: Math.min(currentPercentage, 100),
      fill: getGaugeColor(),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gauge className="h-5 w-5 text-primary" />
          Ritmo de Vendas (Pacing)
        </CardTitle>
        <CardDescription>
          Onde você está vs onde deveria estar hoje
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Gauge Chart */}
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="90%"
              data={gaugeData}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={10}
                fill={getGaugeColor()}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-bold" style={{ color: getGaugeColor() }}>
              {currentPercentage.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Atingido</p>
          </div>
        </div>

        {/* Expected Pace Line */}
        <div className="flex items-center justify-between mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Ritmo Ideal</span>
          </div>
          <Badge variant="secondary" className="font-mono">
            {expectedPercentage.toFixed(0)}%
          </Badge>
        </div>

        {/* Pacing Alert */}
        <div className={`mt-4 p-4 rounded-lg border ${
          isPacingBehind ? 'bg-destructive/10 border-destructive/20' :
          isPacingAhead ? 'bg-green-500/10 border-green-500/20' :
          'bg-muted/50 border-border'
        }`}>
          <div className="flex items-start gap-3">
            {isPacingBehind ? (
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            ) : isPacingAhead ? (
              <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : null}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold mb-1 ${
                isPacingBehind ? 'text-destructive' :
                isPacingAhead ? 'text-green-600' :
                'text-foreground'
              }`}>
                {isPacingBehind && "⚠️ Você está atrasado"}
                {isPacingAhead && "🎉 Você está acima do ritmo!"}
                {!isPacingBehind && !isPacingAhead && "✓ Você está no ritmo"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPacingBehind && `Você está ${formatCurrency(Math.abs(pacingDifference))} abaixo do ideal para hoje.`}
                {isPacingAhead && `Você está ${formatCurrency(Math.abs(pacingDifference))} acima do esperado!`}
                {!isPacingBehind && !isPacingAhead && "Continue assim para atingir a meta."}
              </p>
            </div>
          </div>
        </div>

        {/* Days Info */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Dias Decorridos</p>
            <p className="text-lg font-bold">{daysElapsed}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Dias Restantes</p>
            <p className="text-lg font-bold">{totalDays - daysElapsed}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}