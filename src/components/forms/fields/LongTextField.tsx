import { Textarea } from "@/components/ui/textarea";

interface LongTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export function LongTextField({ value, onChange, placeholder, maxLength = 500 }: LongTextFieldProps) {
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Escreva sua resposta..."}
        rows={5}
        maxLength={maxLength}
        className="resize-none text-lg bg-white/5 border-white/20 focus:border-primary"
      />
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">
          {value.length} / {maxLength}
        </span>
      </div>
    </div>
  );
}
