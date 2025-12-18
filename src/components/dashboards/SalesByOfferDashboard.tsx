import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Package, TrendingUp, AlertTriangle, DollarSign } from "lucide-react";

interface OfferStats {
  offer_id: string;
  offer_name: string;
  product_name: string;
  total_sales: number;
  gross_value: number;
  net_value: number;
  refunds: number;
  is_mapped: boolean;
}

export default function SalesByOfferDashboard() {
  const { data: offerStats, isLoading } = useQuery({
    queryKey: ['sales-by-offer-dashboard'],
    queryFn: async () => {
      // Buscar todos eventos pagos
      const { data: events, error } = await supabase
        .from('kiwify_events')
        .select('offer_id, event_type, payload, created_at')
        .in('event_type', ['paid', 'order_approved', 'refunded', 'chargedback']);
      
      if (error) throw error;
      
      // Buscar ofertas mapeadas
      const { data: offers } = await supabase
        .from('product_offers')
        .select('kiwify_offer_id, offer_name, products:product_id(name)');
      
      const offerMap = new Map<string, { offer_name: string; product_name: string }>();
      offers?.forEach((o: any) => {
        offerMap.set(o.kiwify_offer_id, {
          offer_name: o.offer_name,
          product_name: o.products?.name || 'N/A'
        });
      });
      
      // Agregar por offer_id
      const statsMap = new Map<string, OfferStats>();
      
      events?.forEach((e: any) => {
        const offerId = e.offer_id || 'sem_offer_id';
        const payload = e.payload || {};
        const subscription = payload.Subscription || {};
        const charges = subscription.charges || {};
        const plan = subscription.plan || {};
        
        const grossValue = parseFloat(charges.completed_at_value || plan.price || 0) / 100;
        const kiwifyFee = grossValue * 0.0899;
        const affiliateComm = parseFloat(payload.affiliate_commission || 0) / 100;
        const netValue = grossValue - kiwifyFee - affiliateComm;
        
        const mapped = offerMap.get(offerId);
        const offerName = mapped?.offer_name || payload.Product?.offer_name || plan.name || 'Oferta não mapeada';
        const productName = mapped?.product_name || payload.Product?.name || 'Produto desconhecido';
        
        if (!statsMap.has(offerId)) {
          statsMap.set(offerId, {
            offer_id: offerId,
            offer_name: offerName,
            product_name: productName,
            total_sales: 0,
            gross_value: 0,
            net_value: 0,
            refunds: 0,
            is_mapped: !!mapped,
          });
        }
        
        const stats = statsMap.get(offerId)!;
        
        if (e.event_type === 'paid' || e.event_type === 'order_approved') {
          stats.total_sales++;
          stats.gross_value += grossValue;
          stats.net_value += netValue;
        } else if (e.event_type === 'refunded' || e.event_type === 'chargedback') {
          stats.refunds++;
        }
      });
      
      return Array.from(statsMap.values()).sort((a, b) => b.gross_value - a.gross_value);
    },
    staleTime: 60 * 1000,
  });
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };
  
  const totalGross = offerStats?.reduce((sum, o) => sum + o.gross_value, 0) || 0;
  const totalNet = offerStats?.reduce((sum, o) => sum + o.net_value, 0) || 0;
  const totalSales = offerStats?.reduce((sum, o) => sum + o.total_sales, 0) || 0;
  const unmappedOffers = offerStats?.filter(o => !o.is_mapped) || [];
  
  const chartData = offerStats?.slice(0, 8).map(o => ({
    name: o.offer_name.length > 20 ? o.offer_name.substring(0, 18) + '...' : o.offer_name,
    value: o.gross_value,
    sales: o.total_sales,
    isMapped: o.is_mapped,
  })) || [];
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Bruto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGross)}</div>
            <p className="text-xs text-muted-foreground">Total de vendas Kiwify</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalNet)}</div>
            <p className="text-xs text-muted-foreground">Após taxas e comissões</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">
              Ticket médio: {formatCurrency(totalSales > 0 ? totalGross / totalSales : 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card className={unmappedOffers.length > 0 ? "border-yellow-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Não Mapeadas</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${unmappedOffers.length > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unmappedOffers.length}</div>
            <p className="text-xs text-muted-foreground">
              {unmappedOffers.length > 0 ? 'Vincule no cadastro de produtos' : 'Todas mapeadas!'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas por Oferta (Top 8)</CardTitle>
          <CardDescription>Valor bruto por oferta Kiwify</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), 'Valor']}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isMapped ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Unmapped Offers Table */}
      {unmappedOffers.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Ofertas Não Mapeadas
            </CardTitle>
            <CardDescription>
              Essas ofertas ainda não estão vinculadas a produtos. Acesse Produtos → Editar → Ofertas Vinculadas para mapear.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unmappedOffers.slice(0, 10).map((offer) => (
                <div key={offer.offer_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{offer.offer_name}</p>
                    <p className="text-xs text-muted-foreground">ID: {offer.offer_id}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{offer.total_sales} vendas</Badge>
                    <p className="text-sm font-medium mt-1">{formatCurrency(offer.gross_value)}</p>
                  </div>
                </div>
              ))}
              {unmappedOffers.length > 10 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  ... e mais {unmappedOffers.length - 10} ofertas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Full Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Ofertas</CardTitle>
          <CardDescription>Performance completa de vendas por oferta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Oferta</th>
                  <th className="text-left py-3 px-2">Produto</th>
                  <th className="text-right py-3 px-2">Vendas</th>
                  <th className="text-right py-3 px-2">Reembolsos</th>
                  <th className="text-right py-3 px-2">Valor Bruto</th>
                  <th className="text-right py-3 px-2">Valor Líquido</th>
                  <th className="text-center py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {offerStats?.map((offer) => (
                  <tr key={offer.offer_id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2">
                      <div className="max-w-[200px] truncate" title={offer.offer_name}>
                        {offer.offer_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{offer.offer_id}</div>
                    </td>
                    <td className="py-3 px-2">{offer.product_name}</td>
                    <td className="text-right py-3 px-2">{offer.total_sales}</td>
                    <td className="text-right py-3 px-2">
                      {offer.refunds > 0 && (
                        <Badge variant="destructive" className="text-xs">{offer.refunds}</Badge>
                      )}
                      {offer.refunds === 0 && <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="text-right py-3 px-2 font-medium">{formatCurrency(offer.gross_value)}</td>
                    <td className="text-right py-3 px-2">{formatCurrency(offer.net_value)}</td>
                    <td className="text-center py-3 px-2">
                      {offer.is_mapped ? (
                        <Badge variant="default" className="text-xs">Mapeada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Pendente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
