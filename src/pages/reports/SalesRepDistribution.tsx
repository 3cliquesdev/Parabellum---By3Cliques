import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Users,
  TrendingUp,
  Calendar,
  Clock,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSalesRepDistributionReport } from "@/hooks/useSalesRepDistributionReport";
import { useQueryClient } from "@tanstack/react-query";

export default function SalesRepDistribution() {
  const queryClient = useQueryClient();
  const { bySalesRep, distributionHistory, stats, isLoading } =
    useSalesRepDistributionReport();
  const [activeTab, setActiveTab] = useState("overview");

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sales-rep-distribution"] });
    queryClient.invalidateQueries({ queryKey: ["distribution-history"] });
    queryClient.invalidateQueries({ queryKey: ["unassigned-deals-count"] });
  };

  const handleExportCSV = () => {
    if (!bySalesRep || bySalesRep.length === 0) return;

    const headers = [
      "Vendedor",
      "Leads Hoje",
      "Leads Semana",
      "Leads Mês",
      "Negócios Abertos",
      "Ganhos no Mês",
      "Taxa Conversão",
    ];

    const rows = bySalesRep.map((rep) => [
      rep.sales_rep_name,
      rep.leads_received_today,
      rep.leads_received_week,
      rep.leads_received_month,
      rep.open_deals,
      rep.won_deals_month,
      `${rep.conversion_rate}%`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `distribuicao-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Calculate distribution balance
  const getDistributionBalance = () => {
    if (!bySalesRep || bySalesRep.length < 2) return null;
    const max = Math.max(...bySalesRep.map((r) => r.leads_received_month));
    const min = Math.min(...bySalesRep.map((r) => r.leads_received_month));
    const diff = max - min;
    const avg = stats.avg_leads_per_rep;

    if (avg === 0) return { status: "neutral", message: "Sem dados suficientes" };
    const variance = (diff / avg) * 100;

    if (variance < 30) {
      return { status: "good", message: "Distribuição equilibrada" };
    } else if (variance < 60) {
      return { status: "warning", message: "Distribuição levemente desbalanceada" };
    } else {
      return { status: "bad", message: "Distribuição muito desbalanceada" };
    }
  };

  const balance = getDistributionBalance();

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Distribuição de Leads</h1>
          <p className="text-muted-foreground">
            Acompanhe a distribuição de leads entre os vendedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_leads_today}</div>
            <p className="text-xs text-muted-foreground">
              Distribuídos para {stats.total_sales_reps} vendedores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads no Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_leads_month}</div>
            <p className="text-xs text-muted-foreground">
              Média de {stats.avg_leads_per_rep} por vendedor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Não Atribuídos
            </CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unassigned_deals}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando distribuição
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Balanceamento</CardTitle>
            {balance?.status === "good" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : balance?.status === "warning" ? (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                balance?.status === "good"
                  ? "default"
                  : balance?.status === "warning"
                  ? "secondary"
                  : "destructive"
              }
            >
              {balance?.message || "Sem dados"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Users className="h-4 w-4 mr-2" />
            Por Vendedor
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Hoje</TableHead>
                    <TableHead className="text-center">Semana</TableHead>
                    <TableHead className="text-center">Mês</TableHead>
                    <TableHead className="text-center">Abertos</TableHead>
                    <TableHead className="text-center">Ganhos</TableHead>
                    <TableHead className="text-center">Conversão</TableHead>
                    <TableHead>Último Lead</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySalesRep.map((rep) => (
                    <TableRow key={rep.sales_rep_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={rep.avatar_url || undefined} />
                            <AvatarFallback>
                              {rep.sales_rep_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{rep.sales_rep_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{rep.leads_received_today}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {rep.leads_received_week}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {rep.leads_received_month}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{rep.open_deals}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-green-600">
                        {rep.won_deals_month}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            rep.conversion_rate >= 50
                              ? "default"
                              : rep.conversion_rate >= 30
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {rep.conversion_rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {rep.last_lead_at
                          ? formatDistanceToNow(new Date(rep.last_lead_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : "Nunca"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {bySalesRep.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <p className="text-muted-foreground">
                          Nenhum vendedor encontrado
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Distribuições (Últimos 7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Lead/Contato</TableHead>
                    <TableHead>Atribuído para</TableHead>
                    <TableHead>Por</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distributionHistory.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "dd/MM HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {log.contact_name || log.deal_title || "—"}
                          </p>
                          {log.deal_value && (
                            <p className="text-xs text-muted-foreground">
                              R$ {log.deal_value.toLocaleString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{log.assigned_to_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.assigned_by_name || "Sistema"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.distribution_type === "manual"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {log.distribution_type === "manual"
                            ? "Manual"
                            : "Automático"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.lead_source || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {distributionHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">
                          Nenhuma distribuição registrada nos últimos 7 dias
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
