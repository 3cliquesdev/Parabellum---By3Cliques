import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight } from "lucide-react";
import { useActivities } from "@/hooks/useActivities";
import { useUpdateActivity } from "@/hooks/useUpdateActivity";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface NextActionsCardProps {
  contactId: string;
}

export default function NextActionsCard({ contactId }: NextActionsCardProps) {
  const { data: activities, isLoading } = useActivities({ contactId, completed: false });
  const updateActivity = useUpdateActivity();
  const { toast } = useToast();

  const handleToggleComplete = async (activityId: string, currentStatus: boolean) => {
    try {
      await updateActivity.mutateAsync({
        id: activityId,
        completed: !currentStatus,
      });

      toast({
        title: currentStatus ? "Atividade reaberta" : "Atividade concluída",
        description: "O status foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar atividade",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingActivities = activities?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Próximas Ações
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {pendingActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma ação pendente
          </p>
        ) : (
          <div className="space-y-2">
            {pendingActivities.map(activity => {
              const isOverdue = isPast(new Date(activity.due_date));
              
              return (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-2 p-2 rounded hover:bg-muted transition-colors"
                >
                  <Checkbox 
                    checked={activity.completed}
                    onCheckedChange={() => handleToggleComplete(activity.id, activity.completed)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.title}
                    </p>
                    <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                      {format(new Date(activity.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      {isOverdue && " • Atrasada"}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {activities && activities.length > 5 && (
              <Button variant="link" size="sm" className="w-full mt-2">
                Ver todas ({activities.length}) <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
