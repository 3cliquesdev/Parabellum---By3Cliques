import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SourceMultiSelectProps {
  selected: string[];
  onChange: (sources: string[]) => void;
}

const sourceOptions = [
  { value: "whatsapp", label: "WhatsApp", icon: "📱" },
  { value: "webchat", label: "Web Chat", icon: "💬" },
  { value: "manual", label: "Manual", icon: "✍️" },
  { value: "kiwify", label: "Kiwify", icon: "🛒" },
  { value: "kiwify_upsell", label: "Kiwify Upsell", icon: "📈" },
  { value: "indicacao", label: "Indicação", icon: "🤝" },
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
            className="text-sm font-normal cursor-pointer"
          >
            {source.icon} {source.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
