import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity, CheckCircle, XCircle, Clock, AlertCircle, Eye } from "lucide-react";
import { usePlaybookExecutions } from "@/hooks/usePlaybookExecutions";
import { useExecutionQueue } from "@/hooks/useExecutionQueue";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PlaybookExecutions() {
  const { data: executions, isLoading } = usePlaybookExecutions();
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const { data: queueItems } = useExecutionQueue(selectedExecution?.id);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "completed_via_goal":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Activity className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "default",
      completed_via_goal: "secondary",
      failed: "destructive",
      running: "outline",
    };

    const labels: Record<string, string> = {
      completed: "Completo",
      completed_via_goal: "Completo (Meta)",
      failed: "Falhou",
      running: "Executando",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="gap-1">
        {getStatusIcon(status)}
        {labels[status] || status}
      </Badge>
    );
  };

  const getNodeStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: "default",
      failed: "destructive",
      pending: "secondary",
      processing: "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Activity className="h-8 w-8" />
          Execuções de Playbooks
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitore o progresso e histórico de execuções dos playbooks
        </p>
      </div>

      {/* Métricas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Execuções
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {executions?.filter((e) => e.status === "running").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {executions?.filter((e) => e.status.includes("completed")).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Falhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {executions?.filter((e) => e.status === "failed").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Execuções */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Execuções</CardTitle>
          <CardDescription>
            Lista completa de todas as execuções de playbooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : executions?.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma execução registrada ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Playbook</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Iniciado</TableHead>
                  <TableHead>Nós Executados</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions?.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      {execution.contact?.first_name} {execution.contact?.last_name}
                      <div className="text-xs text-muted-foreground">
                        {execution.contact?.email}
                      </div>
                    </TableCell>
                    <TableCell>{execution.playbook?.name}</TableCell>
                    <TableCell>{getStatusBadge(execution.status)}</TableCell>
                    <TableCell>
                      {execution.started_at
                        ? format(new Date(execution.started_at), "dd/MM/yyyy HH:mm", {
                            locale: ptBR,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(execution.nodes_executed)
                        ? execution.nodes_executed.length
                        : 0}{" "}
                      nós
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedExecution(execution)}
                        className="gap-2"
                      >
                        <Eye className="h-3 w-3" />
                        Detalhes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog
        open={!!selectedExecution}
        onOpenChange={() => setSelectedExecution(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Execução</DialogTitle>
            <DialogDescription>
              {selectedExecution?.playbook?.name} -{" "}
              {selectedExecution?.contact?.first_name}{" "}
              {selectedExecution?.contact?.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Informações Gerais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  {selectedExecution && getStatusBadge(selectedExecution.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iniciado:</span>
                  <span>
                    {selectedExecution?.started_at
                      ? format(new Date(selectedExecution.started_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })
                      : "-"}
                  </span>
                </div>
                {selectedExecution?.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completado:</span>
                    <span>
                      {format(new Date(selectedExecution.completed_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
                {selectedExecution?.current_node_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nó Atual:</span>
                    <span className="font-mono text-xs">
                      {selectedExecution.current_node_id}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline de Nós Executados */}
            {selectedExecution?.nodes_executed &&
              Array.isArray(selectedExecution.nodes_executed) &&
              selectedExecution.nodes_executed.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Nós Executados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedExecution.nodes_executed.map((node: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{node.node_type}</div>
                            <div className="text-xs text-muted-foreground">
                              {node.executed_at &&
                                format(new Date(node.executed_at), "dd/MM HH:mm", {
                                  locale: ptBR,
                                })}
                            </div>
                            {node.result && (
                              <div className="text-xs mt-1 text-muted-foreground">
                                {JSON.stringify(node.result)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Fila de Execução */}
            {queueItems && queueItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Fila de Execução</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {queueItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{item.node_type}</span>
                            {getNodeStatusBadge(item.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Agendado para:{" "}
                            {format(new Date(item.scheduled_for), "dd/MM HH:mm", {
                              locale: ptBR,
                            })}
                          </div>
                          {item.retry_count > 0 && (
                            <div className="text-xs text-amber-600 mt-1">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              Tentativas: {item.retry_count}/{item.max_retries}
                            </div>
                          )}
                          {item.last_error && (
                            <div className="text-xs text-red-600 mt-1 p-2 bg-red-50 rounded">
                              {item.last_error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Erros */}
            {selectedExecution?.errors &&
              Array.isArray(selectedExecution.errors) &&
              selectedExecution.errors.length > 0 && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-red-600">Erros</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedExecution.errors.map((error: any, idx: number) => (
                        <div key={idx} className="p-3 bg-red-50 rounded-lg text-sm">
                          {typeof error === "string" ? error : JSON.stringify(error)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
