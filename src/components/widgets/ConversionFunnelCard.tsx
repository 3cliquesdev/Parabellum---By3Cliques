import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  MessageCircle,
  Users,
  ArrowDown,
  UserPlus
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { useDealsConversionAnalysis, DealSource } from "@/hooks/useDealsConversionAnalysis";
import { useAllSourcesConversionAnalysis, SourceAnalysis } from "@/hooks/useAllSourcesConversionAnalysis";
import { cn } from "@/lib/utils";

interface ConversionFunnelCardProps {
  dateRange?: DateRange;
}

const sourceIcons: Record<string, React.ReactNode> = {
  affiliate: <Users className="w-4 h-4" />,
  organic_recurring: <RefreshCw className="w-4 h-4" />,
  organic_new: <ShoppingCart className="w-4 h-4" />,
  commercial: <MessageCircle className="w-4 h-4" />,
};

const sourceColors: Record<string, { bg: string; text: string; border: string; icon: string; bar: string }> = {
  affiliate: { 
    bg: "bg-orange-50 dark:bg-orange-950/40", 
    text: "text-orange-700 dark:text-orange-300", 
    border: "border-orange-200 dark:border-orange-800", 
    icon: "text-orange-500",
    bar: "bg-orange-500"
  },
  organic_recurring: { 
    bg: "bg-purple-50 dark:bg-purple-950/40", 
    text: "text-purple-700 dark:text-purple-300", 
    border: "border-purple-200 dark:border-purple-800", 
    icon: "text-purple-500",
    bar: "bg-purple-500"
  },
  organic_new: { 
    bg: "bg-blue-50 dark:bg-blue-950/40", 
    text: "text-blue-700 dark:text-blue-300", 
    border: "border-blue-200 dark:border-blue-800", 
    icon: "text-blue-500",
    bar: "bg-blue-500"
  },
  commercial: { 
    bg: "bg-emerald-50 dark:bg-emerald-950/40", 
    text: "text-emerald-700 dark:text-emerald-300", 
    border: "border-emerald-200 dark:border-emerald-800", 
    icon: "text-emerald-500",
    bar: "bg-emerald-500"
  },
};

// Premium Funnel Bar Component
function FunnelBar({ 
  label, 
  value, 
  percentage, 
  widthPercent, 
  color,
  icon: Icon 
}: { 
  label: string; 
  value: number; 
  percentage: number; 
  widthPercent: number;
  color: "blue" | "emerald" | "red" | "amber";
  icon: React.ElementType;
}) {
  const colorMap = {
    blue: {
      bar: "from-blue-500 to-blue-600",
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-950/30",
    },
    emerald: {
      bar: "from-emerald-500 to-emerald-600",
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950/30",
    },
    red: {
      bar: "from-red-400 to-red-500",
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-950/30",
    },
    amber: {
      bar: "from-amber-400 to-amber-500",
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-950/30",
    },
  };

  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg", colorMap[color].bg)}>
        <Icon className={cn("w-4 h-4", colorMap[color].text)} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-bold", colorMap[color].text)}>{value}</span>
            {percentage > 0 && (
              <span className="text-xs text-muted-foreground">({percentage.toFixed(1)}%)</span>
            )}
          </div>
        </div>
        <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-all duration-500",
              colorMap[color].bar
            )}
            style={{ width: `${Math.max(widthPercent, 2)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Premium Source Card with mini-funnel
function SourceCard({ source, label, data, isLoading }: SourceAnalysis) {
  const colors = sourceColors[source] || sourceColors.commercial;
  
  if (isLoading || !data) {
    return (
      <div className={cn("p-4 rounded-xl border animate-pulse", colors.bg, colors.border)}>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const wonRate = data.totalCreated > 0 ? (data.totalWon / data.totalCreated) * 100 : 0;
  const wonWidth = data.totalCreated > 0 ? (data.totalWon / data.totalCreated) * 100 : 0;

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all hover:shadow-md cursor-default",
      colors.bg, colors.border
    )}>
      {/* Header com ícone e label */}
      <div className="flex items-center gap-2 mb-3">
        <span className={colors.icon}>{sourceIcons[source]}</span>
        <span className="font-medium text-foreground text-sm">{label}</span>
      </div>
      
      {/* Mini-Funil Visual */}
      <div className="space-y-2">
        {/* Barra Criados (sempre 100%) */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Criados</span>
            <span className="font-semibold text-foreground">{data.totalCreated}</span>
          </div>
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-400/70 w-full" />
          </div>
        </div>
        
        {/* Barra Ganhos (proporcional) */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Ganhos</span>
            <span className={cn("font-bold", colors.text)}>
              {data.totalWon} <span className="text-xs font-normal">({wonRate.toFixed(0)}%)</span>
            </span>
          </div>
          <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all", "bg-emerald-500")}
              style={{ width: `${Math.max(wonWidth, 2)}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Footer: Em Aberto + Perdidos */}
      <div className="mt-3 pt-2 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
        <span>{data.totalOpen} em aberto</span>
        <span>{data.totalLost} perdidos</span>
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
          <Skeleton className="h-32 w-full rounded-xl" />
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

      {/* Source Filter Tabs - 4 Categorias Consolidadas */}
      <Tabs value={source} onValueChange={(v) => setSource(v as DealSource)} className="mb-5">
        <TabsList className="grid w-full grid-cols-5 h-9">
          <TabsTrigger value="all" className="text-xs px-2">Todos</TabsTrigger>
          <TabsTrigger value="affiliate" className="text-xs px-2">Afiliados</TabsTrigger>
          <TabsTrigger value="organic_recurring" className="text-xs px-2">Recorrência</TabsTrigger>
          <TabsTrigger value="organic_new" className="text-xs px-2">Orgânico</TabsTrigger>
          <TabsTrigger value="commercial" className="text-xs px-2">Comercial</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Premium Visual Funnel */}
      <div className="space-y-3 mb-5">
        <FunnelBar 
          label="Criados" 
          value={totalCreated} 
          percentage={100}
          widthPercent={100}
          color="blue"
          icon={TrendingUp}
        />
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <FunnelBar 
          label="Ganhos" 
          value={totalWon} 
          percentage={createdToWonRate}
          widthPercent={totalCreated > 0 ? (totalWon / totalCreated) * 100 : 0}
          color="emerald"
          icon={CheckCircle2}
        />
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <FunnelBar 
          label="Perdidos" 
          value={totalLost} 
          percentage={createdToLostRate}
          widthPercent={totalCreated > 0 ? (totalLost / totalCreated) * 100 : 0}
          color="red"
          icon={XCircle}
        />
        <div className="flex justify-center">
          <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <FunnelBar 
          label="Em Aberto" 
          value={totalOpen} 
          percentage={openRate}
          widthPercent={totalCreated > 0 ? (totalOpen / totalCreated) * 100 : 0}
          color="amber"
          icon={Hourglass}
        />
      </div>

      {/* Breakdown by Source (only shown when "Todos" is selected) */}
      {showBreakdown && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Breakdown por Canal</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSourcesData.sources.map((sourceData) => (
              <SourceCard key={sourceData.source} {...sourceData} />
            ))}
          </div>
        </div>
      )}

      {/* Time to Win Stats (only shown when specific source selected) */}
      {!showBreakdown && (
        <div className="pt-4 border-t border-border">
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
      )}
    </Card>
  );
}
