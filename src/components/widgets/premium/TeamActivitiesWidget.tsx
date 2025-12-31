import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamActivitiesStats } from "@/hooks/useTeamActivitiesStats";
import { DateRange } from "react-day-picker";
import { Phone, Mail, Users, CheckSquare, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamActivitiesWidgetProps {
  dateRange: DateRange | undefined;
}

interface ActivityItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  change: number;
  color: string;
}

function ActivityItem({ icon: Icon, label, count, change, color }: ActivityItemProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground">{count}</span>
          {!isNeutral && (
            <span className={cn(
              "flex items-center text-xs font-medium",
              isPositive ? "text-emerald-600" : "text-red-500"
            )}>
              {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {isPositive ? "+" : ""}{change.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TeamActivitiesWidget({ dateRange }: TeamActivitiesWidgetProps) {
  const { data: stats, isLoading } = useTeamActivitiesStats(dateRange);

  const activities = [
    { 
      icon: Phone, 
      label: "Ligações", 
      count: stats?.calls || 0, 
      change: stats?.callsChange || 0,
      color: "bg-blue-500"
    },
    { 
      icon: Mail, 
      label: "Emails", 
      count: stats?.emails || 0, 
      change: stats?.emailsChange || 0,
      color: "bg-emerald-500"
    },
    { 
      icon: Users, 
      label: "Reuniões", 
      count: stats?.meetings || 0, 
      change: stats?.meetingsChange || 0,
      color: "bg-purple-500"
    },
    { 
      icon: CheckSquare, 
      label: "Tarefas", 
      count: stats?.tasks || 0, 
      change: stats?.tasksChange || 0,
      color: "bg-amber-500"
    }
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Atividades da Equipe</CardTitle>
          </div>
          {stats && (
            <span className="text-xs text-muted-foreground">
              Total: {stats.total}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {activities.map((activity) => (
              <ActivityItem key={activity.label} {...activity} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
