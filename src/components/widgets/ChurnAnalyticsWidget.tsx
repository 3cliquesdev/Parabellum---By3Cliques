import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChurnAnalytics } from "@/hooks/useChurnAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, Users, Percent } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChurnAnalyticsWidget() {
  const { data, isLoading } = useChurnAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const COLORS = {
    green: "hsl(var(--success))",
    yellow: "hsl(var(--warning))",
    red: "hsl(var(--destructive))",
  };

  const pieData = [
    { name: "Saudáveis", value: data.healthDistribution.green, color: COLORS.green },
    { name: "Atenção", value: data.healthDistribution.yellow, color: COLORS.yellow },
    { name: "Críticos", value: data.healthDistribution.red, color: COLORS.red },
  ];

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Análise de Risco de Churn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-success/10 border-success/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-1">
                <div className="text-3xl font-bold text-success">
                  {data.healthDistribution.green}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  Saudáveis
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-1">
                <div className="text-3xl font-bold text-warning">
                  {data.healthDistribution.yellow}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  Atenção
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-1">
                <div className="text-3xl font-bold text-destructive">
                  {data.healthDistribution.red}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  Críticos
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center space-y-1">
                <div className="text-3xl font-bold text-primary">
                  {data.riskPercentage.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Percent className="h-3 w-3" />
                  Em Risco
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Health Score</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Risks by Consultant */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Riscos por Consultor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {data.risksByConsultant.map((item) => (
                    <div
                      key={item.consultantId || "unassigned"}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">{item.consultantName}</div>
                      </div>
                      <Badge variant="destructive" className="ml-auto">
                        {item.riskCount} 🔴
                      </Badge>
                    </div>
                  ))}
                  {data.risksByConsultant.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhum cliente em risco no momento
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Top Risks Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top 10 Clientes em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {data.topRisks.map((risk) => (
                  <div
                    key={risk.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">
                          {risk.first_name} {risk.last_name}
                        </div>
                        <Badge
                          variant={risk.current_health === "red" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {risk.current_health === "red" ? "🔴 Crítico" : "🟡 Atenção"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {risk.company && `${risk.company} • `}
                        {risk.reason} • {risk.consultant_name}
                      </div>
                    </div>
                  </div>
                ))}
                {data.topRisks.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum cliente em risco no momento
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
