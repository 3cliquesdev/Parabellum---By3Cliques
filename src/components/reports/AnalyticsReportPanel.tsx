import { useState } from "react";
import { format, startOfMonth, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/DateRangePicker";
import { FileSpreadsheet, FileText, Download, Mail, Users, TrendingUp, RefreshCw } from "lucide-react";
import { useKiwifySubscriptions } from "@/hooks/useKiwifySubscriptions";
import { useDealsCounts } from "@/hooks/useDealsCounts";
import { useSalesByRep } from "@/hooks/useSalesByRep";
import { useExportExcel, type ExcelReportData } from "@/hooks/useExportExcel";
import { useExportPDF } from "@/hooks/useExportPDF";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AnalyticsReportPanelProps {
  report: {
    id: string;
    name: string;
    description: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnalyticsReportPanel({ report, open, onOpenChange }: AnalyticsReportPanelProps) {
  const today = new Date();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(today),
    to: endOfDay(today),
  });

  const startDate = dateRange?.from || startOfMonth(today);
  const endDate = dateRange?.to || today;

  // Hooks de dados
  const { data: subscriptionData, isLoading: subscriptionLoading } = useKiwifySubscriptions(startDate, endDate);
  const { data: dealsCounts, isLoading: dealsLoading } = useDealsCounts(startDate, endDate);
  const { data: salesByRepData } = useSalesByRep(startDate, endDate);

  const { exportToExcel, isExporting: isExportingExcel } = useExportExcel();
  const { exportToPDF, isExporting: isExportingPDF } = useExportPDF();

  const isLoading = subscriptionLoading || dealsLoading;
  const isExporting = isExportingExcel || isExportingPDF;

  // Estatísticas rápidas
  const totalVendas = subscriptionData?.vendasLiquidas || 0;
  const totalClientes = subscriptionData?.subscriptions?.length || 0;
  const clientesComEmail = subscriptionData?.subscriptions?.filter(s => s.customerEmail)?.length || 0;

  const handleExportExcel = async () => {
    if (isLoading) {
      toast.warning("Aguarde os dados carregarem antes de exportar.");
      return;
    }

    try {
      const totalCreated = dealsCounts?.totalCreated || 0;
      const totalWon = dealsCounts?.totalWon || 0;
      const totalLost = dealsCounts?.totalLost || 0;
      const totalOpen = dealsCounts?.totalOpen || 0;

      const totalGross = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.grossValue || 0), 0) || 0;
      const totalNet = subscriptionData?.subscriptions?.reduce((sum, s) => sum + (s.netValue || 0), 0) || 0;
      const newCustomers = subscriptionData?.clientesNovos || 0;
      const recurring = subscriptionData?.clientesRecorrentes || 0;
      const kiwifyTotal = subscriptionData?.vendasLiquidas || 0;

      const conversionRate = totalCreated > 0 
        ? ((totalWon / totalCreated) * 100).toFixed(1) + "%"
        : "0%";

      // Agregar por produto
      const produtosMap = new Map<string, { nome: string; vendas: number; bruto: number; liquido: number }>();
      subscriptionData?.subscriptions?.forEach(sub => {
        const key = sub.productCategory || sub.productName;
        const current = produtosMap.get(key) || { nome: key, vendas: 0, bruto: 0, liquido: 0 };
        current.vendas++;
        current.bruto += sub.grossValue || 0;
        current.liquido += sub.netValue || 0;
        produtosMap.set(key, current);
      });

      // Agregar por oferta
      const ofertasMap = new Map<string, { produto: string; oferta: string; vendas: number; bruto: number; liquido: number }>();
      subscriptionData?.subscriptions?.forEach(sub => {
        const produtoNome = sub.productCategory || sub.productName;
        const ofertaNome = sub.offerName || "Oferta Padrão";
        const key = `${produtoNome}|${ofertaNome}`;
        const current = ofertasMap.get(key) || { 
          produto: produtoNome, 
          oferta: ofertaNome, 
          vendas: 0, 
          bruto: 0, 
          liquido: 0 
        };
        current.vendas++;
        current.bruto += sub.grossValue || 0;
        current.liquido += sub.netValue || 0;
        ofertasMap.set(key, current);
      });

      // Time Comercial
      const categoriasAutomaticas = [
        "Vendas Orgânicas",
        "Vendas Afiliados", 
        "Comercial (Não atribuído)",
        "Recuperação",
        "Recorrência"
      ];

      const timeComercialData = salesByRepData
        ?.filter(rep => !categoriasAutomaticas.includes(rep.repName))
        .map(rep => ({
          nome: rep.repName,
          deals: rep.dealsCount,
          receita: rep.totalSales
        })) || [];

      // Criar Set de orderIds reembolsados para cruzamento
      const refundedOrderIds = new Set(
        subscriptionData?.reembolsos?.map(r => r.orderId) || []
      );

      // NOVA: Lista detalhada de clientes com emails + colunas de inteligência
      const clientesDetalhado = subscriptionData?.subscriptions?.map(sub => {
        // Lógica de classificação
        const temPlano = sub.status && ['active', 'canceled', 'ended', 'waiting_payment'].includes(sub.status);
        const eAssinatura = temPlano ? 'Sim' : 'Não';
        const eVenda = (sub.grossValue || 0) > 0 ? 'Sim' : 'Não';
        const foiReembolsado = refundedOrderIds.has(sub.orderId);
        const eReembolso = foiReembolsado ? 'Sim' : 'Não';

        // Categoria consolidada
        let categoria = 'Venda';
        if (foiReembolsado) categoria = 'Reembolso';
        else if (temPlano) categoria = 'Assinatura';

        // Status da assinatura mapeado
        const statusMap: Record<string, string> = {
          'active': 'Ativa',
          'canceled': 'Cancelada',
          'ended': 'Encerrada',
          'waiting_payment': 'Aguardando Pagamento',
          'paid': 'Pago',
          'failed': 'Falhou'
        };
        const statusAssinatura = statusMap[sub.status || ''] || sub.status || '';

        return {
          email: sub.customerEmail || '',
          nome: sub.customerName || 'Cliente',
          produto: sub.productCategory || sub.productName,
          oferta: sub.offerName || 'Oferta Padrão',
          valorBruto: sub.grossValue || 0,
          valorLiquido: sub.netValue || 0,
          data: sub.startDate ? format(new Date(sub.startDate), 'dd/MM/yyyy', { locale: ptBR }) : '',
          canal: sub.sourceType === 'comercial' ? 'Comercial' 
               : sub.sourceType === 'afiliado' ? 'Afiliado' 
               : 'Orgânico',
          // Novas colunas
          eVenda,
          eAssinatura,
          eReembolso,
          categoria,
          statusAssinatura,
        };
      }) || [];

      const excelData: ExcelReportData = {
        periodo: { inicio: startDate, fim: endDate },
        resumo: {
          dealsCreados: totalCreated,
          dealsGanhos: totalWon,
          dealsAbertos: totalOpen,
          dealsPerdidos: totalLost,
          taxaConversao: conversionRate,
        },
        receita: {
          bruta: totalGross,
          liquida: totalNet,
        },
        clientes: {
          total: kiwifyTotal,
          novos: newCustomers,
          recorrentes: recurring,
        },
        produtos: Array.from(produtosMap.values()).sort((a, b) => b.bruto - a.bruto),
        ofertas: Array.from(ofertasMap.values()).sort((a, b) => b.vendas - a.vendas),
        timeComercial: timeComercialData,
        clientesDetalhado, // Com emails!
      };

      await exportToExcel(excelData, {
        filename: `Relatorio_${report.id}_${format(new Date(), 'yyyy-MM-dd')}`,
        title: report.name,
      });
      toast.success("Excel exportado com sucesso! Inclui lista de clientes com emails.");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar Excel. Tente novamente.");
    }
  };

  const handleExportPDF = async () => {
    toast.info("Para exportar PDF, acesse o dashboard completo em Analytics.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
            {report.id === 'analytics_sales' && <TrendingUp className="h-5 w-5 text-success" />}
            {report.id === 'analytics_churn' && <RefreshCw className="h-5 w-5 text-destructive" />}
            {report.id === 'analytics_performance' && <Users className="h-5 w-5 text-primary" />}
            {report.name}
          </SheetTitle>
          <SheetDescription>{report.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Seletor de Período */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Período do Relatório
            </label>
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-full"
            />
          </div>

          {/* Preview dos Dados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preview dos Dados</CardTitle>
              <CardDescription>Resumo do que será exportado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Total de Vendas
                    </span>
                    <Badge variant="secondary">{totalVendas}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Clientes com Email
                    </span>
                    <Badge variant="outline" className="text-success">
                      {clientesComEmail} de {totalClientes}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Deals Criados
                    </span>
                    <Badge variant="secondary">{dealsCounts?.totalCreated || 0}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Info sobre Emails */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary">
                  Exportação com Emails
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O Excel inclui uma aba "Clientes Detalhado" com emails, nomes, produtos e valores de cada venda.
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Export */}
          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleExportExcel} 
              disabled={isExporting || isLoading}
              className="w-full gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {isExportingExcel ? "Exportando..." : "Exportar Excel (.xlsx)"}
            </Button>
            <Button 
              onClick={handleExportPDF}
              variant="outline"
              disabled={isExporting || isLoading}
              className="w-full gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF (Ir para Dashboard)
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
