import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChannelPerformance } from "@/hooks/useChannelPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, TrendingUp, Star, Bot, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  startDate: Date;
  endDate: Date;
}

export function ChannelPerformanceComparison({ startDate, endDate }: Props) {
  const { data: channels, isLoading } = useChannelPerformance(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comparativo de Canais
          </CardTitle>
          <CardDescription>Performance por canal de comunicação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p>Nenhuma conversa encontrada no período</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getChannelIcon = (channel: string) => {
    if (channel === 'WhatsApp') return '💬';
    if (channel === 'Web Chat') return '🌐';
    return '📧';
  };

  const getChannelColor = (channel: string) => {
    if (channel === 'WhatsApp') return 'text-green-600';
    if (channel === 'Web Chat') return 'text-blue-600';
    return 'text-purple-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comparativo de Canais
        </CardTitle>
        <CardDescription>Performance por canal de comunicação</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {channels.map((channel) => (
          <div key={channel.channel} className="space-y-4 pb-6 border-b last:border-b-0 last:pb-0">
            {/* Channel Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getChannelIcon(channel.channel)}</span>
                <div>
                  <h4 className={`font-semibold text-lg ${getChannelColor(channel.channel)}`}>
                    {channel.channel}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {channel.total_conversations} conversas · {channel.total_messages} mensagens
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{channel.conversion_rate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Taxa de Resolução</div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 text-yellow-500" />
                  CSAT Médio
                </div>
                <div className="text-xl font-bold">
                  {channel.avg_csat > 0 ? channel.avg_csat.toFixed(1) : '-'}
                  {channel.avg_csat > 0 && <span className="text-sm text-muted-foreground">/5</span>}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="h-3 w-3 text-blue-500" />
                  AI Autopilot
                </div>
                <div className="text-xl font-bold text-blue-600">
                  {channel.ai_handled}
                  <span className="text-sm text-muted-foreground ml-1">
                    ({channel.total_conversations > 0 
                      ? ((channel.ai_handled / channel.total_conversations) * 100).toFixed(0)
                      : 0}%)
                  </span>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3 text-orange-500" />
                  Humano
                </div>
                <div className="text-xl font-bold text-orange-600">
                  {channel.human_handled}
                  <span className="text-sm text-muted-foreground ml-1">
                    ({channel.total_conversations > 0 
                      ? ((channel.human_handled / channel.total_conversations) * 100).toFixed(0)
                      : 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Resolution Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Conversas Resolvidas: {channel.closed_conversations}
                </span>
                <span className="text-muted-foreground">
                  {channel.conversion_rate.toFixed(0)}%
                </span>
              </div>
              <Progress value={channel.conversion_rate} className="h-2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
