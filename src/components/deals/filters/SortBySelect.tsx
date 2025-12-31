import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

export type SortByOption = 
  | "created_at_desc" 
  | "value_desc" 
  | "value_asc" 
  | "probability_desc" 
  | "expected_close_asc";

interface SortBySelectProps {
  value: SortByOption;
  onChange: (value: SortByOption) => void;
}

const sortOptions: { value: SortByOption; label: string }[] = [
  { value: "created_at_desc", label: "Mais recentes" },
  { value: "value_desc", label: "Maior valor" },
  { value: "value_asc", label: "Menor valor" },
  { value: "probability_desc", label: "Maior probabilidade" },
  { value: "expected_close_asc", label: "Fechamento mais próximo" },
];

export function SortBySelect({ value, onChange }: SortBySelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] h-9">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Ordenar por..." />
        </div>
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
