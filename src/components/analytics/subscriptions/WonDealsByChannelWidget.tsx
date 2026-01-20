import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWonDealsByChannel } from "@/hooks/useWonDealsByChannel";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Trophy, Users, TrendingUp, RefreshCw, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WonDealsByChannelWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function WonDealsByChannelWidget({ startDate, endDate }: WonDealsByChannelWidgetProps) {
  const { data, isLoading } = useWonDealsByChannel(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totals.totalDeals === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-amber-500" />
            Quem Ganhou os Deals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Nenhum deal ganho no período selecionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { byChannel, bySalesRep, commercialBreakdown, totals } = data;

  // Separar vendedores reais de categorias orgânicas
  const realSalesReps = bySalesRep.filter(rep => !rep.isOrganic);
  const organicCategories = bySalesRep.filter(rep => rep.isOrganic);

  // Top vendedor para destaque
  const topSeller = realSalesReps[0];
  const maxRevenue = topSeller?.revenue || 1;

  // Breakdown comercial para exibição (apenas itens com vendas)
  const breakdownItems = Object.values(commercialBreakdown).filter(item => item.deals > 0);
  const maxBreakdownRevenue = Math.max(...breakdownItems.map(i => i.revenue), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-amber-500" />
            Quem Ganhou os Deals
            <Badge variant="secondary" className="ml-2">
              {totals.totalDeals} vendas
            </Badge>
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {formatCurrency(totals.totalRevenue)} em receita
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Grid principal: Gráfico + Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gráfico de Pizza */}
          <div className="flex flex-col items-center">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Distribuição por Canal
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={byChannel}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="deals"
                  nameKey="channel"
                >
                  {byChannel.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} deals (${props.payload.percentage.toFixed(0)}%)`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Breakdown por Canal + Detalhamento Comercial */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Detalhamento por Canal
              </h4>
              <div className="space-y-2">
                {byChannel.map((channel) => (
                  <div
                    key={channel.channel}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: channel.color }}
                      />
                      <span className="text-sm font-medium">{channel.channel}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">
                        {channel.deals} deals
                      </span>
                      <span className="text-sm font-medium">
                        {formatCurrency(channel.revenue)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {channel.percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhamento COMERCIAL (sub-canais do time) */}
            {breakdownItems.length > 0 && (
              <div className="space-y-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Detalhamento Comercial (Por Canal)
                  </h4>
                </div>
                <div className="space-y-2">
                  {breakdownItems.map((item) => (
                    <div
                      key={item.channel}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-slate-800 border border-border/50"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{item.channel}</span>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-foreground/70">{item.deals} deals</span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(item.revenue)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${(item.revenue / maxBreakdownRevenue) * 100}%`,
                              backgroundColor: item.color 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 WhatsApp, Manual, Webchat, Recuperação e Formulários são canais onde o time comercial atua ativamente.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ranking de Vendedores do Time Comercial */}
        {realSalesReps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium">Top Vendedores (Time Comercial)</h4>
            </div>
            <div className="space-y-2">
              {realSalesReps.slice(0, 5).map((rep, index) => (
                <div
                  key={rep.repId}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                >
                  <span className="text-lg">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{rep.repName}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-foreground/70">
                          {rep.deals} deals
                        </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(rep.revenue)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(rep.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vendas Automáticas (sem atribuição) */}
        {organicCategories.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-medium">Vendas Automáticas (Sem Atribuição)</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {organicCategories.map((cat) => {
                const Icon = cat.repName.includes("Recorrência") ? RefreshCw : 
                             cat.repName.includes("Afiliados") ? Users : TrendingUp;
                const iconColor = cat.repName.includes("Recorrência") ? "text-cyan-500" :
                                  cat.repName.includes("Afiliados") ? "text-orange-500" : "text-purple-500";
                
                return (
                  <div
                    key={cat.repName}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{cat.repName}</p>
                      <p className="text-xs text-foreground/60">
                        {cat.deals} deals • {cat.percentage.toFixed(0)}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(cat.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insight resumido */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            💡 <strong>Insight:</strong>{" "}
            {((totals.organicDeals + totals.recurringDeals) / totals.totalDeals * 100).toFixed(0)}% das vendas 
            são automáticas (orgânico + recorrência), sem intervenção do time comercial.
            {realSalesReps.length > 0 && (
              <> O time comercial converteu {realSalesReps.reduce((s, r) => s + r.deals, 0)} deals 
              ({formatCurrency(realSalesReps.reduce((s, r) => s + r.revenue, 0))}).</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
