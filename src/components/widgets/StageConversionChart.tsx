import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStageConversionRates } from "@/hooks/useStageConversionRates";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function StageConversionChart() {
  const { data, isLoading } = useStageConversionRates();

  const getBarColor = (rate: number) => {
    if (rate >= 50) return "hsl(142, 76%, 36%)"; // green
    if (rate >= 30) return "hsl(45, 93%, 47%)"; // yellow
    return "hsl(0, 84%, 60%)"; // red
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.stageName}</p>
          <p className="text-primary font-semibold">{data.conversionRate}% conversão</p>
          <p className="text-sm text-muted-foreground">
            {data.totalDeals} negócio(s) nesta etapa
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Taxa de Conversão por Estágio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Taxa de Conversão por Estágio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              className="text-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="stageName"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={100}
              className="text-muted-foreground"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="conversionRate" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.conversionRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
