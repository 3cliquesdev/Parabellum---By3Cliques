import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, User, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RecentAuditLogs() {
  const navigate = useNavigate();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["super-admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, table_name, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case "INSERT":
      case "CREATE":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "UPDATE":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "DELETE":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action.toUpperCase()) {
      case "INSERT":
        return "Criação";
      case "UPDATE":
        return "Atualização";
      case "DELETE":
        return "Exclusão";
      default:
        return action;
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Logs de Auditoria
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => navigate("/settings/audit-logs")}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Ver todos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Carregando...</div>
        ) : logs && logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="secondary" className={`text-xs shrink-0 ${getActionColor(log.action)}`}>
                    {getActionLabel(log.action)}
                  </Badge>
                  <span className="text-foreground truncate">{log.table_name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-xs shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            Nenhum log recente
          </div>
        )}
      </CardContent>
    </Card>
  );
}
