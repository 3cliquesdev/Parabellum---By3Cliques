import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Target,
  CheckCircle2,
  XCircle,
  Hourglass,
  TrendingUp
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { useDealsConversionAnalysis, DealSource } from "@/hooks/useDealsConversionAnalysis";

interface ConversionFunnelCardProps {
  dateRange?: DateRange;
}

const sourceLabels: Record<DealSource, string> = {
  all: "Todos",
  organic_new: "1ª Compra",
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
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            Funil de Conversão
          </h3>
        </div>
      </div>

      {/* Source Filter Tabs */}
      <Tabs value={source} onValueChange={(v) => setSource(v as DealSource)} className="mb-5">
        <TabsList className="grid w-full grid-cols-5 h-9">
          <TabsTrigger value="all" className="text-xs px-2">Todos</TabsTrigger>
          <TabsTrigger value="organic_new" className="text-xs px-2" title="Primeira Compra Kiwify">1ª Compra</TabsTrigger>
          <TabsTrigger value="organic_recurring" className="text-xs px-2">Recorrente</TabsTrigger>
          <TabsTrigger value="form" className="text-xs px-2">Formulários</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs px-2">WhatsApp</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Premium Grid Layout - All data visible at once */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card Criados */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50 transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-muted-foreground">Criados</span>
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalCreated}</div>
        </div>

        {/* Card Ganhos */}
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50 transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-muted-foreground">Ganhos</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totalWon}</div>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={createdToWonRate} className="h-1.5 flex-1 [&>div]:bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 min-w-[40px] text-right">
              {createdToWonRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Card Perdidos */}
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-muted-foreground">Perdidos</span>
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">{totalLost}</div>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={createdToLostRate} className="h-1.5 flex-1 [&>div]:bg-red-500" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 min-w-[40px] text-right">
              {createdToLostRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Card Em Aberto */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <Hourglass className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-muted-foreground">Em Aberto</span>
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{totalOpen}</div>
          <div className="flex items-center gap-2 mt-2">
            <Progress value={openRate} className="h-1.5 flex-1 [&>div]:bg-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 min-w-[40px] text-right">
              {openRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Time to Win Stats */}
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Tempo para Ganhar</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-xl bg-accent/50 border border-border/50">
            <div className="text-2xl font-bold text-foreground">{avgTimeToWinDays}</div>
            <div className="text-xs text-muted-foreground mt-0.5">dias (média)</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-accent/50 border border-border/50">
            <div className="text-2xl font-bold text-foreground">{medianTimeToWinDays}</div>
            <div className="text-xs text-muted-foreground mt-0.5">dias (mediana)</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
