import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Download, ExternalLink, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ReportRow } from "@/hooks/useCommercialConversationsReport";

interface CommercialDetailedTableProps {
  data: ReportRow[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onExport: () => void;
  isExporting: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function CommercialDetailedTable({
  data,
  isLoading,
  isError,
  error,
  page,
  pageSize,
  onPageChange,
  onExport,
  isExporting,
}: CommercialDetailedTableProps) {
  const navigate = useNavigate();

  const totalCount = data?.[0]?.total_count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleOpenConversation = (conversationId: string) => {
    navigate(`/inbox?conversation=${conversationId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-300">Aberta</Badge>;
      case "closed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-300">Fechada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Conversas Detalhadas</CardTitle>
          <Skeleton className="h-9 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                Erro ao carregar conversas. Por favor, tente novamente.
              </p>
            </div>
            {error?.message && (
              <p className="text-red-500 dark:text-red-500 text-xs mt-1 ml-7">{error.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Conversas Detalhadas</CardTitle>
        <Button onClick={onExport} disabled={isExporting || !data?.length}>
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </Button>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma conversa encontrada
          </p>
        ) : (
          <>
            <ScrollArea className="w-full">
              <div className="min-w-[1200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px]">ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Organização</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-center">Interações</TableHead>
                      <TableHead>Tempo Espera</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>CSAT</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Modo IA</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <TableRow
                        key={row.conversation_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleOpenConversation(row.conversation_id)}
                      >
                        <TableCell className="font-mono text-xs">{row.short_id}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{row.contact_name}</span>
                            {row.contact_phone && (
                              <span className="text-xs text-muted-foreground block">{row.contact_phone}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{row.contact_organization || "-"}</TableCell>
                        <TableCell>{row.assigned_agent_name || "-"}</TableCell>
                        <TableCell>{row.department_name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(row.status)}</TableCell>
                        <TableCell className="text-xs">{row.origin}</TableCell>
                        <TableCell className="text-center">{row.interactions_count}</TableCell>
                        <TableCell>{formatDuration(row.waiting_time_seconds)}</TableCell>
                        <TableCell>{formatDuration(row.duration_seconds)}</TableCell>
                        <TableCell>
                          {row.csat_score ? (
                            <Badge variant="outline">{row.csat_score}/5</Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {row.last_conversation_tag ? (
                            <Badge variant="secondary" className="text-xs truncate max-w-[100px]">
                              {row.last_conversation_tag}
                            </Badge>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-xs">{row.bot_flow || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(row.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenConversation(row.conversation_id);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <div className="flex items-center justify-between border-t pt-4 mt-4">
              <span className="text-sm text-muted-foreground">
                Mostrando {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} de {totalCount.toLocaleString("pt-BR")} conversa{totalCount !== 1 ? "s" : ""}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
