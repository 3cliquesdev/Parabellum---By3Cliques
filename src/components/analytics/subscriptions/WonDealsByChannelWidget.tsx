import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWonDealsByChannel } from "@/hooks/useWonDealsByChannel";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Trophy, Users, TrendingUp, RefreshCw, ShoppingBag, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
            <Trophy className="h-5 w-5 text-warning" />
            Deals Ganhos
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

  const { byChannel, bySalesRep, commercialBreakdown, kiwifyBreakdown, totals } = data;

  // Separar vendedores reais de categorias orgânicas
  const realSalesReps = bySalesRep.filter(rep => !rep.isOrganic);
  const organicCategories = bySalesRep.filter(rep => rep.isOrganic);

  // Top vendedor para destaque
  const topSeller = realSalesReps[0];
  const maxRevenue = topSeller?.revenue || 1;

  // Breakdown comercial para exibição (apenas itens com vendas)
  const breakdownItems = Object.values(commercialBreakdown).filter(item => item.deals > 0);
  const maxBreakdownRevenue = Math.max(...breakdownItems.map(i => i.revenue), 1);

  // Breakdown Kiwify para exibição (apenas itens com vendas)
  const kiwifyItems = Object.values(kiwifyBreakdown).filter(item => item.deals > 0);
  const maxKiwifyRevenue = Math.max(...kiwifyItems.map(i => i.revenue), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-warning" />
            Deals Ganhos
            <Badge variant="secondary" className="ml-2">
              {totals.totalDeals} vendas
            </Badge>
          </CardTitle>
          <span className="text-sm text-muted-foreground">
             {formatCurrency(totals.totalRevenue)} em receita
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Desempenho do time comercial e vendas automáticas (CRM + Kiwify)
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ALERTA: Deals sem atribuição que deveriam ter vendedor */}
        {(() => {
          // Deals de Recuperação/Formulário em Kiwify = sem vendedor atribuído
          // Comparar: totais do sistema vs o que o time comercial tem atribuído
          const recuperacaoNoComercial = commercialBreakdown.recuperacao?.deals || 0;
          const formulariosNoComercial = commercialBreakdown.formularios?.deals || 0;
          
          // Se há deals de recuperação/formulário nos totais mas NÃO estão no breakdown comercial
          const dealsRecuperacaoSemVendedor = totals.recuperacaoDeals - recuperacaoNoComercial;
          const dealsFormularioSemVendedor = totals.formulariosDeals - formulariosNoComercial;
          const totalSemAtribuicao = Math.max(0, dealsRecuperacaoSemVendedor) + Math.max(0, dealsFormularioSemVendedor);
          
          if (totalSemAtribuicao > 0) {
            return (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>{totalSemAtribuicao} deals comerciais sem vendedor atribuído:</strong>{" "}
                  {dealsRecuperacaoSemVendedor > 0 && `${dealsRecuperacaoSemVendedor} de Recuperação`}
                  {dealsRecuperacaoSemVendedor > 0 && dealsFormularioSemVendedor > 0 && " + "}
                  {dealsFormularioSemVendedor > 0 && `${dealsFormularioSemVendedor} de Formulário`}.
                  {" "}Esses deals aparecem em "Kiwify" mas deveriam estar em "Comercial".
                </AlertDescription>
              </Alert>
            );
          }
          return null;
        })()}

        {/* ROW 1: Detalhamentos LADO A LADO (desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Detalhamento COMERCIAL (sub-canais do time) */}
          {breakdownItems.length > 0 && (
            <div className="space-y-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium text-foreground">
                  Detalhamento Comercial (Por Canal)
                </h4>
              </div>
              <div className="space-y-2">
                {breakdownItems.map((item) => (
                  <div
                    key={item.channel}
                    className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border/50"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{item.channel}</span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-foreground/70">{item.deals} deals</span>
                          <span className="font-medium text-success">{formatCurrency(item.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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
              <p className="text-xs text-foreground/70">
                💡 WhatsApp, Manual, Webchat, Recuperação e Formulários são canais onde o time comercial atua ativamente.
              </p>
            </div>
          )}

          {/* Detalhamento KIWIFY (sub-canais não-comerciais) */}
          {kiwifyItems.length > 0 && (
            <div className="space-y-3 p-3 rounded-lg bg-warning/5 border border-warning/15">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-warning" />
                <h4 className="text-sm font-medium text-foreground">
                  Detalhamento Kiwify (Por Canal)
                </h4>
              </div>
              <div className="space-y-2">
                {kiwifyItems.map((item) => (
                  <div
                    key={item.channel}
                    className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border/50"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{item.channel}</span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-foreground/70">{item.deals} deals</span>
                          <span className="font-medium text-success">{formatCurrency(item.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${(item.revenue / maxKiwifyRevenue) * 100}%`,
                            backgroundColor: item.color 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-foreground/70">
                💡 Afiliados, Recorrência e Orgânico são vendas via Kiwify que não passam pelo time comercial.
              </p>
            </div>
          )}
        </div>

        {/* ROW 2: Insight (logo abaixo dos detalhamentos) */}
        {(() => {
          const totalComercialDeals = 
            commercialBreakdown.whatsapp.deals + 
            commercialBreakdown.ofertaComercial.deals +
            commercialBreakdown.manual.deals + 
            commercialBreakdown.webchat.deals + 
            commercialBreakdown.recuperacao.deals + 
            commercialBreakdown.formularios.deals;
          
          const totalComercialRevenue = 
            commercialBreakdown.whatsapp.revenue + 
            commercialBreakdown.ofertaComercial.revenue +
            commercialBreakdown.manual.revenue + 
            commercialBreakdown.webchat.revenue + 
            commercialBreakdown.recuperacao.revenue + 
            commercialBreakdown.formularios.revenue;
          
          const percentualAutomatico = totals.totalDeals > 0 
            ? ((totals.organicDeals + totals.recurringDeals + totals.affiliateDeals) / totals.totalDeals * 100).toFixed(0)
            : "0";
          
          return (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-sm text-foreground">
                💡 <strong>Insight:</strong>{" "}
                {percentualAutomatico}% das vendas são automáticas (orgânico + afiliados + recorrência), 
                sem intervenção do time comercial.
                {totalComercialDeals > 0 && (
                  <> O time comercial converteu {totalComercialDeals} deals 
                  ({formatCurrency(totalComercialRevenue)}).</>
                )}
              </p>
            </div>
          );
        })()}

        {/* ROW 3: Gráfico de Pizza (por último nesta seção) */}
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

        {/* Ranking de Vendedores do Time Comercial */}
        {realSalesReps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
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
                        <span className="text-foreground/70">{rep.deals} deals</span>
                        <span className="font-medium text-success">{formatCurrency(rep.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
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
              <ShoppingBag className="h-4 w-4 text-info" />
              <h4 className="text-sm font-medium">Vendas Automáticas (Sem Atribuição)</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {organicCategories.map((cat) => {
                const Icon = cat.repName.includes("Recorrência") ? RefreshCw : 
                             cat.repName.includes("Afiliados") ? Users : TrendingUp;
                const iconColor = cat.repName.includes("Recorrência") ? "text-info" :
                                  cat.repName.includes("Afiliados") ? "text-warning" : "text-primary";
                
                return (
                  <div
                    key={cat.repName}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{cat.repName}</p>
                      <p className="text-xs text-foreground/70">
                        {cat.deals} deals • {cat.percentage.toFixed(0)}%
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-success">
                      {formatCurrency(cat.revenue)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
