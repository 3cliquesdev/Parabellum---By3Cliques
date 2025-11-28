import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhatsAppTraffic } from "@/hooks/useWhatsAppTraffic";
import { MessageCircle, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface WhatsAppTrafficWidgetProps {
  startDate: Date;
  endDate: Date;
}

export function WhatsAppTrafficWidget({ startDate, endDate }: WhatsAppTrafficWidgetProps) {
  const { data: traffic, isLoading } = useWhatsAppTraffic(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Volume de Tráfego WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const totalSent = traffic?.reduce((sum, hour) => sum + hour.sent, 0) || 0;
  const totalReceived = traffic?.reduce((sum, hour) => sum + hour.received, 0) || 0;
  const totalMessages = totalSent + totalReceived;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Volume de Tráfego WhatsApp
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Mensagens enviadas e recebidas no período
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-primary/10 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalMessages}</div>
              <p className="text-xs text-muted-foreground">Total Mensagens</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1 text-green-600">
                {totalSent}
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1 text-blue-600">
                {totalReceived}
                <TrendingDown className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">Recebidas</p>
            </div>
          </div>

          {/* Line Chart */}
          {traffic?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma mensagem WhatsApp neste período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={traffic}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  name="Enviadas"
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142, 76%, 36%)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="received" 
                  name="Recebidas"
                  stroke="hsl(221, 83%, 53%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(221, 83%, 53%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
