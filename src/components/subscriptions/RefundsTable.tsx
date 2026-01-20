import { useState, useMemo } from "react";
import { RefundData, ProductCategory } from "@/hooks/useKiwifySubscriptions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface RefundsTableProps {
  refunds: RefundData[];
}

type SortField = 'refundDate' | 'productName' | 'customerName' | 'productCategory' | 'value';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 25;

const CATEGORY_STYLES: Record<ProductCategory, string> = {
  'Associado Premium': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Shopee Creation': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Híbrido': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Uni 3 Cliques': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Outros': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function RefundsTable({ refunds }: RefundsTableProps) {
  const [sortField, setSortField] = useState<SortField>('refundDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedRefunds = useMemo(() => {
    if (!refunds) return [];
    
    return [...refunds].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'refundDate':
          comparison = new Date(a.refundDate).getTime() - new Date(b.refundDate).getTime();
          break;
        case 'productName':
          comparison = a.productName.localeCompare(b.productName);
          break;
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'productCategory':
          comparison = a.productCategory.localeCompare(b.productCategory);
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [refunds, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(sortedRefunds.length / ITEMS_PER_PAGE);
  const paginatedRefunds = sortedRefunds.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (!refunds || refunds.length === 0) {
    return null;
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-40'}`} />
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-red-500" />
          Reembolsos ({refunds.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="refundDate">Data</SortableHeader>
                <SortableHeader field="productName">Produto</SortableHeader>
                <SortableHeader field="productCategory">Categoria</SortableHeader>
                <SortableHeader field="customerName">Cliente</SortableHeader>
                <TableHead>Status</TableHead>
                <SortableHeader field="value">
                  <span className="w-full text-right">Valor</span>
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRefunds.map((refund, index) => (
                <TableRow key={`${refund.orderId}-${index}`} className="hover:bg-muted/50">
                  <TableCell>
                    <Badge variant="destructive" className="font-normal">
                      {refund.refundDate ? format(new Date(refund.refundDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium max-w-[200px] truncate" title={refund.productName}>
                        {refund.productName}
                      </span>
                      <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={refund.offerName}>
                        {refund.offerName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${CATEGORY_STYLES[refund.productCategory]} border-0`}>
                      {refund.productCategory}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{refund.customerName}</span>
                      <span className="text-xs text-muted-foreground">{refund.customerEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">Reembolsado</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {formatCurrency(refund.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedRefunds.length)} de {sortedRefunds.length} reembolsos
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
