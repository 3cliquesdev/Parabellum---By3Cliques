import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMostEngagedLeads } from "@/hooks/useMostEngagedLeads";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Flame } from "lucide-react";

export function MostEngagedLeadsWidget() {
  const { data: mostEngaged, isLoading } = useMostEngagedLeads();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🔥 Leads Mais Engajados</CardTitle>
          <CardDescription>Últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!mostEngaged || mostEngaged.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Leads Mais Engajados
          </CardTitle>
          <CardDescription>Clientes com maior volume de interações recentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhuma interação nos últimos 7 dias
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-primary" />
          Leads Mais Engajados (7 dias)
        </CardTitle>
        <CardDescription>Clientes com maior volume de interações recentes</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Interações</TableHead>
              <TableHead>Negócio</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Última Atividade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mostEngaged.map((lead) => (
              <TableRow key={lead.customerId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {lead.interactionsCount >= 10 && <Badge variant="destructive">🔥 HOT</Badge>}
                    {lead.interactionsCount >= 5 && lead.interactionsCount < 10 && 
                      <Badge variant="default">⚡ WARM</Badge>}
                    {lead.customerName}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{lead.interactionsCount} toques</Badge>
                </TableCell>
                <TableCell>{lead.dealTitle || "-"}</TableCell>
                <TableCell className="text-primary font-semibold">
                  {lead.dealValue ? formatCurrency(lead.dealValue) : "-"}
                </TableCell>
                <TableCell>
                  {lead.dealStage && <Badge>{lead.dealStage}</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(lead.lastInteractionDate), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
