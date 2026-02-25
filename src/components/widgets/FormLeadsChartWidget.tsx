import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText } from "lucide-react";
import { DateRange } from "react-day-picker";
import { useFormSubmissionsDaily } from "@/hooks/useFormSubmissionsDaily";

interface FormLeadsChartWidgetProps {
  dateRange?: DateRange;
}

export function FormLeadsChartWidget({ dateRange }: FormLeadsChartWidgetProps) {
  const { data, isLoading } = useFormSubmissionsDaily(dateRange);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads de Formulários</CardTitle>
          <CardDescription>Por dia no período</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Leads de Formulários
          </CardTitle>
          <CardDescription>Por dia no período</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Sem dados de formulários disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Leads de Formulários
        </CardTitle>
        <CardDescription>{total} leads no período</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="w-full min-w-0">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <Tooltip
                formatter={(value: number) => [value, "Leads"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorLeads)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
