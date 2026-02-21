import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import type { Database, Json } from "@/integrations/supabase/types";

type DashboardBlock = Database['public']['Tables']['dashboard_blocks']['Row'];

interface Props {
  block: DashboardBlock;
  onRemove: () => void;
}

export function DashboardBlockCard({ block, onRemove }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["block-data", block.id, block.report_id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("report-query-engine", {
        body: { report_id: block.report_id, limit: 1 },
      });
      if (error) throw error;
      return data as { rows: Record<string, unknown>[]; has_more: boolean };
    },
  });

  const configJson = (block.config_json ?? {}) as Record<string, Json>;
  const metricKey = typeof configJson.metric_key === "string" ? configJson.metric_key : null;

  let displayValue: string = "—";
  if (data?.rows?.[0]) {
    const row = data.rows[0];
    if (metricKey && row[metricKey] !== undefined) {
      displayValue = String(row[metricKey]);
    } else {
      const numericKey = Object.keys(row).find((k) => typeof row[k] === "number");
      if (numericKey) {
        const v = row[numericKey] as number;
        displayValue = Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        const firstKey = Object.keys(row)[0];
        if (firstKey !== undefined) displayValue = String(row[firstKey]);
      }
    }
  }

  return (
    <Card className="relative group">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {block.title || "KPI"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar</p>
        ) : (
          <p className="text-3xl font-bold text-foreground text-center">{displayValue}</p>
        )}
      </CardContent>
    </Card>
  );
}
