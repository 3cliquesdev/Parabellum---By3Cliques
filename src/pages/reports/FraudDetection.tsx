import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Download, Users, DollarSign, TrendingUp, Calendar, Search, RefreshCw, ShieldAlert, Eye, CalendarDays, ArrowRight } from "lucide-react";
import { useFraudDetection, useKiwifyOffersList, FraudDetectionFilters, FraudulentCustomer } from "@/hooks/useFraudDetection";
import { useConsecutiveMonthsFraud, ConsecutiveFraudFilters, ConsecutiveFraudCustomer, formatMonthDisplay } from "@/hooks/useConsecutiveMonthsFraud";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function FraudDetection() {
  const [detectionMode, setDetectionMode] = useState<'multiple' | 'consecutive'>('multiple');
  
  // Filtros para compras múltiplas
  const [multipleFilters, setMultipleFilters] = useState<FraudDetectionFilters>({
    minPurchases: 2
  });

  // Filtros para meses consecutivos
  const [consecutiveFilters, setConsecutiveFilters] = useState<ConsecutiveFraudFilters>({
    minConsecutiveMonths: 2,
    maxValue: 10 // Padrão R$10 para ofertas de prospecção
  });

  const { data: multipleData, isLoading: multipleLoading, refetch: refetchMultiple } = useFraudDetection(multipleFilters);
  const { data: consecutiveData, isLoading: consecutiveLoading, refetch: refetchConsecutive } = useConsecutiveMonthsFraud(consecutiveFilters);
  const { data: offers = [] } = useKiwifyOffersList();

  const isLoading = detectionMode === 'multiple' ? multipleLoading : consecutiveLoading;
  const refetch = detectionMode === 'multiple' ? refetchMultiple : refetchConsecutive;

  const handleExportCSV = () => {
    if (detectionMode === 'multiple') {
      if (!multipleData?.customers?.length) return;

      const headers = ['Nome', 'Email', 'CPF', 'Oferta', 'Total Compras', 'Primeira Compra', 'Última Compra', 'Datas de Compra', 'Valor Total'];
      const rows = multipleData.customers.map(c => [
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
      link.download = `fraudes_multiplas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } else {
      if (!consecutiveData?.customers?.length) return;

      const headers = ['Nome', 'Email', 'CPF', 'Oferta', 'Meses Consecutivos', 'Sequência', 'Valor Total'];
      const rows = consecutiveData.customers.map(c => [
        c.customer_name,
        c.customer_email,
        c.customer_cpf,
        c.offer_name,
        c.total_consecutive,
        c.consecutive_months.map(formatMonthDisplay).join(' -> '),
        `R$ ${c.total_value.toFixed(2)}`
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `fraudes_consecutivas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    }
  };

  const getSeverityBadge = (purchases: number) => {
    if (purchases >= 5) return <Badge variant="destructive">Crítico ({purchases}x)</Badge>;
    if (purchases >= 3) return <Badge className="bg-orange-500">Alto ({purchases}x)</Badge>;
    return <Badge variant="secondary">Moderado ({purchases}x)</Badge>;
  };

  const getConsecutiveBadge = (months: number) => {
    if (months >= 4) return <Badge variant="destructive">Crítico ({months} meses)</Badge>;
    if (months >= 3) return <Badge className="bg-orange-500">Alto ({months} meses)</Badge>;
    return <Badge variant="secondary">{months} meses consecutivos</Badge>;
  };

  const hasData = detectionMode === 'multiple' 
    ? multipleData?.customers?.length 
    : consecutiveData?.customers?.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detecção de Fraudes</h1>
            <p className="text-muted-foreground">
              Identifique clientes que abusam de ofertas promocionais
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={handleExportCSV} disabled={!hasData}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Tabs de Modo de Detecção */}
      <Tabs value={detectionMode} onValueChange={(v) => setDetectionMode(v as 'multiple' | 'consecutive')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="multiple" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Compras Múltiplas
          </TabsTrigger>
          <TabsTrigger value="consecutive" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Meses Consecutivos
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo - Compras Múltiplas */}
        <TabsContent value="multiple" className="space-y-6">
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
                    value={multipleFilters.offerId || 'all'} 
                    onValueChange={(v) => setMultipleFilters(f => ({ ...f, offerId: v === 'all' ? undefined : v }))}
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
                    value={multipleFilters.maxValue || ''}
                    onChange={(e) => setMultipleFilters(f => ({ ...f, maxValue: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Ex: 50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mín. de Compras</Label>
                  <Select 
                    value={String(multipleFilters.minPurchases || 2)} 
                    onValueChange={(v) => setMultipleFilters(f => ({ ...f, minPurchases: Number(v) }))}
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
                    value={multipleFilters.startDate ? format(multipleFilters.startDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setMultipleFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value) : undefined }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={multipleFilters.endDate ? format(multipleFilters.endDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setMultipleFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value) : undefined }))}
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
                    <p className="text-2xl font-bold">{multipleData?.stats?.totalFraudulentCustomers || 0}</p>
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
                    <p className="text-2xl font-bold">{multipleData?.stats?.totalDuplicatePurchases || 0}</p>
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
                      R$ {(multipleData?.stats?.estimatedLostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    <p className="text-2xl font-bold">{multipleData?.stats?.fraudPercentage || 0}%</p>
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
                {multipleData?.customers?.length ? (
                  <Badge variant="outline" className="ml-2">{multipleData.customers.length} encontrados</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {multipleLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !multipleData?.customers?.length ? (
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
                      {multipleData.customers.map((customer, idx) => (
                        <FraudTableRow key={idx} customer={customer} getSeverityBadge={getSeverityBadge} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conteúdo - Meses Consecutivos */}
        <TabsContent value="consecutive" className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Filtros de Análise - Meses Consecutivos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>Oferta Específica</Label>
                  <Select 
                    value={consecutiveFilters.offerId || 'all'} 
                    onValueChange={(v) => setConsecutiveFilters(f => ({ ...f, offerId: v === 'all' ? undefined : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as ofertas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as ofertas</SelectItem>
                      {offers.filter(o => o.value <= 10).map(offer => (
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
                    value={consecutiveFilters.maxValue || 10}
                    onChange={(e) => setConsecutiveFilters(f => ({ ...f, maxValue: e.target.value ? Number(e.target.value) : 10 }))}
                    placeholder="Ex: 10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mín. Meses Consecutivos</Label>
                  <Select 
                    value={String(consecutiveFilters.minConsecutiveMonths || 2)} 
                    onValueChange={(v) => setConsecutiveFilters(f => ({ ...f, minConsecutiveMonths: Number(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2+ meses</SelectItem>
                      <SelectItem value="3">3+ meses</SelectItem>
                      <SelectItem value="4">4+ meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={consecutiveFilters.startDate ? format(consecutiveFilters.startDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setConsecutiveFilters(f => ({ ...f, startDate: e.target.value ? new Date(e.target.value) : undefined }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={consecutiveFilters.endDate ? format(consecutiveFilters.endDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setConsecutiveFilters(f => ({ ...f, endDate: e.target.value ? new Date(e.target.value) : undefined }))}
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
                    <p className="text-sm text-muted-foreground">Clientes Fraudadores</p>
                    <p className="text-2xl font-bold">{consecutiveData?.stats?.totalFraudulentCustomers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-orange-500/10">
                    <CalendarDays className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Meses Consecutivos</p>
                    <p className="text-2xl font-bold">{consecutiveData?.stats?.totalConsecutiveMonths || 0}</p>
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
                      R$ {(consecutiveData?.stats?.estimatedLostValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    <p className="text-sm text-muted-foreground">Média Meses por Cliente</p>
                    <p className="text-2xl font-bold">{consecutiveData?.stats?.avgConsecutiveMonths || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Fraudadores Consecutivos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-destructive" />
                Clientes com Compras em Meses Consecutivos
                {consecutiveData?.customers?.length ? (
                  <Badge variant="outline" className="ml-2">{consecutiveData.customers.length} encontrados</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {consecutiveLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !consecutiveData?.customers?.length ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <ShieldAlert className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhuma fraude por meses consecutivos detectada</p>
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
                        <TableHead>Sequência de Meses</TableHead>
                        <TableHead>Valor Total</TableHead>
                        <TableHead className="text-center">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consecutiveData.customers.map((customer, idx) => (
                        <ConsecutiveFraudTableRow 
                          key={idx} 
                          customer={customer} 
                          getSeverityBadge={getConsecutiveBadge} 
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

function ConsecutiveFraudTableRow({ 
  customer, 
  getSeverityBadge 
}: { 
  customer: ConsecutiveFraudCustomer; 
  getSeverityBadge: (n: number) => React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell>{getSeverityBadge(customer.total_consecutive)}</TableCell>
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
      <TableCell>
        <div className="flex items-center gap-1 flex-wrap">
          {customer.consecutive_months.map((month, idx) => (
            <span key={month} className="flex items-center">
              <Badge variant="outline" className="text-xs">
                {formatMonthDisplay(month)}
              </Badge>
              {idx < customer.consecutive_months.length - 1 && (
                <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
              )}
            </span>
          ))}
        </div>
      </TableCell>
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
              <DialogTitle>Detalhes das Compras Consecutivas</DialogTitle>
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
                  <p className="text-muted-foreground">Meses Consecutivos</p>
                  <p className="font-medium">{customer.total_consecutive} meses</p>
                </div>
              </div>

              {/* Timeline visual */}
              <div>
                <p className="text-muted-foreground mb-2">Sequência de Compras:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {customer.consecutive_months.map((month, idx) => (
                    <div key={month} className="flex items-center">
                      <div className="bg-destructive/10 rounded-lg p-2 text-center min-w-[60px]">
                        <p className="text-xs text-muted-foreground">Mês {idx + 1}</p>
                        <p className="font-medium text-destructive">{formatMonthDisplay(month)}</p>
                      </div>
                      {idx < customer.consecutive_months.length - 1 && (
                        <ArrowRight className="h-4 w-4 mx-2 text-destructive" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <p className="text-muted-foreground mb-2">Compras Detalhadas:</p>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {customer.purchase_details.map((purchase, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{purchase.date}</span>
                          <Badge variant="outline" className="text-xs">
                            {formatMonthDisplay(purchase.month)}
                          </Badge>
                        </div>
                        <span className="font-medium">
                          R$ {purchase.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
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
