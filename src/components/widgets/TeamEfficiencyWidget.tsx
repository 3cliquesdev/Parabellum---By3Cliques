import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamEfficiency } from "@/hooks/useTeamEfficiency";
import { Users, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TeamEfficiencyWidgetProps {
  startDate: Date;
  endDate: Date;
}

const COLORS = [
  'hsl(142, 76%, 36%)', // Green for best
  'hsl(221, 83%, 53%)', // Blue
  'hsl(48, 96%, 53%)', // Yellow
  'hsl(25, 95%, 53%)', // Orange
  'hsl(0, 84%, 60%)', // Red for worst
];

export function TeamEfficiencyWidget({ startDate, endDate }: TeamEfficiencyWidgetProps) {
  const { data: efficiency, isLoading } = useTeamEfficiency(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Eficiência da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const chartData = efficiency?.map((agent, index) => ({
    name: agent.agent_name.split(' ')[0], // First name only for space
    minutes: Math.round(agent.avg_resolution_minutes),
    full_name: agent.agent_name,
    tickets: agent.tickets_resolved,
    colorIndex: Math.min(index, COLORS.length - 1)
  })) || [];

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Eficiência da Equipe
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Tempo médio de resolução por agente (menor é melhor)
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum ticket resolvido neste período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis 
                type="number" 
                tickFormatter={formatTime}
                label={{ value: 'Tempo Médio', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={80}
              />
              <Tooltip 
                formatter={(value: number, name: string, props: any) => [
                  formatTime(value),
                  'Tempo Médio'
                ]}
                labelFormatter={(label, payload) => {
                  if (payload && payload[0]) {
                    return `${payload[0].payload.full_name} (${payload[0].payload.tickets} tickets)`;
                  }
                  return label;
                }}
              />
              <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.colorIndex]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
