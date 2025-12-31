import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesFunnel } from "@/hooks/useSalesFunnel";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { Filter } from "lucide-react";

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
};

const COLORS = [
  "hsl(221, 83%, 53%)", // Primary blue
  "hsl(221, 83%, 60%)",
  "hsl(221, 83%, 67%)",
  "hsl(221, 83%, 74%)",
  "hsl(221, 83%, 81%)",
  "hsl(221, 83%, 88%)",
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-1">{data.stageName}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Valor:</span>
            <span className="font-medium text-foreground">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
                minimumFractionDigits: 0
              }).format(data.totalValue)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Deals:</span>
            <span className="font-medium text-foreground">{data.dealsCount}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function PipelineFunnelChart() {
  const { data, isLoading } = useSalesFunnel();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Funil de Vendas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            Nenhum deal no pipeline
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis 
                type="number"
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                axisLine={{ className: "stroke-border" }}
              />
              <YAxis 
                type="category"
                dataKey="stageName"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                axisLine={{ className: "stroke-border" }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="totalValue" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
