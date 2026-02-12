import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRetryFailedExecutions } from "@/hooks/useRetryFailedExecutions";

interface PlaybookPerformance {
  playbook_id: string;
  playbook_name: string;
  executions: number;
  completed: number;
  failed: number;
  emails_sent: number;
  emails_opened: number;
  open_rate: number;
}

interface PlaybookPerformanceTableProps {
  data: PlaybookPerformance[];
}

export function PlaybookPerformanceTable({ data }: PlaybookPerformanceTableProps) {
  const retryFailed = useRetryFailedExecutions();

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum playbook executado ainda
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Playbook</TableHead>
          <TableHead className="text-center">Execuções</TableHead>
          <TableHead className="text-center">Conclusão</TableHead>
          <TableHead className="text-center">Emails</TableHead>
          <TableHead className="text-center">Taxa Abertura</TableHead>
          <TableHead>Progresso</TableHead>
          <TableHead className="text-center">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const completionRate = row.executions > 0 
            ? ((row.completed / row.executions) * 100).toFixed(0) 
            : '0';

          return (
            <TableRow key={row.playbook_id}>
              <TableCell className="font-medium">
                {row.playbook_name}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="outline">
                  {row.executions}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-green-600 font-medium">{row.completed}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-red-600">{row.failed}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span>{row.emails_sent}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-blue-600">{row.emails_opened}</span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge 
                  variant={row.open_rate >= 30 ? "default" : row.open_rate >= 15 ? "secondary" : "outline"}
                >
                  {row.open_rate.toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="min-w-[120px]">
                <div className="flex items-center gap-2">
                  <Progress value={parseFloat(completionRate)} className="h-2" />
                  <span className="text-xs text-muted-foreground w-10">
                    {completionRate}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center">
                {row.failed > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    disabled={retryFailed.isPending}
                    onClick={() => retryFailed.mutate({ playbookId: row.playbook_id })}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Reenviar ({row.failed})
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
