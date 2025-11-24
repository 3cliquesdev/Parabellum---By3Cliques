import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useEmailEngagement } from "@/hooks/useEmailEngagement";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Mail } from "lucide-react";

export function EmailEngagementWidget() {
  const { data: emailEngagement, isLoading } = useEmailEngagement();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>📧 Taxa de Abertura de E-mail</CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!emailEngagement || emailEngagement.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Taxa de Abertura de E-mail
          </CardTitle>
          <CardDescription>Últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum e-mail enviado nos últimos 30 dias
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBarColor = (rate: number) => {
    if (rate > 30) return "hsl(var(--chart-2))"; // Verde
    if (rate > 15) return "hsl(var(--chart-3))"; // Amarelo
    return "hsl(var(--chart-1))"; // Vermelho
  };

  const topRep = emailEngagement[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Taxa de Abertura de E-mail por Vendedor
        </CardTitle>
        <CardDescription>Últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={emailEngagement} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" unit="%" className="text-xs" />
            <YAxis
              type="category"
              dataKey="repName"
              width={100}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Taxa de Abertura"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Bar dataKey="openRate" radius={[0, 4, 4, 0]}>
              {emailEngagement.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.openRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        
        {topRep && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm">
              💡 <strong>{topRep.repName}</strong> tem a melhor taxa de abertura:{" "}
              <strong className="text-primary">{topRep.openRate.toFixed(1)}%</strong>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
