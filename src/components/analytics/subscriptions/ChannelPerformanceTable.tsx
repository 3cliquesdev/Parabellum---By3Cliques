import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSalesChannelPerformance } from "@/hooks/useSalesChannelPerformance";
import { Radio, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface ChannelPerformanceTableProps {
  startDate: Date;
  endDate: Date;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  formulario: "Formulário",
  form: "Formulário",
  whatsapp: "WhatsApp",
  chat_widget: "Chat Web",
  webchat: "Chat Web",
  indicacao: "Indicação",
  referral: "Indicação",
  kiwify_organic: "Orgânico",
  kiwify_direto: "Afiliados",
  recuperacao: "Recuperação",
  legado: "Legado",
  "Não informado": "Não informado",
};

const getLabel = (source: string) => SOURCE_LABELS[source.toLowerCase()] || source;

const getConversionBadge = (rate: number) => {
  if (rate >= 30) return <Badge className="bg-primary/10 text-primary border-primary/20">{rate.toFixed(1)}%</Badge>;
  if (rate >= 15) return <Badge className="bg-accent/10 text-accent-foreground border-accent/20">{rate.toFixed(1)}%</Badge>;
  return <Badge className="bg-destructive/10 text-destructive border-destructive/20">{rate.toFixed(1)}%</Badge>;
};

export function ChannelPerformanceTable({ startDate, endDate }: ChannelPerformanceTableProps) {
  const { data, isLoading } = useSalesChannelPerformance(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const channels = data || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Performance por Canal de Aquisição
        </CardTitle>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Canal</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel, index) => (
                  <TableRow key={channel.source}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {index === 0 && <ArrowUpRight className="h-4 w-4 text-primary" />}
                        {index === channels.length - 1 && channels.length > 1 && (
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        )}
                        {getLabel(channel.source)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{channel.totalDeals}</TableCell>
                    <TableCell className="text-right font-medium">{channel.wonDeals}</TableCell>
                    <TableCell className="text-center">
                      {getConversionBadge(channel.conversionRate)}
                    </TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {formatCurrency(channel.totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(channel.avgTicket)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
