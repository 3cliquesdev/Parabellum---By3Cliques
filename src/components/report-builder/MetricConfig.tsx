import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { CatalogField } from "@/hooks/useDataCatalog";

export interface MetricItem {
  entity: string;
  field_name: string;
  aggregation: string;
  alias?: string;
}

const AGGREGATIONS = [
  { value: "count", label: "Contagem" },
  { value: "sum", label: "Soma" },
  { value: "avg", label: "Média" },
  { value: "min", label: "Mínimo" },
  { value: "max", label: "Máximo" },
  { value: "count_distinct", label: "Contagem Distinta" },
];

interface MetricConfigProps {
  entity: string;
  fields: CatalogField[];
  metrics: MetricItem[];
  onChange: (metrics: MetricItem[]) => void;
}

export function MetricConfig({ entity, fields, metrics, onChange }: MetricConfigProps) {
  const aggregableFields = fields.filter((f) => f.allow_aggregate && !f.is_sensitive);
  // For count, any field works
  const allFields = fields.filter((f) => !f.is_sensitive);

  const addMetric = () => {
    const defaultField = aggregableFields[0] || allFields[0];
    if (!defaultField) return;
    onChange([...metrics, { entity, field_name: defaultField.field_name, aggregation: "count" }]);
  };

  const updateMetric = (idx: number, patch: Partial<MetricItem>) => {
    onChange(metrics.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const removeMetric = (idx: number) => {
    onChange(metrics.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label>Métricas</Label>
      <div className="space-y-2">
        {metrics.map((m, idx) => {
          const availableFields = m.aggregation === "count" || m.aggregation === "count_distinct" ? allFields : aggregableFields;
          return (
            <div key={idx} className="flex items-center gap-2">
              <Select value={m.aggregation} onValueChange={(v) => updateMetric(idx, { aggregation: v })}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={m.field_name} onValueChange={(v) => updateMetric(idx, { field_name: v })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((f) => (
                    <SelectItem key={f.field_name} value={f.field_name}>{f.label || f.field_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeMetric(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button variant="outline" size="sm" onClick={addMetric}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar Métrica
      </Button>
    </div>
  );
}
