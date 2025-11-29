import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, startOfToday, startOfYesterday, endOfYesterday, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

type PresetKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';

const presets: Record<PresetKey, { label: string; getRange: () => DateRange }> = {
  today: {
    label: 'Hoje',
    getRange: () => ({
      from: startOfToday(),
      to: startOfToday(),
    }),
  },
  yesterday: {
    label: 'Ontem',
    getRange: () => ({
      from: startOfYesterday(),
      to: endOfYesterday(),
    }),
  },
  thisWeek: {
    label: 'Esta Semana',
    getRange: () => ({
      from: startOfWeek(new Date(), { locale: ptBR }),
      to: endOfWeek(new Date(), { locale: ptBR }),
    }),
  },
  lastWeek: {
    label: 'Semana Passada',
    getRange: () => ({
      from: startOfWeek(subWeeks(new Date(), 1), { locale: ptBR }),
      to: endOfWeek(subWeeks(new Date(), 1), { locale: ptBR }),
    }),
  },
  thisMonth: {
    label: 'Este Mês',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  lastMonth: {
    label: 'Mês Passado',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  thisYear: {
    label: 'Este Ano',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
  lastYear: {
    label: 'Ano Passado',
    getRange: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1)),
    }),
  },
  custom: {
    label: 'Personalizado',
    getRange: () => ({
      from: undefined,
      to: undefined,
    }),
  },
};

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('thisMonth');

  const handlePresetChange = (preset: PresetKey) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      onChange(presets[preset].getRange());
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Quick Presets */}
      <Tabs value={activePreset} onValueChange={(v) => handlePresetChange(v as PresetKey)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today" className="text-xs">📅 Hoje</TabsTrigger>
          <TabsTrigger value="yesterday" className="text-xs">📅 Ontem</TabsTrigger>
          <TabsTrigger value="thisWeek" className="text-xs">📅 Esta Semana</TabsTrigger>
          <TabsTrigger value="lastWeek" className="text-xs">📅 Semana Passada</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={activePreset} onValueChange={(v) => handlePresetChange(v as PresetKey)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="thisMonth" className="text-xs">📅 Este Mês</TabsTrigger>
          <TabsTrigger value="lastMonth" className="text-xs">📅 Mês Passado</TabsTrigger>
          <TabsTrigger value="thisYear" className="text-xs">📅 Este Ano</TabsTrigger>
          <TabsTrigger value="lastYear" className="text-xs">📅 Ano Passado</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Custom Date Range Selector */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value?.from && "text-muted-foreground"
            )}
            onClick={() => setActivePreset('custom')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from && value?.to ? (
              <>
                {format(value.from, "dd/MM/yyyy", { locale: ptBR })} - {format(value.to, "dd/MM/yyyy", { locale: ptBR })}
              </>
            ) : (
              <span>🎯 Personalizado - Selecione o período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
