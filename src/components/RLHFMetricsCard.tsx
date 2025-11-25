import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useRLHFMetrics } from "@/hooks/useRLHFMetrics";
import { TrendingUp, TrendingDown, Award } from "lucide-react";

export function RLHFMetricsCard() {
  const { data: metrics, isLoading } = useRLHFMetrics();

  if (isLoading) {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum feedback registrado ainda</p>
          <p className="text-sm text-muted-foreground mt-2">
            Use o Sandbox para testar personas e deixar feedbacks
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Quality Metrics (RLHF)</h3>
        <Badge variant="outline">
          {metrics.reduce((sum, m) => sum + m.totalFeedbacks, 0)} feedbacks
        </Badge>
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const isGood = metric.approvalRate >= 70;
          const isMedium = metric.approvalRate >= 50 && metric.approvalRate < 70;

          return (
            <div key={metric.personaId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{metric.personaName}</span>
                  {isGood ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : isMedium ? (
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-green-500">
                    👍 {metric.positiveFeedbacks}
                  </span>
                  <span className="text-red-500">
                    👎 {metric.negativeFeedbacks}
                  </span>
                  <Badge
                    variant={isGood ? "default" : isMedium ? "secondary" : "destructive"}
                    className="ml-2"
                  >
                    {metric.approvalRate}%
                  </Badge>
                </div>
              </div>
              <Progress value={metric.approvalRate} className="h-2" />
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t text-xs text-muted-foreground">
        <p>💡 Taxa de aprovação = (👍 positivos / total feedbacks) × 100%</p>
      </div>
    </Card>
  );
}
