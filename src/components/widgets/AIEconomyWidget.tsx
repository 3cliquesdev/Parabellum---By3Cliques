import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAIEconomy } from "@/hooks/useAIEconomy";
import { Sparkles, Loader2, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AIEconomyWidgetProps {
  startDate: Date;
  endDate: Date;
}

export function AIEconomyWidget({ startDate, endDate }: AIEconomyWidgetProps) {
  const { data: economy, isLoading } = useAIEconomy(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Economia Gerada pela IA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const chartData = economy?.map(day => ({
    date: format(new Date(day.date), 'dd/MM', { locale: ptBR }),
    'Total': day.total_conversations,
    'Resolvidas pela IA': day.ai_resolved,
    economy_rate: day.economy_percentage
  })) || [];

  const totalConversations = economy?.reduce((sum, day) => sum + day.total_conversations, 0) || 0;
  const totalAIResolved = economy?.reduce((sum, day) => sum + day.ai_resolved, 0) || 0;
  const overallEconomy = totalConversations > 0 ? (totalAIResolved / totalConversations) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Economia Gerada pela IA
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Conversas resolvidas 100% pela IA vs Total de Conversas
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overall Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-primary/10 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalConversations}</div>
              <p className="text-xs text-muted-foreground">Total Conversas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{totalAIResolved}</div>
              <p className="text-xs text-muted-foreground">Resolvidas pela IA</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                {overallEconomy.toFixed(1)}%
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground">Taxa de Economia</p>
            </div>
          </div>

          {/* Area Chart */}
          {chartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa neste período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="Total" 
                  stackId="1"
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Area 
                  type="monotone" 
                  dataKey="Resolvidas pela IA" 
                  stackId="2"
                  stroke="hsl(142, 76%, 36%)" 
                  fill="hsl(142, 76%, 36%)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
