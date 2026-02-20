import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { CatalogField } from "@/hooks/useDataCatalog";

export interface FilterItem {
  entity: string;
  field_name: string;
  operator: string;
  value: string;
  value_end?: string;
}

const OPERATORS = [
  { value: "eq", label: "Igual" },
  { value: "neq", label: "Diferente" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
  { value: "gte", label: "Maior ou igual" },
  { value: "lte", label: "Menor ou igual" },
  { value: "contains", label: "Contém" },
  { value: "not_contains", label: "Não contém" },
  { value: "is_null", label: "É nulo" },
  { value: "is_not_null", label: "Não é nulo" },
  { value: "between", label: "Entre" },
  { value: "in", label: "Em" },
];

interface FilterBuilderProps {
  entity: string;
  fields: CatalogField[];
  filters: FilterItem[];
  onChange: (filters: FilterItem[]) => void;
}

export function FilterBuilder({ entity, fields, filters, onChange }: FilterBuilderProps) {
  const filterableFields = fields.filter((f) => f.allow_filter && !f.is_sensitive);

  const addFilter = () => {
    if (filterableFields.length === 0) return;
    onChange([...filters, { entity, field_name: filterableFields[0].field_name, operator: "eq", value: "" }]);
  };

  const updateFilter = (idx: number, patch: Partial<FilterItem>) => {
    const updated = filters.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(updated);
  };

  const removeFilter = (idx: number) => {
    onChange(filters.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label>Filtros</Label>
      <div className="space-y-2">
        {filters.map((filter, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <Select value={filter.field_name} onValueChange={(v) => updateFilter(idx, { field_name: v })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterableFields.map((f) => (
                  <SelectItem key={f.field_name} value={f.field_name}>{f.label || f.field_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filter.operator} onValueChange={(v) => updateFilter(idx, { operator: v })}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!["is_null", "is_not_null"].includes(filter.operator) && (
              <Input
                className="w-40"
                placeholder="Valor"
                value={filter.value}
                onChange={(e) => updateFilter(idx, { value: e.target.value })}
              />
            )}
            {filter.operator === "between" && (
              <Input
                className="w-40"
                placeholder="Valor final"
                value={filter.value_end || ""}
                onChange={(e) => updateFilter(idx, { value_end: e.target.value })}
              />
            )}
            <Button variant="ghost" size="icon" onClick={() => removeFilter(idx)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addFilter} disabled={filterableFields.length === 0}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar Filtro
      </Button>
    </div>
  );
}
