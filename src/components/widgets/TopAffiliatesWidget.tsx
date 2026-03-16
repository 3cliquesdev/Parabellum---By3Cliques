import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKiwifyFinancials } from "@/hooks/useKiwifyFinancials";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";

interface TopAffiliatesWidgetProps {
  startDate?: Date;
  endDate?: Date;
}

export function TopAffiliatesWidget({ startDate, endDate }: TopAffiliatesWidgetProps) {
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
          <p className="text-sm text-destructive">Erro ao carregar ranking de afiliados</p>
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

  const affiliates = data?.topAffiliates || [];
  const totalSales = affiliates.reduce((sum, a) => sum + a.salesCount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-foreground">Top Afiliados</CardTitle>
        </div>
        <CardDescription>
          Ranking dos afiliados que mais geraram vendas no período
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-foreground font-semibold">Afiliado</TableHead>
                <TableHead className="text-foreground font-semibold">Email</TableHead>
                <TableHead className="text-center text-foreground font-semibold">Vendas</TableHead>
                <TableHead className="text-center text-foreground font-semibold">% Vendas</TableHead>
                <TableHead className="text-center text-foreground font-semibold">% Comissão</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Comissão Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma venda com afiliado no período selecionado
                  </TableCell>
                </TableRow>
              ) : (
                affiliates.map((affiliate, index) => (
                  <TableRow key={`${affiliate.affiliateEmail}-${index}`} className="hover:bg-muted/30">
                    <TableCell className="font-medium text-foreground">
                      {affiliate.affiliateName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {affiliate.affiliateEmail}
                    </TableCell>
                    <TableCell className="text-center text-foreground">
                      {affiliate.salesCount}
                    </TableCell>
                    <TableCell className="text-center text-foreground">
                      {totalSales > 0 ? ((affiliate.salesCount / totalSales) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                    <TableCell className="text-center font-semibold text-amber-600">
                      {affiliate.commissionPercent.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold text-purple-600">
                      {formatCurrency(affiliate.totalCommission)}
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
