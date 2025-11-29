import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useHotDeals } from "@/hooks/useHotDeals";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function HotDealsWidget() {
  const { data: hotDeals, isLoading } = useHotDeals();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateDaysUntil = (dateString: string) => {
    const targetDate = new Date(dateString + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInDays(targetDate, today);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Negócios Quentes</CardTitle>
          <CardDescription>Próximos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hotDeals || hotDeals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Negócios Quentes
          </CardTitle>
          <CardDescription>Fechamento previsto nos próximos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
            <Flame className="h-12 w-12 mb-3 opacity-30" />
            <p>Nenhum negócio com fechamento previsto</p>
            <p className="text-sm mt-1">
              Configure datas previstas para acompanhar oportunidades
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Negócios Quentes
        </CardTitle>
        <CardDescription className="text-xs">
          Fechamento previsto nos próximos 7 dias
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Negócio</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead>Etapa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hotDeals.map((deal: any) => {
              const daysUntilClose = calculateDaysUntil(deal.expected_close_date);
              const isUrgent = daysUntilClose <= 3;
              const contact = deal.contacts;
              const organization = deal.organizations;
              const stage = deal.stages;

              return (
                <TableRow key={deal.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {contact?.first_name?.[0]}
                          {contact?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {contact?.first_name} {contact?.last_name}
                        </span>
                        {organization?.name && (
                          <span className="text-xs text-muted-foreground">
                            {organization.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium truncate max-w-[200px]">{deal.title}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {formatCurrency(deal.value || 0)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {isUrgent && (
                        <Badge variant="hot" className="w-fit">
                          <Flame className="h-3 w-3 mr-1" />
                          Urgente
                        </Badge>
                      )}
                      <span
                        className={`text-sm ${
                          isUrgent
                            ? "text-destructive font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {daysUntilClose === 0
                          ? "Hoje"
                          : daysUntilClose === 1
                          ? "Amanhã"
                          : `${daysUntilClose} dias`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{stage?.name || "Sem etapa"}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
