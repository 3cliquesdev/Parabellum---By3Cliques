import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { InboxTimeRow } from "@/hooks/useInboxTimeReport";

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  data: InboxTimeRow[] | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function InboxTimeTable({ data, isLoading, page, pageSize, onPageChange }: Props) {
  const totalCount = data?.[0]?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Protocolo</TableHead>
              <TableHead className="whitespace-nowrap">Canal</TableHead>
              <TableHead className="whitespace-nowrap">Atendente</TableHead>
              <TableHead className="whitespace-nowrap">1ª Msg Cliente</TableHead>
              <TableHead className="whitespace-nowrap">SLA IA</TableHead>
              <TableHead className="whitespace-nowrap">Tempo IA</TableHead>
              <TableHead className="whitespace-nowrap">Fila Humano</TableHead>
              <TableHead className="whitespace-nowrap">Tempo Humano</TableHead>
              <TableHead className="whitespace-nowrap">Total</TableHead>
              <TableHead className="whitespace-nowrap">CSAT</TableHead>
              <TableHead className="whitespace-nowrap">Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!data || data.length === 0) ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  Nenhuma conversa encontrada no período selecionado
                </TableCell>
              </TableRow>
            ) : data.map((row) => (
              <TableRow key={row.conversation_id}>
                <TableCell className="font-mono text-xs">#{row.short_id}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{row.channel}</Badge>
                </TableCell>
                <TableCell className="text-sm truncate max-w-[120px]">{row.assigned_agent_name || "—"}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(row.customer_first_msg_at)}</TableCell>
                <TableCell className="text-xs">{formatDuration(row.ai_first_response_sec)}</TableCell>
                <TableCell className="text-xs">{formatDuration(row.ai_duration_sec)}</TableCell>
                <TableCell className="text-xs">{formatDuration(row.human_pickup_sec)}</TableCell>
                <TableCell className="text-xs">{formatDuration(row.human_resolution_sec)}</TableCell>
                <TableCell className="text-xs font-medium">{formatDuration(row.total_resolution_sec)}</TableCell>
                <TableCell className="text-xs">{row.csat_score ?? "—"}</TableCell>
                <TableCell className="max-w-[150px]">
                  <div className="flex flex-wrap gap-1">
                    {row.tags_all?.length > 0 ? row.tags_all.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                    )) : <span className="text-xs text-muted-foreground">—</span>}
                    {row.tags_all?.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{row.tags_all.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {totalCount.toLocaleString("pt-BR")} conversas • Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
