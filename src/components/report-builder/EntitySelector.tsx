import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface EntitySelectorProps {
  entities: string[];
  value: string | null;
  onChange: (entity: string) => void;
  loading?: boolean;
}

export function EntitySelector({ entities, value, onChange, loading }: EntitySelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Entidade Base</Label>
      <Select value={value || ""} onValueChange={onChange} disabled={loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione uma entidade"} />
        </SelectTrigger>
        <SelectContent>
          {entities.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
