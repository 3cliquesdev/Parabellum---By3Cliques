import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useBroadcastHistory, BroadcastJob } from "@/hooks/useBroadcastProgress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Radio,
} from "lucide-react";

interface BroadcastHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusBadge(status: BroadcastJob["status"]) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-success text-success-foreground">
          <CheckCircle className="h-3 w-3 mr-1" />
          Concluído
        </Badge>
      );
    case "running":
      return (
        <Badge variant="default" className="bg-primary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Em andamento
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary">
          <Ban className="h-3 w-3 mr-1" />
          Cancelado
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Falhou
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
  }
}

function BroadcastJobItem({ job }: { job: BroadcastJob }) {
  const [isOpen, setIsOpen] = useState(false);

  const formattedDate = format(
    new Date(job.created_at),
    "dd/MM/yyyy 'às' HH:mm",
    { locale: ptBR }
  );

  const duration =
    job.started_at && (job.completed_at || job.cancelled_at)
      ? Math.round(
          (new Date(job.completed_at || job.cancelled_at!).getTime() -
            new Date(job.started_at).getTime()) /
            1000
        )
      : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(job.status)}
              <span className="text-xs text-muted-foreground">{formattedDate}</span>
            </div>
            <p className="text-sm mt-1 line-clamp-2">{job.message}</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0">
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 text-xs">
          <span className="text-muted-foreground">
            Total: <strong>{job.total}</strong>
          </span>
          <span className="text-success">
            Enviados: <strong>{job.sent}</strong>
          </span>
          <span className="text-destructive">
            Falhas: <strong>{job.failed}</strong>
          </span>
          {job.skipped > 0 && (
            <span className="text-muted-foreground">
              Pulados: <strong>{job.skipped}</strong>
            </span>
          )}
        </div>

        <CollapsibleContent className="space-y-2 pt-2">
          {/* Duration */}
          {duration !== null && (
            <p className="text-xs text-muted-foreground">
              Duração: {duration}s
            </p>
          )}

          {/* Error message if failed */}
          {job.error_message && (
            <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-xs">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <span className="text-destructive">{job.error_message}</span>
            </div>
          )}

          {/* Results detail */}
          {job.results && job.results.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">Detalhes ({job.results.length} registros):</p>
              <ScrollArea className="h-32 border rounded p-2">
                <div className="space-y-1">
                  {job.results.slice(0, 50).map((result, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-mono">{result.phone}</span>
                      <Badge
                        variant={
                          result.status === "sent"
                            ? "default"
                            : result.status === "skipped"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {result.status}
                      </Badge>
                    </div>
                  ))}
                  {job.results.length > 50 && (
                    <p className="text-muted-foreground text-center">
                      ...e mais {job.results.length - 50} registros
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function BroadcastHistoryDialog({
  open,
  onOpenChange,
}: BroadcastHistoryDialogProps) {
  const { jobs, isLoading, refetch } = useBroadcastHistory(50);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Histórico de Broadcasts
          </DialogTitle>
          <DialogDescription>
            Veja todos os broadcasts enviados anteriormente
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum broadcast enviado ainda</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {jobs.map((job) => (
                  <BroadcastJobItem key={job.id} job={job} />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Atualizar
          </Button>
          <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
