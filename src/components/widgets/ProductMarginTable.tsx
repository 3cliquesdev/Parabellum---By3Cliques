import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProductMarginTableProps {
  startDate?: Date;
  endDate?: Date;
}

export function ProductMarginTable({ startDate, endDate }: ProductMarginTableProps) {
  const { data, isLoading, error } = useKiwifyFinancials(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-destructive">Erro ao carregar análise por produto</p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 75) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (margin >= 65) return "bg-blue-100 text-blue-800 border-blue-300";
    if (margin >= 55) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const products = data?.productBreakdown || [];

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-foreground">Análise por Produto/Oferta</CardTitle>
        <CardDescription>
          Breakdown financeiro detalhado mostrando margem líquida por produto
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="rounded-md border border-border overflow-x-auto min-w-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-foreground font-semibold">Produto</TableHead>
                <TableHead className="text-center text-foreground font-semibold">Vendas</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Bruto</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Líquido</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Taxas</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Afiliados</TableHead>
                <TableHead className="text-center text-foreground font-semibold">Margem %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum dado financeiro encontrado no período selecionado
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.productName} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {product.productName}
                    </TableCell>
                    <TableCell className="text-center text-foreground">
                      {product.salesCount}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {formatCurrency(product.grossRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {formatCurrency(product.netRevenue)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      {formatCurrency(product.kiwifyFee)}
                    </TableCell>
                    <TableCell className="text-right text-purple-600">
                      {formatCurrency(product.affiliateCommission)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={getMarginColor(product.marginPercent)}>
                        {formatPercent(product.marginPercent)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
