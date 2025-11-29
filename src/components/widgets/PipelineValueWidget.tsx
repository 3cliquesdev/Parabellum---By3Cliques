import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePipelineValue } from "@/hooks/usePipelineValue";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PipelineValueWidget() {
  const { totalPipelineValue, weightedValue, isLoading } = usePipelineValue();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Valor no Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          Valor no Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">
          {formatCurrency(totalPipelineValue)}
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Ponderado: {formatCurrency(weightedValue)}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-xs">ℹ️</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  O valor ponderado considera a probabilidade de fechamento de
                  cada negócio (valor × probabilidade).
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
