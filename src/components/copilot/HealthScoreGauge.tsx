import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, TrendingUp, Target, Zap, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HealthScoreGaugeProps {
  score: number | null | undefined;
  isLoading?: boolean;
  // Componentes explicáveis
  adoptionComponent?: number;
  kbComponent?: number;
  csatComponent?: number;
  usageComponent?: number;
  dataQuality?: 'alta' | 'média' | 'baixa';
}

export function HealthScoreGauge({ 
  score, 
  isLoading,
  adoptionComponent,
  kbComponent,
  csatComponent,
  usageComponent,
  dataQuality 
}: HealthScoreGaugeProps) {
  const safeScore = score ?? 0;

  // Determine color based on score
  const getScoreColor = (value: number) => {
    if (value >= 70) return "hsl(var(--chart-2))"; // Green/success
    if (value >= 40) return "hsl(var(--chart-4))"; // Yellow/warning
    return "hsl(var(--destructive))"; // Red/critical
  };

  const getScoreLabel = (value: number) => {
    if (value >= 70) return "Saudável";
    if (value >= 40) return "Atenção";
    return "Crítico";
  };

  const data = [
    {
      name: "Health Score",
      value: safeScore,
      fill: getScoreColor(safeScore),
    },
  ];

  const hasComponents = adoptionComponent !== undefined || 
                        kbComponent !== undefined || 
                        csatComponent !== undefined || 
                        usageComponent !== undefined;

  const components = [
    { 
      label: "Adoção IA", 
      value: adoptionComponent ?? 0, 
      icon: TrendingUp,
      description: "% de conversas usando Copilot" 
    },
    { 
      label: "Cobertura KB", 
      value: kbComponent ?? 0, 
      icon: BookOpen,
      description: "% de conversas sem KB Gaps" 
    },
    { 
      label: "CSAT", 
      value: csatComponent ?? 0, 
      icon: Target,
      description: "Satisfação normalizada (1-5 → 0-25)" 
    },
    { 
      label: "Aproveitamento", 
      value: usageComponent ?? 0, 
      icon: Zap,
      description: "% de sugestões utilizadas" 
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Health Score da Operação
          {dataQuality && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge 
                    variant={dataQuality === 'baixa' ? 'destructive' : dataQuality === 'média' ? 'secondary' : 'outline'}
                    className="text-xs ml-2"
                  >
                    {dataQuality === 'baixa' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    Dados: {dataQuality}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {dataQuality === 'baixa' && "Poucos dados — score pode não refletir tendência real"}
                  {dataQuality === 'média' && "Volume médio de dados — tendências razoavelmente confiáveis"}
                  {dataQuality === 'alta' && "Volume alto de dados — tendências confiáveis"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Skeleton className="h-32 w-32 rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gauge */}
            <div className="relative h-40 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="80%"
                  barSize={12}
                  data={data}
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
                    background={{ fill: "hsl(var(--muted))" }}
                    dataKey="value"
                    cornerRadius={6}
                    angleAxisId={0}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                <span
                  className="text-4xl font-bold"
                  style={{ color: getScoreColor(safeScore) }}
                >
                  {safeScore}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: getScoreColor(safeScore) }}
                >
                  {getScoreLabel(safeScore)}
                </span>
              </div>
            </div>

            {/* Componentes Explicáveis */}
            {hasComponents && (
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground mb-3 font-medium">
                  Composição do Score (0-25 pts cada)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {components.map((comp) => (
                    <TooltipProvider key={comp.label}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md hover:bg-muted/70 transition-colors cursor-help">
                            <div className="flex items-center gap-2">
                              <comp.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{comp.label}</span>
                            </div>
                            <span className="text-sm font-semibold">{comp.value.toFixed(1)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">{comp.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            )}

            {/* Aviso de poucos dados */}
            {dataQuality === 'baixa' && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-xs">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  <strong>Poucos dados:</strong> O score pode não refletir a tendência real. 
                  Aguarde mais conversas para maior precisão.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
