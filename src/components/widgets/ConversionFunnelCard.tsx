import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Target,
  CheckCircle2,
  XCircle,
  Hourglass
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { useDealsConversionAnalysis, DealSource } from "@/hooks/useDealsConversionAnalysis";

interface ConversionFunnelCardProps {
  dateRange?: DateRange;
}

const sourceLabels: Record<DealSource, string> = {
  all: "Todos",
  organic: "Orgânico",
  organic_new: "Nova Venda",
  organic_recurring: "Recorrente",
  form: "Formulários",
  whatsapp: "WhatsApp",
};

export function ConversionFunnelCard({ dateRange }: ConversionFunnelCardProps) {
  const [source, setSource] = useState<DealSource>("all");
  const { data, isLoading, isFetching } = useDealsConversionAnalysis(dateRange, source);

  if (isLoading || isFetching) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    );
  }

  const {
    totalCreated = 0,
    totalWon = 0,
    totalLost = 0,
    totalOpen = 0,
    createdToWonRate = 0,
    createdToLostRate = 0,
    avgTimeToWinDays = 0,
    medianTimeToWinDays = 0,
  } = data || {};

  const openRate = totalCreated > 0 ? (totalOpen / totalCreated) * 100 : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            Funil de Conversão
          </h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {totalCreated} criados
        </Badge>
      </div>

      {/* Source Filter Tabs */}
      <Tabs value={source} onValueChange={(v) => setSource(v as DealSource)} className="mb-4">
        <TabsList className="grid w-full grid-cols-6 h-8">
          <TabsTrigger value="all" className="text-xs px-1">Todos</TabsTrigger>
          <TabsTrigger value="organic" className="text-xs px-1">Orgânico</TabsTrigger>
          <TabsTrigger value="organic_new" className="text-xs px-1">Nova</TabsTrigger>
          <TabsTrigger value="organic_recurring" className="text-xs px-1">Recorr.</TabsTrigger>
          <TabsTrigger value="form" className="text-xs px-1">Forms</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs px-1">WhatsApp</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-5">
        {/* Total Criados */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary" />
              <span className="text-base font-semibold text-foreground">Criados</span>
            </div>
            <span className="text-xl font-bold text-primary">{totalCreated}</span>
          </div>
          <Progress value={100} className="h-3" />
        </div>

        {/* Ganhos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-base font-semibold text-foreground">Ganhos</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-emerald-600">{totalWon}</span>
              <Badge variant="success" className="text-sm px-2.5 py-0.5 font-semibold">
                {createdToWonRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <Progress 
            value={createdToWonRate} 
            className="h-3 [&>div]:bg-emerald-500" 
          />
        </div>

        {/* Perdidos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              <span className="text-base font-semibold text-foreground">Perdidos</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-destructive">{totalLost}</span>
              <Badge variant="destructive" className="text-sm px-2.5 py-0.5 font-semibold">
                {createdToLostRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <Progress 
            value={createdToLostRate} 
            className="h-3 [&>div]:bg-destructive" 
          />
        </div>

        {/* Em Aberto */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-amber-500" />
              <span className="text-base font-semibold text-foreground">Em aberto</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-amber-600">{totalOpen}</span>
              <Badge variant="warning" className="text-sm px-2.5 py-0.5 font-semibold">
                {openRate.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <Progress 
            value={openRate} 
            className="h-3 [&>div]:bg-amber-500" 
          />
        </div>
      </div>

      {/* Time to Win Stats */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <span className="text-base font-semibold text-muted-foreground">Tempo para Ganhar</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-xl bg-accent border border-border/50">
            <div className="text-3xl font-bold text-foreground">{avgTimeToWinDays}</div>
            <div className="text-sm text-muted-foreground mt-1">dias (média)</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-accent border border-border/50">
            <div className="text-3xl font-bold text-foreground">{medianTimeToWinDays}</div>
            <div className="text-sm text-muted-foreground mt-1">dias (mediana)</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
