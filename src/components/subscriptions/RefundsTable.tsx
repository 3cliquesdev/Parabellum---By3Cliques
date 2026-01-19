import { RefundData } from "@/hooks/useKiwifySubscriptions";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw } from "lucide-react";

interface RefundsTableProps {
  refunds: RefundData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function RefundsTable({ refunds }: RefundsTableProps) {
  if (!refunds || refunds.length === 0) {
    return null;
  }

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
                <TableHead>Data do Reembolso</TableHead>
                <TableHead>Data da Venda</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((refund, index) => (
                <TableRow key={`${refund.orderId}-${index}`}>
                  <TableCell>
                    <Badge variant="destructive" className="font-normal">
                      {refund.refundDate ? format(new Date(refund.refundDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {refund.originalDate ? format(new Date(refund.originalDate), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate" title={refund.productName}>
                    {refund.productName}
                  </TableCell>
                  <TableCell>{refund.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">{refund.customerEmail}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {formatCurrency(refund.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
