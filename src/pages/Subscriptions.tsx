import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useKiwifySubscriptions, ProductCategory, SubscriptionStatus } from "@/hooks/useKiwifySubscriptions";
import { SubscriptionMetricsCards } from "@/components/subscriptions/SubscriptionMetricsCards";
import { SubscriptionTable } from "@/components/subscriptions/SubscriptionTable";
import { RefundsTable } from "@/components/subscriptions/RefundsTable";
import { Download, Search, Filter, RefreshCw } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";

const CATEGORIES: ProductCategory[] = ['Associado Premium', 'Shopee Creation', 'Híbrido', 'Uni 3 Cliques', 'Outros'];

export default function Subscriptions() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(new Date()),
  });
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus>('all');
  const [selectedCategories, setSelectedCategories] = useState<ProductCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, refetch } = useKiwifySubscriptions(
    dateRange?.from,
    dateRange?.to
  );

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    if (!data?.subscriptions) return [];
    
    let result = [...data.subscriptions];

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(sub => sub.status === statusFilter);
    }

    // Filter by categories
    if (selectedCategories.length > 0) {
      result = result.filter(sub => selectedCategories.includes(sub.productCategory));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(sub => 
        sub.customerName.toLowerCase().includes(query) ||
        sub.customerEmail.toLowerCase().includes(query) ||
        sub.productName.toLowerCase().includes(query) ||
        sub.offerName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [data?.subscriptions, statusFilter, selectedCategories, searchQuery]);

  // Toggle category filter
  const toggleCategory = (category: ProductCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Export to CSV
  const handleExport = () => {
    if (!filteredSubscriptions.length) return;

    const headers = ['Data de Início', 'Produto', 'Categoria', 'Oferta', 'Cliente', 'Email', 'Status', 'Valor Bruto', 'Valor Líquido'];
    const rows = filteredSubscriptions.map(sub => [
      format(new Date(sub.startDate), 'dd/MM/yyyy', { locale: ptBR }),
      sub.productName,
      sub.productCategory,
      sub.offerName,
      sub.customerName,
      sub.customerEmail,
      sub.status === 'active' ? 'Ativa' : sub.status === 'canceled' ? 'Cancelada' : 'Encerrada',
      sub.grossValue.toFixed(2).replace('.', ','),
      sub.netValue.toFixed(2).replace('.', ','),
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assinaturas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6 text-center">
          <p className="text-destructive">Erro ao carregar assinaturas. Tente novamente.</p>
          <Button onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vendas Kiwify</h1>
          <p className="text-muted-foreground">Assinaturas, vendas e reembolsos do período</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker 
            value={dateRange} 
            onChange={setDateRange}
          />
          <Button variant="outline" onClick={handleExport} disabled={!filteredSubscriptions.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <SubscriptionMetricsCards data={data} />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search and Status Tabs */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por cliente, email ou produto..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as SubscriptionStatus)}>
              <TabsList>
                <TabsTrigger value="all">
                  Todas
                  {data && <Badge variant="secondary" className="ml-2 text-xs">{data.vendasBrutas ?? 0}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="active">
                  Ativas
                  {data && <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700">{data.totalAtivas ?? 0}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="canceled">
                  Canceladas
                  {data && <Badge variant="secondary" className="ml-2 text-xs bg-red-100 text-red-700">{data.totalCanceladas ?? 0}</Badge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Categorias:</span>
            {CATEGORIES.map(category => {
              const catData = data?.byCategory[category];
              const count = catData ? catData.ativas + catData.canceladas : 0;
              const isSelected = selectedCategories.includes(category);
              
              return (
                <Badge 
                  key={category}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/90 transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                  {category} ({count})
                </Badge>
              );
            })}
            {selectedCategories.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedCategories([])}
                className="text-xs h-6"
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Resultados ({filteredSubscriptions.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <SubscriptionTable subscriptions={filteredSubscriptions} />
          )}
        </CardContent>
      </Card>

      {/* Refunds Table - at the end */}
      {!isLoading && data?.reembolsos && data.reembolsos.length > 0 && (
        <RefundsTable refunds={data.reembolsos} />
      )}
    </div>
  );
}
