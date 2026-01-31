import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useChurnPrediction } from "@/hooks/useChurnPrediction";
import { AlertTriangle, Phone, Calendar, Loader2, TrendingDown, TrendingUp, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EarlyWarningWidget() {
  const { data: risks, isLoading } = useChurnPrediction();
  const navigate = useNavigate();

  const handleCall = (phone: string | null) => {
    if (phone) {
      window.open(`https://wa.me/55${phone.replace(/\D/g, "")}`, "_blank");
    }
  };

  const handleSchedule = (contactId: string) => {
    navigate(`/contacts/${contactId}`);
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Early Warning
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        </CardContent>
      </Card>
    );
  }

  if (!risks || risks.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Early Warning
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-center">
          <Shield className="h-12 w-12 text-green-500 mb-4" />
          <p className="text-muted-foreground">
            Todos os clientes estão saudáveis!
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Nenhum risco de churn detectado
          </p>
        </CardContent>
      </Card>
    );
  }

  // Mostrar top 5 riscos
  const topRisks = risks.slice(0, 5);

  return (
    <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Early Warning
          </div>
          <Badge variant="destructive">
            {risks.length} {risks.length === 1 ? "Alerta" : "Alertas"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topRisks.map((risk) => (
          <div
            key={risk.id}
            className="p-4 rounded-lg bg-background border border-border hover:border-red-500/50 transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {risk.trend === "down" ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  <p className="font-semibold text-sm">
                    {risk.first_name} {risk.last_name}
                  </p>
                  {risk.company && (
                    <span className="text-xs text-muted-foreground">
                      • {risk.company}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={risk.current_health === "red" ? "destructive" : risk.current_health === "yellow" ? "warning" : "success"}
                    className="text-xs"
                  >
                    Saúde: {risk.previous_health === "green" ? "Verde" : risk.previous_health === "yellow" ? "Atenção" : "Crítico"} → {risk.current_health === "green" ? "Verde" : risk.current_health === "yellow" ? "Atenção" : "Crítico"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {risk.days_since_contact} dias sem contato
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {risk.reason}
            </p>

            <div className="flex items-center gap-2">
              {risk.phone && (
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleCall(risk.phone)}
                  className="flex-1"
                >
                  <Phone className="h-3 w-3 mr-2" />
                  Ligar Agora
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleSchedule(risk.id)}
                className="flex-1"
              >
                <Calendar className="h-3 w-3 mr-2" />
                Agendar Reunião
              </Button>
            </div>
          </div>
        ))}

        {risks.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            + {risks.length - 5} outros clientes em risco
          </p>
        )}
      </CardContent>
    </Card>
  );
}
