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
  TrendingUp,
  ShoppingCart,
  RefreshCw,
  FileText,
  MessageCircle
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { useDealsConversionAnalysis, DealSource } from "@/hooks/useDealsConversionAnalysis";
import { useAllSourcesConversionAnalysis, SourceAnalysis } from "@/hooks/useAllSourcesConversionAnalysis";

interface ConversionFunnelCardProps {
  dateRange?: DateRange;
}

const sourceIcons: Record<string, React.ReactNode> = {
  organic: <ShoppingCart className="w-4 h-4 text-blue-500" />,
  form: <FileText className="w-4 h-4 text-orange-500" />,
  whatsapp: <MessageCircle className="w-4 h-4 text-green-500" />,
};

function SourceBreakdownRow({ source, label, data, isLoading }: SourceAnalysis) {
  if (isLoading || !data) {
    return (
      <div className="p-3 rounded-lg bg-accent/30 border border-border/50 animate-pulse">
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  const wonRate = data.totalCreated > 0 ? (data.totalWon / data.totalCreated) * 100 : 0;

  return (
    <div className="p-3 rounded-lg bg-accent/30 border border-border/50 hover:bg-accent/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          {sourceIcons[source]}
          <span className="font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold text-foreground">{data.totalCreated}</span>
            <span className="text-muted-foreground text-xs">criados</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{data.totalWon}</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-xs">({wonRate.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="font-semibold text-red-600 dark:text-red-400">{data.totalLost}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Hourglass className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold text-amber-600 dark:text-amber-400">{data.totalOpen}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConversionFunnelCard({ dateRange }: ConversionFunnelCardProps) {
  const [source, setSource] = useState<DealSource>("all");
  const { data, isLoading, isFetching } = useDealsConversionAnalysis(dateRange, source);
  const allSourcesData = useAllSourcesConversionAnalysis(dateRange);

  const showBreakdown = source === "all";
  const isLoadingAny = showBreakdown ? allSourcesData.isLoading : (isLoading || isFetching);

  if (isLoadingAny && !allSourcesData.sources.some(s => s.data)) {
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

  const displayData = showBreakdown ? allSourcesData.totals : data;
  const {
    totalCreated = 0,
    totalWon = 0,
    totalLost = 0,
    totalOpen = 0,
    createdToWonRate = 0,
    createdToLostRate = 0,
    avgTimeToWinDays = 0,
    medianTimeToWinDays = 0,
  } = displayData || {};

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
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="all" className="text-xs px-2">Todos</TabsTrigger>
          <TabsTrigger value="organic" className="text-xs px-2" title="Vendas Orgânicas Kiwify + Recuperação">Orgânica</TabsTrigger>
          <TabsTrigger value="form" className="text-xs px-2">Formulários</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs px-2">WhatsApp</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Breakdown View for "Todos" */}
      {showBreakdown ? (
        <div className="space-y-3">
          {allSourcesData.sources.map((sourceData) => (
            <SourceBreakdownRow key={sourceData.source} {...sourceData} />
          ))}
          
          {/* Summary Footer */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Resumo Geral</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{totalCreated}</div>
                <div className="text-xs text-muted-foreground">criados</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalWon}</div>
                <div className="text-xs text-muted-foreground">{createdToWonRate.toFixed(1)}% ganhos</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50">
                <div className="text-xl font-bold text-red-600 dark:text-red-400">{totalLost}</div>
                <div className="text-xs text-muted-foreground">{createdToLostRate.toFixed(1)}% perdidos</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50">
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{totalOpen}</div>
                <div className="text-xs text-muted-foreground">{openRate.toFixed(1)}% em aberto</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Premium Grid Layout - Single source view */}
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
        </>
      )}
    </Card>
  );
}
