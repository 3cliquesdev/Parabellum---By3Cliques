import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useChannelQuality } from "@/hooks/useChannelQuality";
import { TrendingUp, TrendingDown, Circle } from "lucide-react";

export function ChannelQualityWidget() {
  const { data: channels, isLoading } = useChannelQuality();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calcular médias para classificação
  const avgTicketOverall = channels?.length
    ? channels.reduce((sum, c) => sum + c.avgTicket, 0) / channels.length
    : 0;

  const avgVolumeOverall = channels?.length
    ? channels.reduce((sum, c) => sum + c.volume, 0) / channels.length
    : 0;

  const getQualityBadge = (avgTicket: number, volume: number) => {
    const isHighTicket = avgTicket > avgTicketOverall;
    const isHighVolume = volume > avgVolumeOverall;

    if (isHighTicket && isHighVolume) {
      return (
        <Badge variant="default" className="bg-green-600">
          <TrendingUp className="h-3 w-3 mr-1" />
          Excelente
        </Badge>
      );
    } else if (isHighTicket) {
      return (
        <Badge variant="secondary" className="bg-blue-600">
          <Circle className="h-3 w-3 mr-1" />
          Alta Qualidade
        </Badge>
      );
    } else if (isHighVolume) {
      return (
        <Badge variant="secondary" className="bg-purple-600">
          <Circle className="h-3 w-3 mr-1" />
          Alto Volume
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          <TrendingDown className="h-3 w-3 mr-1" />
          Baixo
        </Badge>
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qualidade dos Canais</CardTitle>
        <CardDescription>
          Análise comparativa: volume vs ticket médio por fonte de lead
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : channels && channels.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-muted-foreground pb-2 border-b">
              <div>Canal</div>
              <div className="text-right">Volume</div>
              <div className="text-right">Ticket Médio</div>
              <div className="text-right">Receita Total</div>
              <div className="text-center">Qualidade</div>
            </div>

            {channels.map((channel) => (
              <div
                key={channel.source}
                className="grid grid-cols-5 gap-4 items-center py-3 border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                <div className="font-medium">{channel.source}</div>
                <div className="text-right text-muted-foreground">
                  {channel.volume} {channel.volume === 1 ? "deal" : "deals"}
                </div>
                <div className="text-right font-semibold">
                  {formatCurrency(channel.avgTicket)}
                </div>
                <div className="text-right font-semibold text-green-600">
                  {formatCurrency(channel.totalRevenue)}
                </div>
                <div className="flex justify-center">
                  {getQualityBadge(channel.avgTicket, channel.volume)}
                </div>
              </div>
            ))}

            <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
              <p>
                <strong>Legenda:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>
                  <Badge variant="default" className="bg-green-600 mr-2">
                    Excelente
                  </Badge>
                  Alto ticket médio + Alto volume
                </li>
                <li>
                  <Badge variant="secondary" className="bg-blue-600 mr-2">
                    Alta Qualidade
                  </Badge>
                  Alto ticket médio (leads valiosos)
                </li>
                <li>
                  <Badge variant="secondary" className="bg-purple-600 mr-2">
                    Alto Volume
                  </Badge>
                  Muitos leads (escalar conversão)
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum deal ganho encontrado para análise de canais.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
