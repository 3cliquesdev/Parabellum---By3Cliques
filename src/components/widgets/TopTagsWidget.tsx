import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTopTags } from "@/hooks/useTopTags";
import { Tags, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TopTagsWidgetProps {
  startDate: Date;
  endDate: Date;
}

export function TopTagsWidget({ startDate, endDate }: TopTagsWidgetProps) {
  const { data, isLoading } = useTopTags(startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            Top 10 Tags de Suporte
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const { topTags, ticketsWithoutTags } = data || { topTags: [], ticketsWithoutTags: { count: 0, total: 0, percentage: 0 } };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-primary" />
          Top 10 Tags de Suporte
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Problemas mais reportados por tag
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerta de tickets sem tags */}
        {ticketsWithoutTags.count > 5 && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              <span className="font-medium">{ticketsWithoutTags.count} tickets</span> ({ticketsWithoutTags.percentage.toFixed(0)}%) sem tags - considere categorizar
            </AlertDescription>
          </Alert>
        )}

        {topTags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tags className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma tag registrada neste período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topTags.map((tag, index) => (
              <div key={tag.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0" 
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium truncate max-w-[180px]">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {tag.count} {tag.count === 1 ? 'ticket' : 'tickets'}
                    </span>
                    <Badge 
                      variant={index === 0 ? 'default' : 'secondary'}
                      className="min-w-[50px] justify-center"
                    >
                      {tag.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress 
                  value={tag.percentage} 
                  className="h-1.5"
                  style={{ 
                    '--progress-color': tag.color 
                  } as React.CSSProperties}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
