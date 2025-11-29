import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, UserPlus } from "lucide-react";
import { useSLAAlerts, useAcknowledgeAlert } from "@/hooks/useSLAAlerts";
import { useSLAViolationStats } from "@/hooks/useSLAViolationStats";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function SLAAlertWidget() {
  const navigate = useNavigate();
  const { data: alerts = [], isLoading } = useSLAAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  
  // Get today's violation stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const { data: stats } = useSLAViolationStats(today, endOfDay);

  const handleAcknowledge = async (alertId: string, conversationId: string) => {
    try {
      await acknowledgeAlert.mutateAsync({ alertId, conversationId });
      toast.success("Conversa assumida!", {
        description: "Você foi atribuído à conversa e pode responder agora."
      });
      navigate("/inbox");
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      toast.error("Erro ao assumir conversa");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            🚨 Alertas SLA Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            🚨 Alertas SLA Ativos
          </div>
          {alerts.length > 0 && (
            <Badge variant="destructive" className="text-lg px-3">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum alerta ativo no momento</p>
            <p className="text-xs mt-1">Todos os clientes estão sendo atendidos dentro do SLA</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {alerts.map((alert) => {
                const contact = alert.conversations.contacts;
                const contactName = `${contact.first_name} ${contact.last_name}`;
                
                return (
                  <div 
                    key={alert.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Clock className="h-4 w-4 text-destructive" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{contactName}</p>
                        <p className="text-xs text-muted-foreground">
                          Aguardando há <span className="font-bold text-destructive">{alert.actual_minutes} min</span>
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleAcknowledge(alert.id, alert.conversation_id)}
                      disabled={acknowledgeAlert.isPending}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assumir
                    </Button>
                  </div>
                );
              })}
            </div>

            {stats && (
              <div className="pt-3 border-t">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">📊 Taxa de Violação Hoje:</span>{" "}
                  <span className={stats.violation_rate > 10 ? "text-destructive font-bold" : "text-foreground"}>
                    {stats.violation_rate}%
                  </span>{" "}
                  ({stats.violations_count} de {stats.total_conversations} conversas)
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}