import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type DashboardBlock = Database['public']['Tables']['dashboard_blocks']['Row'];

interface Props {
  block: DashboardBlock;
  onRemove: () => void;
}

export function DashboardBlockTable({ block, onRemove }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["block-data", block.id, block.report_id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("report-query-engine", {
        body: { report_id: block.report_id, limit: 100 },
      });
      if (error) throw error;
      return data as { rows: Record<string, unknown>[]; has_more: boolean };
    },
  });

  const headers = data?.rows?.[0] ? Object.keys(data.rows[0]) : [];

  return (
    <Card className="relative group md:col-span-2">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 z-10"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {block.title || "Tabela"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive p-4">Erro ao carregar dados</p>
        ) : !data?.rows?.length ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Sem dados</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, idx) => (
                <TableRow key={idx}>
                  {headers.map((h) => (
                    <TableCell key={h}>{row[h] != null ? String(row[h]) : "—"}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
