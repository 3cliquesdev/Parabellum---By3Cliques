import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateFieldProps {
  value: Date | null;
  onChange: (value: Date) => void;
  placeholder?: string;
}

export function DateField({ value, onChange, placeholder }: DateFieldProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-14 text-lg bg-white/5 border-white/20 hover:bg-white/10",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-3 h-5 w-5" />
          {value ? (
            format(value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
          ) : (
            <span>{placeholder || "Selecione uma data"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value || undefined}
          onSelect={(date) => date && onChange(date)}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
