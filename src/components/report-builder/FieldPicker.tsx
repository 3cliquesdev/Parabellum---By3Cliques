import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { CatalogField } from "@/hooks/useDataCatalog";

interface FieldPickerProps {
  fields: CatalogField[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function FieldPicker({ fields, selected, onChange }: FieldPickerProps) {
  const toggle = (fieldName: string) => {
    onChange(
      selected.includes(fieldName)
        ? selected.filter((f) => f !== fieldName)
        : [...selected, fieldName]
    );
  };

  return (
    <div className="space-y-2">
      <Label>Campos</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
        {fields.map((f) => (
          <label key={f.field_name} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
            <Checkbox
              checked={selected.includes(f.field_name)}
              onCheckedChange={() => toggle(f.field_name)}
              disabled={f.is_sensitive}
            />
            <span className={f.is_sensitive ? "text-muted-foreground line-through" : ""}>
              {f.label || f.field_name}
            </span>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {f.field_type}
            </Badge>
          </label>
        ))}
      </div>
    </div>
  );
}
