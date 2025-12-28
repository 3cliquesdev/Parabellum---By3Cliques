import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Download, Users, DollarSign, TrendingUp, Calendar, Search, RefreshCw, ShieldAlert, Eye } from "lucide-react";
import { useFraudDetection, useKiwifyOffersList, FraudDetectionFilters, FraudulentCustomer } from "@/hooks/useFraudDetection";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function FraudDetection() {
  const [filters, setFilters] = useState<FraudDetectionFilters>({
    minPurchases: 2
    // Sem filtros restritivos por padrão para mostrar todos os dados
  });

  const { data, isLoading, refetch } = useFraudDetection(filters);
  const { data: offers = [] } = useKiwifyOffersList();

  const handleExportCSV = () => {
    if (!data?.customers?.length) return;

    const headers = ['Nome', 'Email', 'CPF', 'Oferta', 'Total Compras', 'Primeira Compra', 'Última Compra', 'Datas de Compra', 'Valor Total'];
    const rows = data.customers.map(c => [
      c.customer_name,
      c.customer_email,
      c.customer_cpf,
      c.offer_name,
      c.total_purchases,
      c.first_purchase,
      c.last_purchase,
      c.purchase_dates.join(' | '),
      `R$ ${c.total_value.toFixed(2)}`
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fraudes_detectadas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getSeverityBadge = (purchases: number) => {
    if (purchases >= 5) return <Badge variant="destructive">Crítico ({purchases}x)</Badge>;
    if (purchases >= 3) return <Badge className="bg-orange-500">Alto ({purchases}x)</Badge>;
    return <Badge variant="secondary">Moderado ({purchases}x)</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detecção de Fraudes</h1>
            <p className="text-muted-foreground">
              Identifique clientes que compram múltiplas vezes ofertas promocionais
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={handleExportCSV} disabled={!data?.customers?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Oferta Específica</Label>
              <Select 
                value={filters.offerId || 'all'} 
                onValueChange={(v) => setFilters(f => ({ ...f, offerId: v === 'all' ? undefined : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ofertas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ofertas</SelectItem>
                  {offers.map(offer => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.name} (R${offer.value.toFixed(0)}) - {offer.count}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor Máximo (R$)</Label>
              <Input
                type="number"
                value={filters.maxValue || ''}
                onChange={(e) => setFilters(f => ({ ...f, maxValue: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="Ex: 50"
              />
            </div>

            <div className="space-y-2">
              <Label>Mín. de Compras</Label>
              <Select 
                value={String(filters.minPurchases || 2)} 
                onValueChange={(v) => setFilters(f => ({ ...f, minPurchases: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2+ compras</SelectItem>
                  <SelectItem value="3">3+ compras</SelectItem>
                  <SelectItem value="5">5+ compras</SelectItem>
                  <SelectItem value="10">10+ compras</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value) : undefined }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value) : undefined }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <Users className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Suspeitos</p>
                <p className="text-2xl font-bold">{data?.stats?.totalFraudulentCustomers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500/10">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Compras Duplicadas</p>
                <p className="text-2xl font-bold">{data?.stats?.totalDuplicatePurchases || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <DollarSign className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Estimado Perdido</p>
                <p className="text-2xl font-bold">
                  R$ {(data?.stats?.estimatedLostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-500/10">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Fraude</p>
                <p className="text-2xl font-bold">{data?.stats?.fraudPercentage || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Fraudadores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Clientes com Compras Múltiplas
            {data?.customers?.length ? (
              <Badge variant="outline" className="ml-2">{data.customers.length} encontrados</Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.customers?.length ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ShieldAlert className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhuma fraude detectada com os filtros atuais</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Oferta</TableHead>
                    <TableHead>Primeira Compra</TableHead>
                    <TableHead>Última Compra</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead className="text-center">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((customer, idx) => (
                    <FraudTableRow key={idx} customer={customer} getSeverityBadge={getSeverityBadge} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FraudTableRow({ 
  customer, 
  getSeverityBadge 
}: { 
  customer: FraudulentCustomer; 
  getSeverityBadge: (n: number) => React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell>{getSeverityBadge(customer.total_purchases)}</TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{customer.customer_name}</p>
          <p className="text-xs text-muted-foreground">{customer.customer_email}</p>
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">{customer.customer_cpf}</TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted">
                {customer.offer_name.length > 25 
                  ? customer.offer_name.slice(0, 25) + '...' 
                  : customer.offer_name}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{customer.offer_name}</p>
              <p className="text-xs opacity-70">ID: {customer.offer_id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell>{customer.first_purchase}</TableCell>
      <TableCell>{customer.last_purchase}</TableCell>
      <TableCell className="font-medium">
        R$ {customer.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="text-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Histórico de Compras</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{customer.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.customer_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPF</p>
                  <p className="font-medium font-mono">{customer.customer_cpf}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total de Compras</p>
                  <p className="font-medium">{customer.total_purchases}x</p>
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground mb-2">Datas das Compras:</p>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {customer.purchase_dates.map((date, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{date}</span>
                        {idx === 0 && <Badge variant="outline" className="text-xs">Primeira</Badge>}
                        {idx === customer.purchase_dates.length - 1 && idx !== 0 && (
                          <Badge variant="outline" className="text-xs">Última</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
