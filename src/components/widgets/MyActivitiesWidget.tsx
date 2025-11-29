import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, Users, Mail, CheckSquare, Utensils, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useActivities } from "@/hooks/useActivities";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const activityTypeIcons = {
  call: Phone,
  meeting: Users,
  email: Mail,
  task: CheckSquare,
  lunch: Utensils,
};

const activityTypeLabels = {
  call: "Ligação",
  meeting: "Reunião",
  email: "Email",
  task: "Tarefa",
  lunch: "Almoço",
};

const activityTypeColors = {
  call: "bg-blue-500",
  meeting: "bg-purple-500",
  email: "bg-green-500",
  task: "bg-orange-500",
  lunch: "bg-pink-500",
};

export function MyActivitiesWidget() {
  const { user } = useAuth();
  const { data: activities, isLoading } = useActivities({ completed: false });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Minhas Atividades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const limitedActivities = activities?.slice(0, 5) || [];
  const overdueCount = activities?.filter(a => new Date(a.due_date) < now).length || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          Minhas Atividades
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total Pendente</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{activities?.length || 0}</p>
          </div>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {overdueCount}
            </Badge>
          )}
        </div>

        <div className="space-y-2 pt-3 border-t">
          {limitedActivities.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma atividade pendente
            </p>
          ) : (
            limitedActivities.map((activity) => {
              const Icon = activityTypeIcons[activity.type as keyof typeof activityTypeIcons];
              const isOverdue = new Date(activity.due_date) < now;
              
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border",
                    isOverdue ? "border-destructive bg-destructive/5" : "border-border"
                  )}
                >
                  <div className={cn("p-1 rounded", activityTypeColors[activity.type as keyof typeof activityTypeColors])}>
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {activity.title}
                    </p>
                    <p className={cn("text-xs", isOverdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                      {format(new Date(activity.due_date), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {activityTypeLabels[activity.type as keyof typeof activityTypeLabels]}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {activities && activities.length > 5 && (
          <Button variant="outline" className="w-full h-8 text-xs">
            Ver Todas ({activities.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
