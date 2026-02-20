import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface ReportPreviewProps {
  rows: Record<string, unknown>[];
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
}

export function ReportPreview({ rows, loading, error, hasMore }: ReportPreviewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Executando relatório...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/50 rounded-md p-4 text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum resultado. Configure os campos e clique em Preview.
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="space-y-2">
      <div className="border rounded-md overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col} className="whitespace-nowrap text-sm">
                    {row[col] === null ? <span className="text-muted-foreground italic">null</span> : String(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground">
        {rows.length} linha{rows.length !== 1 ? "s" : ""} retornada{rows.length !== 1 ? "s" : ""}
        {hasMore && " (existem mais resultados)"}
      </div>
    </div>
  );
}
