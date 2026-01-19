import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useLeadCreationMetrics, 
  getLeadSourceLabel, 
  getLeadSourceColor 
} from "@/hooks/useLeadCreationMetrics";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target, 
  DollarSign,
  ShoppingCart,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

interface DailyMetricsTabProps {
  startDate: Date;
  endDate: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function DailyMetricsTab({ startDate, endDate }: DailyMetricsTabProps) {
  const { data: metrics, isLoading, error } = useLeadCreationMetrics(startDate, endDate);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Erro ao carregar métricas: {error?.message || "Dados indisponíveis"}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const conversionRate = metrics.totalCreated > 0 
    ? ((metrics.totalWon / metrics.totalCreated) * 100).toFixed(1)
    : "0";

  // Prepare pie chart data for sources
  const pieData = metrics.bySource
    .filter(s => s.created > 0)
    .map(s => ({
      name: getLeadSourceLabel(s.source),
      value: s.created,
      color: getLeadSourceColor(s.source),
    }));

  // Calculate gap between Kiwify and deals
  const kiwifyTotal = metrics.kiwifyEvents.total;
  const dealsWon = metrics.totalWon;
  const gap = kiwifyTotal - dealsWon;
  const hasGap = gap > 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Deals Criados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Criados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCreated}</div>
            <p className="text-xs text-muted-foreground">
              Valor em aberto: {formatCurrency(metrics.totalOpenValue)}
            </p>
          </CardContent>
        </Card>

        {/* Deals Ganhos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deals Ganhos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.totalWon}</div>
            <p className="text-xs text-muted-foreground">
              Valor: {formatCurrency(metrics.totalWonValue)}
            </p>
          </CardContent>
        </Card>

        {/* Vendas Kiwify */}
        <Card className={hasGap ? "border-yellow-500/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Kiwify</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{kiwifyTotal}</div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="text-green-600">Novos: {metrics.kiwifyEvents.newCustomers}</span>
              <span>|</span>
              <span className="text-blue-600">
                <RefreshCw className="h-3 w-3 inline mr-0.5" />
                {metrics.kiwifyEvents.recurring}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Conversão */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversão</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Perdidos: {metrics.totalLost}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gap Alert */}
      {hasGap && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-700">
                  Gap de Visibilidade: {gap} vendas Kiwify sem deal correspondente
                </p>
                <p className="text-sm text-muted-foreground">
                  {metrics.kiwifyEvents.total} vendas Kiwify vs {metrics.totalWon} deals ganhos. 
                  Execute a migração histórica ou aguarde as próximas vendas (agora criamos deals automaticamente).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Receita Kiwify */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Receita Kiwify no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Receita Bruta</p>
                <p className="text-xl font-bold">
                  {formatCurrency(metrics.kiwifyEvents.totalGross)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Líquida</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(metrics.kiwifyEvents.totalNet)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Kiwify */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              Breakdown de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Novos Clientes</p>
                <p className="text-xl font-bold text-green-600">
                  {metrics.kiwifyEvents.newCustomers}
                </p>
                <p className="text-xs text-muted-foreground">
                  {((metrics.kiwifyEvents.newCustomers / Math.max(kiwifyTotal, 1)) * 100).toFixed(0)}% do total
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recorrentes</p>
                <p className="text-xl font-bold text-blue-600">
                  {metrics.kiwifyEvents.recurring}
                </p>
                <p className="text-xs text-muted-foreground">
                  {((metrics.kiwifyEvents.recurring / Math.max(kiwifyTotal, 1)) * 100).toFixed(0)}% do total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart - Criados vs Ganhos por Fonte */}
        <Card>
          <CardHeader>
            <CardTitle>Performance por Fonte</CardTitle>
            <CardDescription>
              Deals criados vs ganhos por origem
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.bySource.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.bySource.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="source" 
                    tickFormatter={getLeadSourceLabel}
                    width={100}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name === "created" ? "Criados" : "Ganhos"]}
                    labelFormatter={(label) => getLeadSourceLabel(label as string)}
                  />
                  <Bar dataKey="created" fill="hsl(var(--muted-foreground))" name="Criados" />
                  <Bar dataKey="won" fill="hsl(var(--primary))" name="Ganhos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Distribuição por Fonte */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Fonte</CardTitle>
            <CardDescription>
              Proporção de deals criados por origem
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => 
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table - Detailed by Source */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Fonte</CardTitle>
          <CardDescription>
            Métricas completas de criação e conversão por origem de lead
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Fonte</th>
                  <th className="text-right py-3 px-4 font-medium">Criados</th>
                  <th className="text-right py-3 px-4 font-medium">Ganhos</th>
                  <th className="text-right py-3 px-4 font-medium">Perdidos</th>
                  <th className="text-right py-3 px-4 font-medium">Conversão</th>
                  <th className="text-right py-3 px-4 font-medium">Valor Ganho</th>
                </tr>
              </thead>
              <tbody>
                {metrics.bySource.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum dado disponível no período selecionado
                    </td>
                  </tr>
                ) : (
                  metrics.bySource.map((source) => (
                    <tr key={source.source} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getLeadSourceColor(source.source) }}
                          />
                          {getLeadSourceLabel(source.source)}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">{source.created}</td>
                      <td className="text-right py-3 px-4 text-green-600 font-medium">
                        {source.won}
                      </td>
                      <td className="text-right py-3 px-4 text-red-600">
                        {source.lost}
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className={source.conversionRate > 20 ? "text-green-600" : ""}>
                          {source.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 font-medium">
                        {formatCurrency(source.totalValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {metrics.bySource.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-medium">
                    <td className="py-3 px-4">TOTAL</td>
                    <td className="text-right py-3 px-4">{metrics.totalCreated}</td>
                    <td className="text-right py-3 px-4 text-green-600">{metrics.totalWon}</td>
                    <td className="text-right py-3 px-4 text-red-600">{metrics.totalLost}</td>
                    <td className="text-right py-3 px-4">{conversionRate}%</td>
                    <td className="text-right py-3 px-4">{formatCurrency(metrics.totalWonValue)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
