import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  MessageSquare, 
  Smartphone, 
  Edit, 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  FileText,
  type LucideIcon
} from "lucide-react";

interface SourceMultiSelectProps {
  selected: string[];
  onChange: (sources: string[]) => void;
}

const sourceOptions: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "whatsapp", label: "WhatsApp", Icon: Smartphone },
  { value: "webchat", label: "Web Chat", Icon: MessageSquare },
  { value: "manual", label: "Manual", Icon: Edit },
  { value: "kiwify", label: "Kiwify", Icon: ShoppingCart },
  { value: "kiwify_upsell", label: "Kiwify Upsell", Icon: TrendingUp },
  { value: "indicacao", label: "Indicação", Icon: Users },
  { value: "formulario", label: "Formulário", Icon: FileText },
];

export function SourceMultiSelect({ selected, onChange }: SourceMultiSelectProps) {
  const toggleSource = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {sourceOptions.map((source) => (
        <div key={source.value} className="flex items-center space-x-2">
          <Checkbox
            id={`source-${source.value}`}
            checked={selected.includes(source.value)}
            onCheckedChange={() => toggleSource(source.value)}
          />
          <Label
            htmlFor={`source-${source.value}`}
            className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
          >
            <source.Icon className="h-3.5 w-3.5 text-muted-foreground" />
            {source.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
