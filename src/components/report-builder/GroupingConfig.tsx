import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { CatalogField } from "@/hooks/useDataCatalog";

export interface GroupingItem {
  entity: string;
  field_name: string;
  time_grain?: string;
}

const TIME_GRAINS = [
  { value: "", label: "Nenhum" },
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Ano" },
];

interface GroupingConfigProps {
  entity: string;
  fields: CatalogField[];
  groupings: GroupingItem[];
  onChange: (groupings: GroupingItem[]) => void;
}

export function GroupingConfig({ entity, fields, groupings, onChange }: GroupingConfigProps) {
  const groupableFields = fields.filter((f) => f.allow_group && !f.is_sensitive);

  const addGrouping = () => {
    if (groupableFields.length === 0 || groupings.length >= 3) return;
    onChange([...groupings, { entity, field_name: groupableFields[0].field_name }]);
  };

  const updateGrouping = (idx: number, patch: Partial<GroupingItem>) => {
    onChange(groupings.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  };

  const removeGrouping = (idx: number) => {
    onChange(groupings.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <Label>Agrupamentos (max 3)</Label>
      <div className="space-y-2">
        {groupings.map((g, idx) => {
          const fieldMeta = fields.find((f) => f.field_name === g.field_name);
          const isDate = fieldMeta?.field_type === "date";
          return (
            <div key={idx} className="flex items-center gap-2">
              <Select value={g.field_name} onValueChange={(v) => updateGrouping(idx, { field_name: v, time_grain: undefined })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupableFields.map((f) => (
                    <SelectItem key={f.field_name} value={f.field_name}>{f.label || f.field_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isDate && (
                <Select value={g.time_grain || ""} onValueChange={(v) => updateGrouping(idx, { time_grain: v || undefined })}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Time grain" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_GRAINS.map((tg) => (
                      <SelectItem key={tg.value} value={tg.value}>{tg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" size="icon" onClick={() => removeGrouping(idx)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button variant="outline" size="sm" onClick={addGrouping} disabled={groupableFields.length === 0 || groupings.length >= 3}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar Agrupamento
      </Button>
    </div>
  );
}
