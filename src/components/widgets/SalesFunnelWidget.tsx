import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSalesFunnel } from "@/hooks/useSalesFunnel";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Filter } from "lucide-react";

export function SalesFunnelWidget() {
  const { data: funnelData, isLoading } = useSalesFunnel();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Cores do funil (verde -> amarelo -> laranja)
  const getBarColor = (index: number, total: number) => {
    const colors = [
      "hsl(var(--primary))", // Verde
      "hsl(142, 71%, 55%)",  // Verde claro
      "hsl(45, 93%, 47%)",   // Amarelo
      "hsl(25, 95%, 53%)",   // Laranja
    ];
    return colors[Math.min(index, colors.length - 1)];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de Vendas</CardTitle>
          <CardDescription>Distribuição por etapa</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!funnelData || funnelData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Funil de Vendas
          </CardTitle>
          <CardDescription>Distribuição por etapa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            Nenhum negócio aberto no momento
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calcular maior queda entre etapas
  let maxDrop = 0;
  let dropStages = "";
  for (let i = 0; i < funnelData.length - 1; i++) {
    const current = funnelData[i].dealsCount;
    const next = funnelData[i + 1].dealsCount;
    const drop = current > 0 ? ((current - next) / current) * 100 : 0;
    
    if (drop > maxDrop) {
      maxDrop = drop;
      dropStages = `${funnelData[i].stageName} → ${funnelData[i + 1].stageName}`;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          Funil de Vendas
        </CardTitle>
        <CardDescription>Distribuição por etapa do pipeline</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="w-full min-w-0">
          <ResponsiveContainer width="100%" height={250}>
          <BarChart data={funnelData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="stageName" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card p-3 border rounded-lg shadow-lg">
                      <p className="font-semibold text-foreground">{data.stageName}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.dealsCount} negócio{data.dealsCount !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-primary font-semibold">
                        {formatCurrency(data.totalValue)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="totalValue" radius={[8, 8, 0, 0]}>
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(index, funnelData.length)} />
              ))}
            </Bar>
          </BarChart>
          </ResponsiveContainer>
        </div>

        {maxDrop > 30 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              ⚠️ Maior perda: {dropStages} ({maxDrop.toFixed(0)}% de queda)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
