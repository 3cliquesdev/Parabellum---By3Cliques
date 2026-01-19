import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKiwifyCompleteMetrics } from "@/hooks/useKiwifyCompleteMetrics";
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart, RefreshCw, AlertTriangle, Percent, Users, Package, Tag } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

interface KiwifyFinancialReportProps {
  startDate?: Date;
  endDate?: Date;
}

export function KiwifyFinancialReport({ startDate, endDate }: KiwifyFinancialReportProps) {
  const [minValue, setMinValue] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  
  const { data, isLoading, error } = useKiwifyCompleteMetrics(startDate, endDate, minValue);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const exportCSV = () => {
    if (!data) return;

    const rows = [
      ['Relatório Financeiro Kiwify'],
      [`Período: ${startDate?.toLocaleDateString('pt-BR')} - ${endDate?.toLocaleDateString('pt-BR')}`],
      [''],
      ['VENDAS'],
      ['Vendas Aprovadas', data.vendasAprovadas],
      ['Clientes Únicos', data.clientesUnicos],
      ['Vendas Novas', data.vendasNovas],
      ['Renovações', data.renovacoes],
      [''],
      ['RECEITAS'],
      ['Receita Bruta', data.receitaBruta.toFixed(2)],
      ['Taxa Kiwify', data.taxaKiwify.toFixed(2)],
      ['Comissão Afiliados', data.comissaoAfiliados.toFixed(2)],
      ['Receita Líquida', data.receitaLiquida.toFixed(2)],
      [''],
      ['CANCELAMENTOS'],
      ['Reembolsos', data.reembolsos.quantidade, data.reembolsos.valor.toFixed(2)],
      ['Chargebacks', data.chargebacks.quantidade, data.chargebacks.valor.toFixed(2)],
      ['Taxa de Churn', `${data.taxaChurn.toFixed(2)}%`],
      [''],
      ['PAGAMENTOS PENDENTES'],
      ['Aguardando Pagamento', data.aguardandoPagamento.quantidade, data.aguardandoPagamento.valor.toFixed(2)],
      ['Recusados', data.recusados.quantidade, data.recusados.valor.toFixed(2)],
      [''],
      ['PRODUTOS'],
      ['Produto', 'Vendas', 'Bruto', 'Líquido', 'Taxa Kiwify', 'Comissão'],
      ...data.porProduto.map(p => [
        p.product_name,
        p.vendas,
        p.bruto.toFixed(2),
        p.liquido.toFixed(2),
        p.taxaKiwify.toFixed(2),
        p.comissaoAfiliados.toFixed(2)
      ])
    ];

    const csvContent = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-financeiro-kiwify-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6">
          <p className="text-destructive">Erro ao carregar dados financeiros</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Relatório Financeiro Kiwify
              </CardTitle>
              <CardDescription>
                {startDate?.toLocaleDateString('pt-BR')} - {endDate?.toLocaleDateString('pt-BR')} • {data.totalEventos.toLocaleString()} eventos processados
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-filters"
                  checked={showFilters}
                  onCheckedChange={setShowFilters}
                />
                <Label htmlFor="show-filters" className="text-sm">Filtros</Label>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="pt-0 border-t">
            <div className="grid gap-4 md:grid-cols-2 pt-4">
              <div className="space-y-2">
                <Label className="text-sm">Valor Mínimo: {formatCurrency(minValue)}</Label>
                <Slider
                  value={[minValue]}
                  onValueChange={(v) => setMinValue(v[0])}
                  min={0}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Exclui vendas abaixo do valor para filtrar testes
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Vendas Aprovadas */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vendas Aprovadas</p>
                <p className="text-3xl font-bold">{data.vendasAprovadas.toLocaleString()}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{data.vendasNovas} novas</Badge>
                  <Badge variant="outline">{data.renovacoes} renovações</Badge>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clientes Únicos */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clientes Únicos</p>
                <p className="text-3xl font-bold">{data.clientesUnicos.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Média {data.vendasAprovadas > 0 && data.clientesUnicos > 0 
                    ? (data.vendasAprovadas / data.clientesUnicos).toFixed(1) 
                    : 0} vendas/cliente
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receita Bruta */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receita Bruta</p>
                <p className="text-3xl font-bold">{formatCurrency(data.receitaBruta)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Valor total das vendas
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taxa Kiwify */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa Kiwify</p>
                <p className="text-3xl font-bold text-orange-500">
                  {formatCurrency(data.taxaKiwify)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatPercent(data.percentualTaxaKiwify)} do bruto
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Percent className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comissão Afiliados */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Comissão Afiliados</p>
                <p className="text-3xl font-bold text-purple-500">
                  {formatCurrency(data.comissaoAfiliados)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatPercent(data.percentualComissao)} do bruto
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receita Líquida */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receita Líquida</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(data.receitaLiquida)}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatPercent(data.percentualLiquido)} do bruto
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown de Taxas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breakdown de Taxas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Taxa Kiwify */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                Taxa Kiwify
              </span>
              <span className="font-medium">
                {formatCurrency(data.taxaKiwify)} ({formatPercent(data.percentualTaxaKiwify)})
              </span>
            </div>
            <Progress value={data.percentualTaxaKiwify} className="h-2" />
          </div>

          {/* Comissão Afiliados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500" />
                Comissão Afiliados
              </span>
              <span className="font-medium">
                {formatCurrency(data.comissaoAfiliados)} ({formatPercent(data.percentualComissao)})
              </span>
            </div>
            <Progress value={data.percentualComissao} className="h-2" />
          </div>

          {/* Líquido */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                Receita Líquida
              </span>
              <span className="font-medium text-green-600">
                {formatCurrency(data.receitaLiquida)} ({formatPercent(data.percentualLiquido)})
              </span>
            </div>
            <Progress value={data.percentualLiquido} className="h-2 bg-muted [&>div]:bg-green-500" />
          </div>
        </CardContent>
      </Card>

      {/* Cancelamentos e Churn */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cancelamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Reembolsos */}
              <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <RefreshCw className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{data.reembolsos.quantidade}</p>
                <p className="text-xs text-muted-foreground">Reembolsos</p>
                <p className="text-sm font-medium text-orange-600">{formatCurrency(data.reembolsos.valor)}</p>
              </div>

              {/* Chargebacks */}
              <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                <p className="text-2xl font-bold">{data.chargebacks.quantidade}</p>
                <p className="text-xs text-muted-foreground">Chargebacks</p>
                <p className="text-sm font-medium text-red-600">{formatCurrency(data.chargebacks.valor)}</p>
              </div>

              {/* Pendentes */}
              <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <TrendingDown className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                <p className="text-2xl font-bold">{data.reembolsosPendentes.quantidade}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-sm font-medium text-yellow-600">{formatCurrency(data.reembolsosPendentes.valor)}</p>
              </div>
            </div>

            {/* Taxa de Churn */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Taxa de Churn</span>
                <span className={`text-2xl font-bold ${data.taxaChurn > 10 ? 'text-red-500' : data.taxaChurn > 5 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {formatPercent(data.taxaChurn)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                (Reembolsos + Chargebacks) / Vendas Totais × 100
              </p>
              <Progress 
                value={Math.min(data.taxaChurn, 100)} 
                className={`h-2 mt-2 ${data.taxaChurn > 10 ? '[&>div]:bg-red-500' : data.taxaChurn > 5 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} 
              />
            </div>
          </CardContent>
        </Card>

        {/* Pagamentos Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-yellow-500" />
              Pagamentos em Risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Aguardando Pagamento */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div>
                <p className="font-medium">Aguardando Pagamento</p>
                <p className="text-xs text-muted-foreground">{data.aguardandoPagamento.quantidade} pedidos</p>
              </div>
              <p className="text-lg font-bold text-yellow-600">{formatCurrency(data.aguardandoPagamento.valor)}</p>
            </div>

            {/* Recusados */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div>
                <p className="font-medium">Pagamentos Recusados</p>
                <p className="text-xs text-muted-foreground">{data.recusados.quantidade} pedidos</p>
              </div>
              <p className="text-lg font-bold text-red-600">{formatCurrency(data.recusados.valor)}</p>
            </div>

            {/* Cancelados */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted border">
              <div>
                <p className="font-medium">Cancelados pelo Cliente</p>
                <p className="text-xs text-muted-foreground">{data.cancelados.quantidade} pedidos</p>
              </div>
              <p className="text-lg font-bold">{formatCurrency(data.cancelados.valor)}</p>
            </div>

            {/* Total em Risco */}
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total em Risco</span>
                <span className="text-xl font-bold text-destructive">
                  {formatCurrency(
                    data.aguardandoPagamento.valor + 
                    data.recusados.valor + 
                    data.cancelados.valor
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.aguardandoPagamento.quantidade + data.recusados.quantidade + data.cancelados.quantidade} pedidos não convertidos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendas por Oferta - Gráfico */}
      {data.porOferta && data.porOferta.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="h-5 w-5 text-blue-500" />
              Vendas por Oferta
            </CardTitle>
            <CardDescription>
              Top 10 ofertas por quantidade de vendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                vendas: { label: "Vendas", color: "hsl(var(--primary))" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.porOferta.slice(0, 10).map(o => ({
                    name: o.offer_name.length > 25 ? o.offer_name.substring(0, 25) + '...' : o.offer_name,
                    vendas: o.vendas,
                    bruto: o.bruto,
                  }))}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="vendas" radius={[0, 4, 4, 0]}>
                    {data.porOferta.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.08})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            {/* Tabela de Ofertas */}
            <div className="overflow-x-auto mt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oferta</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita Bruta</TableHead>
                    <TableHead className="text-right">Receita Líquida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.porOferta.slice(0, 10).map((offer) => (
                    <TableRow key={offer.offer_id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {offer.offer_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {offer.product_name}
                      </TableCell>
                      <TableCell className="text-right">{offer.vendas}</TableCell>
                      <TableCell className="text-right">{formatCurrency(offer.bruto)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatCurrency(offer.liquido)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.porOferta.length > 10 && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Mostrando top 10 de {data.porOferta.length} ofertas
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Vendas por Produto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Receita Bruta</TableHead>
                  <TableHead className="text-right">Taxa Kiwify</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Receita Líquida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.porProduto.slice(0, 10).map((product) => (
                  <TableRow key={product.product_id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {product.product_name}
                    </TableCell>
                    <TableCell className="text-right">{product.vendas}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.bruto)}</TableCell>
                    <TableCell className="text-right text-orange-600">
                      {formatCurrency(product.taxaKiwify)}
                    </TableCell>
                    <TableCell className="text-right text-purple-600">
                      {formatCurrency(product.comissaoAfiliados)}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {formatCurrency(product.liquido)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.porProduto.length > 10 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Mostrando top 10 de {data.porProduto.length} produtos
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Top Afiliados */}
      {data.topAffiliates && data.topAffiliates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Top Afiliados
            </CardTitle>
            <CardDescription>
              Afiliados que mais geraram vendas no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Vendas</TableHead>
                    <TableHead className="text-right">Comissão Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topAffiliates.slice(0, 10).map((affiliate, index) => (
                    <TableRow key={affiliate.affiliateEmail + index}>
                      <TableCell className="font-medium">{affiliate.affiliateName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{affiliate.affiliateEmail}</TableCell>
                      <TableCell className="text-center">{affiliate.salesCount}</TableCell>
                      <TableCell className="text-right font-semibold text-purple-600">
                        {formatCurrency(affiliate.totalCommission)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {data.topAffiliates.length > 10 && (
              <p className="text-xs text-muted-foreground text-center mt-4">
                Mostrando top 10 de {data.topAffiliates.length} afiliados
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
